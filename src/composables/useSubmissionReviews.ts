import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { getUserRecords, getMachineConfig } from '../services/autogcm';
import type { SubmissionReview } from '../types';
import { processPotentialCleaning } from './useCleaningRecords';
import { verifyUserSubmissions } from '../services/verification';

// Constants for Theoretical Calculation (KG per unit)
const THEORETICAL_CONSTANTS: Record<string, number> = {
    'plastic': 0.04, 
    'can': 0.015,
    'paper': 0.1,
    'uco': 1.0 // Usually liquid is weight=weight
};

const UCO_DEVICE_IDS = ['071582000007', '071582000009'];

export const getEvidencePhotos = (urlStr: string | null) => {
    if (!urlStr) return { before: '', after: '' };
    
    const parts = urlStr.split(',').map(p => p.trim());
    
    // ✅ Fix 1: Ensure strings are never undefined
    let before = parts[0] || '';
    let after = parts[1] || parts[0] || ''; 

    // ✅ Fix 2: Safety check before creating URL object
    if (after.startsWith('http') && !before.startsWith('http')) {
        try {
            const domain = new URL(after).origin; 
            const path = before.startsWith('/') ? before : '/' + before;
            before = domain + path;
        } catch (e) {
            console.error("Invalid URL in evidence:", after);
        }
    }

    return { before, after };
};

const detectWasteType = (rawName: string): string => {
    if (!rawName) return "Unknown";
    
    const n = rawName.toLowerCase();
    
    // 1. Paper
    if (n.includes('paper') || n.includes('kertas') || n.includes('buku') || n.includes('book')) {
        return 'Paper';
    }
    // 2. UCO (Used Cooking Oil)
    if (n.includes('oil') || n.includes('minyak') || n.includes('uco')) {
        return 'UCO';
    }
    // 3. Plastic / Aluminium (Bottles/Cans)
    if (n.includes('plastic') || n.includes('plastik') || n.includes('bottle') || 
        n.includes('can') || n.includes('aluminium') || n.includes('botol')) {
        return 'Plastik / Aluminium';
    }
    
    return rawName; // Return original if no match found
};

