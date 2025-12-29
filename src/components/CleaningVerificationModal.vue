<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Check, Ban, AlertTriangle, Scale, Image as ImageIcon } from 'lucide-vue-next';
import { getEvidencePhotos } from '../utils/wasteUtils'; // <--- 1. Import the helper

const props = defineProps<{
  isOpen: boolean;
  record: any;
  isProcessing: boolean;
}>();

const emit = defineEmits(['close', 'approve', 'reject']);

const rejectMode = ref(false);
const rejectReason = ref('');

// 2. Use the helper (Cleaner & Safer)
const evidencePhoto = computed(() => {
    if (!props.record?.photo_url) return null;
    // The helper fixes URL issues automatically
    const { before } = getEvidencePhotos(props.record.photo_url);
    return before;
});

const handleConfirm = () => {
    if (rejectMode.value) {
        emit('reject', rejectReason.value || 'No reason provided');
    } else {
        emit('approve');
    }
};


const reset = () => {
    rejectMode.value = false;
    rejectReason.value = '';
    emit('close');
};
</script>

<template>
  <div v-if="isOpen && record" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col md:flex-row h-full md:h-[500px]">
      
      <div class="w-full md:w-1/2 bg-gray-900 flex flex-col justify-center relative p-4">
        <div class="absolute top-4 left-4 z-10 bg-black/60 text-white text-[10px] uppercase font-bold px-2 py-1 rounded backdrop-blur-md">
            Before Collection State
        </div>
        
        <div class="w-full h-full flex items-center justify-center">
            <img v-if="evidencePhoto" :src="evidencePhoto" class="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
            <div v-else class="flex flex-col items-center text-gray-500">
                <ImageIcon :size="48" class="mb-2 opacity-50" />
                <span>No Evidence Photo</span>
            </div>
        </div>
      </div>

      <div class="w-full md:w-1/2 p-8 flex flex-col bg-white">
        <div class="flex justify-between items-start mb-6">
          <h3 class="text-xl font-bold" :class="rejectMode ? 'text-red-600' : 'text-gray-900'">
             {{ rejectMode ? 'Reject Operation' : 'Verify Cleaning' }}
          </h3>
          <button @click="reset" class="p-1 hover:bg-gray-100 rounded-full"><X :size="24" class="text-gray-400" /></button>
        </div>

        <div class="space-y-6 flex-1">
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 text-sm">Machine ID</span>
                    <span class="font-mono font-medium text-gray-900">{{ record.device_no }}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 text-sm">Waste Type</span>
                    <span class="font-medium text-gray-900">{{ record.waste_type }}</span>
                </div>
                <div class="border-t border-gray-200 my-2"></div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 text-sm font-bold flex items-center">
                        <Scale :size="14" class="mr-1" /> Collected Weight
                    </span>
                    <span class="text-xl font-bold text-emerald-600">{{ record.bag_weight_collected }} kg</span>
                </div>
            </div>

            <div v-if="rejectMode" class="animate-in fade-in slide-in-from-bottom-2">
                <label class="block text-xs font-bold text-red-700 uppercase mb-2">Reason for Rejection</label>
                <textarea 
                    v-model="rejectReason"
                    class="w-full border-2 border-red-100 rounded-xl p-3 focus:border-red-400 outline-none text-sm h-24 resize-none"
                    placeholder="E.g. False detection, weight mismatch, maintenance test..."
                ></textarea>
            </div>
            
            <div v-else class="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start">
                <AlertTriangle :size="16" class="text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                Verify that the bag was actually full based on the photo and weight data before approving.
            </div>
        </div>

        <div class="mt-auto pt-6 flex gap-3">
            <button 
                v-if="!rejectMode" 
                @click="rejectMode = true"
                class="px-4 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium flex items-center"
            >
                <Ban :size="18" class="mr-2" /> Reject
            </button>
            <button 
                v-else 
                @click="rejectMode = false"
                class="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
            >
                Back
            </button>

            <button 
                @click="handleConfirm" 
                :disabled="isProcessing"
                :class="`flex-1 py-3 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center ${rejectMode ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`"
            >
                <span v-if="isProcessing" class="animate-pulse">Saving...</span>
                <span v-else class="flex items-center">
                    <Check v-if="!rejectMode" :size="18" class="mr-2" />
                    {{ rejectMode ? 'Confirm Rejection' : 'Approve Cleaning' }}
                </span>
            </button>
        </div>

      </div>
    </div>
  </div>
</template>