import { ref } from 'vue';
import { supabase } from '../services/supabase';
import type { Withdrawal, SubmissionReview } from '../types';

// Define a simple type for Cleaning Record since it might not be in your types.ts yet
interface CleaningRecord {
  id: string;
  device_no: string;
  cleaner_name?: string;
  verified_status: string;
  created_at: string;
  machines?: { address: string; deviceName: string };
}

export function useDashboardStats() {
  const loading = ref(true);
  const pendingCount = ref(0);
  const totalPoints = ref(0);
  const totalWeight = ref(0);
  
  // ⚡ DATA BUCKETS
  const recentWithdrawals = ref<Withdrawal[]>([]);
  const recentSubmissions = ref<SubmissionReview[]>([]); // ♻️ New
  const recentCleaning = ref<CleaningRecord[]>([]); // 🧹 New

  async function fetchStats() {
    loading.value = true;
    try {
      const [
        pendingRes, 
        usersRes, 
        withdrawalsRes, 
        recWithdrawalRes,
        recSubmissionRes, // 1. Catch Submissions
        recCleaningRes    // 2. Catch Cleaning Logs
      ] = await Promise.all([
        // A. KPI: Pending Count
        supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        
        // B. KPI: Users Data
        supabase.from('users').select('lifetime_integral, total_weight'),
        
        // C. KPI: Financials
        supabase.from('withdrawals').select('amount').neq('status', 'REJECTED'),

        // D. List: Recent Withdrawals
        supabase
          .from('withdrawals')
          .select('*, users(nickname, avatar_url, phone)')
          .order('created_at', { ascending: false })
          .limit(5),

        // E. List: Recent Recycling (Submissions)
        supabase
          .from('submission_reviews')
          .select('*, users(nickname, avatar_url)')
          .order('submitted_at', { ascending: false })
          .limit(5),

        // F. List: Recent Cleaning
        supabase
          .from('cleaning_records')
          .select('*, machines(deviceName, address)') // Assumes you have a relation setup
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      // --- PROCESS KPIS ---
      if (pendingRes.count) pendingCount.value = pendingRes.count;

      if (usersRes.data) {
        const livePoints = usersRes.data.reduce((sum, u) => sum + (u.lifetime_integral || 0), 0);
        totalWeight.value = usersRes.data.reduce((sum, u) => sum + (u.total_weight || 0), 0);
        totalPoints.value = livePoints;
      }

      if (withdrawalsRes.data) {
        const withdrawnSum = withdrawalsRes.data.reduce((sum, w) => sum + (w.amount || 0), 0);
        totalPoints.value += withdrawnSum;
      }

      // --- PROCESS LISTS ---
      // @ts-ignore - Supabase types are sometimes strict with joins
      if (recWithdrawalRes.data) recentWithdrawals.value = recWithdrawalRes.data;
      // @ts-ignore
      if (recSubmissionRes.data) recentSubmissions.value = recSubmissionRes.data;
      // @ts-ignore
      if (recCleaningRes.data) recentCleaning.value = recCleaningRes.data;

    } catch (err) {
      console.error("Stats Error:", err);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    pendingCount,
    totalPoints,
    totalWeight,
    recentWithdrawals,
    recentSubmissions,
    recentCleaning,
    fetchStats
  };
}