import { supabase } from './supabase';
import { syncUserAccount } from './autogcm';

export async function verifyUserSubmissions(userId: string, phone: string) {
  console.log(`🔍 Starting Verification for ${phone}...`);

  try {
    // 1. Get Live Balance (Current Wallet)
    const rvmData = await syncUserAccount(phone);
    const liveWalletBalance = Number(rvmData.integral || 0);

    // 2. Get Total Withdrawals (Money taken out)
    // ✅ CRITICAL FIX: We must add back withdrawals to know the true lifetime earnings
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('user_id', userId)
      .in('status', ['APPROVED', 'PAID', 'EXTERNAL_SYNC']);

    const totalWithdrawn = withdrawals?.reduce((sum, w) => sum + Number(w.amount || 0), 0) || 0;

    // 3. Reconstruct "Live Lifetime Earnings"
    const liveLifetimeEarnings = liveWalletBalance + totalWithdrawn;

    // 4. Get Local Verified Sum (What we already approved)
    const { data: approvedReviews } = await supabase
      .from('submission_reviews')
      .select('machine_given_points')
      .eq('user_id', userId)
      .eq('status', 'VERIFIED'); 

    const localVerifiedSum = approvedReviews?.reduce((sum, r) => sum + Number(r.machine_given_points || 0), 0) || 0;

    // 5. Calculate the Real Gap
    let availableGap = liveLifetimeEarnings - localVerifiedSum;

    // Rounding safety for floating point math
    availableGap = Math.round(availableGap * 100) / 100;

    console.log(`📊 Math: (Live:${liveWalletBalance} + W/D:${totalWithdrawn}) - Local:${localVerifiedSum} = Gap:${availableGap}`);

    // 6. Process Pending Reviews
    const { data: pendingReviews } = await supabase
      .from('submission_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .order('submitted_at', { ascending: true });

    if (!pendingReviews || pendingReviews.length === 0) {
      console.log("✅ No pending reviews.");
      return;
    }

    let approvedCount = 0;

    for (const review of pendingReviews) {
      const points = Number(review.machine_given_points || 0);
      const weight = Number(review.api_weight || 0);

      if (availableGap >= points - 0.01) {
        console.log(`✅ Auto-Verifying Review ${review.vendor_record_id} (${points} pts)`);

        const { error } = await supabase
          .from('submission_reviews')
          .update({ 
            status: 'VERIFIED', 
            reviewer_note: 'Auto-Verified via Live Point Sync',
            reviewed_at: new Date().toISOString(),
            confirmed_weight: weight,      // ✅ Fix: Fill Confirmed Weight
            calculated_points: points      // ✅ Fix: Fill Calculated Points
          })
          .eq('id', review.id);

        if (!error) {
          availableGap -= points;
          // localVerifiedSum += points; 
          approvedCount++;
        }
      } else {
        console.log(`⏳ Review (${points} pts) waiting. Gap (${availableGap}) too small.`);
        break; 
      }
    }

    if (approvedCount > 0) {
      console.log(`🎉 Verified ${approvedCount} submissions for ${phone}`);
    }

  } catch (error: any) {
    console.error("❌ Verification Failed:", error.message);
  }
}