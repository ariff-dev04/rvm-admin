<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useMachineStore } from '../stores/machines';
import { useDashboardStats } from '../composables/useDashboardStats';
import { storeToRefs } from 'pinia';
import { 
  AlertCircle, Server, Coins, Scale, Activity, 
  Recycle, Brush, CheckCircle2
} from 'lucide-vue-next';
import StatsCard from '../components/StatsCard.vue';

// Init
const machineStore = useMachineStore();
const { machines, loading: machineLoading } = storeToRefs(machineStore);

const { 
  loading: statsLoading, 
  pendingCount, 
  totalPoints, 
  totalWeight, 
  recentWithdrawals,
  recentSubmissions, // ♻️
  recentCleaning,    // 🧹
  fetchStats 
} = useDashboardStats();

const onlineMachinesCount = computed(() => machines.value.filter((m) => m.isOnline).length);

// Helper for status colors
const getStatusColor = (status: string) => {
  const map: any = {
    'PENDING': 'bg-amber-100 text-amber-700',
    'APPROVED': 'bg-green-100 text-green-700',
    'VERIFIED': 'bg-green-100 text-green-700',
    'REJECTED': 'bg-red-100 text-red-700',
    'PAID': 'bg-blue-100 text-blue-700',
    'COMPLETED': 'bg-blue-100 text-blue-700'
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

onMounted(() => {
  machineStore.fetchMachines();
  fetchStats();
});

const formatNumber = (num: number) => num.toLocaleString(undefined, { maximumFractionDigits: 1 });
</script>

<template>
  <div class="space-y-8 p-6">
    
    <div v-if="statsLoading && machines.length === 0" class="flex h-64 items-center justify-center">
      <div class="text-gray-400 animate-pulse font-medium">Loading Dashboard...</div>
    </div>

    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Pending Withdrawals" :value="pendingCount" color="amber" description="Action Required">
          <template #icon><AlertCircle :size="24" /></template>
        </StatsCard>
        <StatsCard title="Online Machines" :value="machineLoading ? '...' : onlineMachinesCount" color="green" description="Active Units">
          <template #icon><Server :size="24" /></template>
        </StatsCard>
        <StatsCard title="Total Points" :value="formatNumber(totalPoints)" color="blue" description="Lifetime Value">
          <template #icon><Coins :size="24" /></template>
        </StatsCard>
        <StatsCard title="Recycled Weight" :value="`${formatNumber(totalWeight)} kg`" color="purple" description="Environmental Impact">
          <template #icon><Scale :size="24" /></template>
        </StatsCard>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Recycle :size="20" class="text-green-600"/> Live Recycling
            </h3>
            <router-link to="/submissions" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
          </div>
          <div class="flex-1 space-y-4">
            <div v-for="s in recentSubmissions" :key="s.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div class="h-10 w-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                 <Scale :size="18" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ s.users?.nickname || 'Guest' }}</p>
                <p class="text-xs text-gray-500">Recycled {{ s.api_weight }}kg</p>
              </div>
              <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase" :class="getStatusColor(s.status)">
                {{ s.status }}
              </span>
            </div>
            <div v-if="recentSubmissions.length === 0" class="text-center py-6 text-gray-400 text-sm">No recent recycling</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Brush :size="20" class="text-purple-600"/> Cleaning Logs
            </h3>
            <router-link to="/cleaning-logs" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
          </div>
          <div class="flex-1 space-y-4">
            <div v-for="c in recentCleaning" :key="c.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div class="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                 <CheckCircle2 :size="18" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ c.machines?.deviceName || 'Unknown Machine' }}</p>
                <p class="text-xs text-gray-500">{{ new Date(c.created_at).toLocaleDateString() }}</p>
              </div>
              <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase bg-gray-100 text-gray-600">
                Verified
              </span>
            </div>
            <div v-if="recentCleaning.length === 0" class="text-center py-6 text-gray-400 text-sm">No logs found</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Coins :size="20" class="text-amber-600"/> Withdrawals
            </h3>
            <router-link to="/withdrawals" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
          </div>
          <div class="flex-1 space-y-4">
             <div v-for="w in recentWithdrawals" :key="w.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div class="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                 <img v-if="w.users?.avatar_url" :src="w.users.avatar_url" class="h-full w-full object-cover" />
                 <span v-else class="text-sm">👤</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ w.users?.nickname || 'User' }}</p>
                <p class="text-xs font-bold text-red-400">-{{ w.amount }} pts</p>
              </div>
              <div class="text-right">
                <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase block w-fit ml-auto" :class="getStatusColor(w.status)">
                  {{ w.status }}
                </span>
                <span class="text-[10px] text-gray-400 mt-1 block">{{ new Date(w.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</span>
              </div>
            </div>
            <div v-if="recentWithdrawals.length === 0" class="text-center py-6 text-gray-400 text-sm">No activity</div>
          </div>
        </div>

      </div> <div class="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <Activity class="text-green-600" :size="20" />
          <h3 class="text-sm font-bold text-gray-900">System Health</h3>
          <span class="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100 flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            All Systems Operational
          </span>
        </div>
        <div class="text-xs text-gray-400">Last synced: {{ new Date().toLocaleTimeString() }}</div>
      </div>

    </div>
  </div>
</template>