import { ref } from 'vue';
import { supabase } from '../services/supabase';
import type { SubmissionReview } from '../types';
import { runHarvester } from '../services/submissionHarvester'; 

export function useSubmissionReviews() {
    const reviews = ref<SubmissionReview[]>([]);
    const loading = ref(false);
    const isHarvesting = ref(false);

    // 1. Fetch List
    const fetchReviews = async () => {
        loading.value = true;
        const { data, error } = await supabase
            .from('submission_reviews')
            // 🔥 FIX 1: Added 'phone' to the joined users query
            .select(`*, users(nickname, avatar_url, phone)`) 
            .order('submitted_at', { ascending: false });
        
        if (!error && data) {
            reviews.value = data as SubmissionReview[];
        }
        loading.value = false;
    };

    // 2. Trigger Harvester
    const harvestNewSubmissions = async () => {
        isHarvesting.value = true;
        try {
            await runHarvester(); 
            await fetchReviews(); 
        } catch (err) {
            console.error("Harvest failed:", err);
        } finally {
            isHarvesting.value = false;
        }
    };

    // 3. Verify Logic
    const verifySubmission = async (reviewId: string, finalWeight: number, currentRate: number) => {
        try {
            const finalPoints = finalWeight * currentRate;
            const { error } = await supabase
                .from('submission_reviews')
                .update({
                    status: 'VERIFIED',
                    confirmed_weight: finalWeight,
                    calculated_points: finalPoints,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reviewId);

            if (error) throw error;
            await fetchReviews();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    // 4. Reject Logic
    const rejectSubmission = async (reviewId: string, reason: string) => {
        try {
            const { error } = await supabase
                .from('submission_reviews')
                .update({
                    status: 'REJECTED',
                    confirmed_weight: 0,
                    calculated_points: 0,
                    reviewer_note: reason,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reviewId);

            if (error) throw error;
            await fetchReviews();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const smartFetchAndVerify = async () => {
        await harvestNewSubmissions();
    };
    
    const cleanupOldData = async (months: number) => {
         try {
            const { data, error } = await supabase.rpc('delete_old_submissions', { months_to_keep: months });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error(err);
            return -1;
        }
    }

    return { 
        reviews, 
        loading, 
        isHarvesting, 
        fetchReviews,   
        smartFetchAndVerify,
        harvestNewSubmissions, // 🔥 FIX 2: Explicitly export this
        verifySubmission,
        rejectSubmission,
        cleanupOldData
    };
}