export function useSubmissionReviews() {
    const reviews = ref<SubmissionReview[]>([]);
    const loading = ref(false);
    const isHarvesting = ref(false);

    const fetchReviews = async () => {
        loading.value = true;
        const { data, error } = await supabase
            .from('submission_reviews')
            .select(`*, users(nickname, avatar_url)`)
            .order('submitted_at', { ascending: false });
        
        if (!error && data) {
            reviews.value = data as SubmissionReview[];
        }
        loading.value = false;
    };

    const harvestNewSubmissions = async () => {
        isHarvesting.value = true;
        try {
            const { data: users } = await supabase.from('users').select('id, phone');
            if (!users) return;

            const machineCache: Record<string, any[]> = {};

            for (const user of users) {
                const apiRecords = await getUserRecords(user.phone, 1, 10);
                
                for (const record of apiRecords) {
                    console.log(`🔍 PROCESSING: Machine ${record.deviceNo}`);

                    await processPotentialCleaning(record);

                    const { data: existing } = await supabase
                        .from('submission_reviews')
                        .select('id')
                        .eq('vendor_record_id', record.id)
                        .maybeSingle();

                    if (!existing) {
                        // --- MATCHING LOGIC START ---
                        
                        // 1. EXTRACT DETAILS FROM NESTED LIST
                        // The API hides the real data inside 'rubbishLogDetailsVOList'
                        let detailName = "";
                        let detailPositionId = "";
                        
                        if (record.rubbishLogDetailsVOList && record.rubbishLogDetailsVOList.length > 0) {
                            const detail = record.rubbishLogDetailsVOList[0];
                            detailName = detail.rubbishName || "";
                            detailPositionId = detail.positionId || "";
                        }

                        // 2. Get Config
                        if (!machineCache[record.deviceNo]) {
                            const config = await getMachineConfig(record.deviceNo);
                            machineCache[record.deviceNo] = (config && config.data) ? config.data : [];
                        }
                        const machineBins = machineCache[record.deviceNo] || [];
                        
                        let finalWasteType = "Unknown";
                        let matchedBin = null;

                        // 3. IDENTIFY WASTE TYPE
                        
                        // Strategy A: Use the Name from the Details List (Most Reliable)
                        if (detailName) {
                            finalWasteType = detectWasteType(detailName);
                        } 
                        
                        // Strategy B: Use Position ID if Name failed
                        else if (detailPositionId) {
                            if (UCO_DEVICE_IDS.includes(record.deviceNo)) {
                                finalWasteType = 'UCO';
                            } else {
                                if (String(detailPositionId) === '2') finalWasteType = 'Paper';
                                else if (String(detailPositionId) === '1') finalWasteType = 'Plastik / Aluminium';
                            }
                        }

                        // 4. FIND RATE (Using Matched Bin)
                        // Try to find the official bin config to get the price/rate
                        matchedBin = machineBins.find((bin: any) => {
                            // Match by ID
                            if (detailPositionId && (String(bin.rubbishType) === String(detailPositionId) || String(bin.id) === String(detailPositionId))) {
                                return true;
                            }
                            // Match by Name
                            const binName = bin.rubbishTypeName?.toLowerCase() || '';
                            return binName.includes(finalWasteType.toLowerCase());
                        });

                        let finalRate = 0;
                        if (matchedBin) {
                            finalRate = matchedBin.integral > 0 ? matchedBin.integral : matchedBin.amount;
                            // Optional: Use official name if we prefer it over our detected name
                            // finalWasteType = matchedBin.rubbishTypeName; 
                        } else {
                            // Implied Rate
                            if (record.weight > 0) {
                                const totalVal = Number(record.integral) || Number(record.amount) || 0;
                                finalRate = totalVal / Number(record.weight);
                            }
                        }
                        // --- MATCHING LOGIC END ---

                        // E. Calculate Theoretical Weight
                        const safeTypeStr = finalWasteType || 'plastic';
                        const typeKey = safeTypeStr.toLowerCase().split('/')[0]?.trim() || 'plastic';
                        const unitWeight = THEORETICAL_CONSTANTS[typeKey] || 0.05;
                        const theoretical = (Number(record.weight) / unitWeight) * unitWeight; 

                        const { error } = await supabase.from('submission_reviews').insert({
                            vendor_record_id: record.id,
                            user_id: user.id,
                            phone: user.phone,
                            device_no: record.deviceNo,
                            waste_type: finalWasteType, 
                            api_weight: record.weight,
                            photo_url: record.imgUrl, 
                            submitted_at: record.createTime,
                            theoretical_weight: theoretical.toFixed(3),
                            rate_per_kg: finalRate.toFixed(4), 
                            status: 'PENDING',
                            bin_weight_snapshot: record.positionWeight || 0, 
                            machine_given_points: record.integral || 0
                        });

                        if (error) console.error("Insert Error:", error.message);
                    }
                }
            }
            await fetchReviews();
        } catch (err) {
            console.error("Harvesting failed:", err);
        } finally {
            isHarvesting.value = false;
        }
    };

    const smartFetchAndVerify = async () => {
        if (isHarvesting.value) return;
        
        // A. Run the standard harvest
        await harvestNewSubmissions();

        // B. Identify users who need verification (PENDING status)
        const pendingUsers = new Set<string>();
        reviews.value.forEach(r => {
            if (r.status === 'PENDING' && r.user_id && r.phone) {
                pendingUsers.add(`${r.user_id}|${r.phone}`);
            }
        });

        if (pendingUsers.size > 0) {
            console.log(`🔄 Auto-Verifying ${pendingUsers.size} users...`);
            for (const userKey of pendingUsers) {
                const [uid, phone] = userKey.split('|');
                if (uid && phone) {
                    await verifyUserSubmissions(uid, phone);
                }
            }
            // C. Final Refresh to show green badges
            await fetchReviews();
            console.log("✅ Verification Complete");
        }
    };

    // 3. Verify Submission (Add Points)
    const verifySubmission = async (reviewId: string, finalWeight: number, currentRate: number) => {
        try {
            const finalPoints = finalWeight * currentRate;

            // A. Update Review Record
            const { error: reviewError } = await supabase
                .from('submission_reviews')
                .update({
                    status: 'VERIFIED',
                    confirmed_weight: finalWeight,
                    calculated_points: finalPoints,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reviewId);

            if (reviewError) throw reviewError;

            // B. Add Points to User's Wallet (Atomic Increment)
            // Note: We need a stored procedure for atomic increments strictly, 
            // but for now we read-modify-write or assume the API sync handles the 'lifetime' total.
            // actually, since "Lifetime Points" comes from Hardware, we might just be 'Marking' this as paid.
            // If the hardware points are separate from these points, we update local DB:
            
            // For now, let's just mark the review as done. 
            // The User's 'Lifetime Points' usually come from the machine API directly.
            // IF this is an EXTRA manual verification system, you update a local 'verified_points' column.
            
            await fetchReviews();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const rejectSubmission = async (reviewId: string, reason: string) => {
        try {
            const { error } = await supabase
                .from('submission_reviews')
                .update({
                    status: 'REJECTED',
                    confirmed_weight: 0, // No weight
                    calculated_points: 0, // No points
                    reviewer_note: reason, // Save the reason
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reviewId);

            if (error) throw error;
            await fetchReviews();
            return true;
        } catch (err) {
            console.error("Rejection failed:", err);
            return false;
        }
    };

    // 4. Cleanup Old Data
    const cleanupOldData = async (months: number) => {
        try {
            const { data, error } = await supabase
                .rpc('delete_old_submissions', { months_to_keep: months });

            if (error) throw error;
            return data; // Returns number of rows deleted
        } catch (err) {
            console.error("Cleanup failed:", err);
            return -1;
        }
    };

    return { 
        reviews, 
        loading, 
        isHarvesting, 
        fetchReviews,   
        harvestNewSubmissions,
        smartFetchAndVerify,
        verifySubmission,
        cleanupOldData,
        rejectSubmission
    };
}