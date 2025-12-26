import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { getMachineConfig } from '../services/autogcm';

export interface DashboardMachine {
  deviceNo: string;
  name: string;
  address: string;
  zone: string;
  maintenanceContact: string;
  googleMapsUrl: string;
  isOnline: boolean;
  statusText: string;
  statusCode: number;
  compartments: any[];
}

// 🔥 CRITICAL: Must be "export const", NOT "export default"
export const useMachineStore = defineStore('machines', () => {
  const machines = ref<DashboardMachine[]>([]);
  const loading = ref(false);
  const lastUpdated = ref<number>(0); 
  const CACHE_DURATION = 5 * 60 * 1000; 

  const mapTypeToLabel = (apiName: string) => {
    if (!apiName) return { label: "General", color: "bg-gray-100 text-gray-600" };
    const lower = apiName.toLowerCase();
    if (lower.includes("oil") || lower.includes("minyak")) return { label: "Oil", color: "bg-orange-100 text-orange-700" };
    if (lower.includes("paper") || lower.includes("kertas")) return { label: "Paper", color: "bg-blue-100 text-blue-700" };
    if (lower.includes("plastic") || lower.includes("can") || lower.includes("botol")) return { label: "Plastic/Can", color: "bg-green-100 text-green-700" };
    return { label: apiName, color: "bg-gray-100 text-gray-600" };
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const fetchMachines = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && machines.value.length > 0 && (now - lastUpdated.value < CACHE_DURATION)) {
      console.log("🟢 Using Cached Machine Data");
      return;
    }

    console.log("🟡 Fetching Fresh Data from China...");
    loading.value = true;
    const tempMachines: DashboardMachine[] = [];

    try {
      // 1. Get List of Machines from Our DB
      const { data: dbMachines, error } = await supabase
        .from('machines')
        .select('*')
        .eq('is_active', true)
        .order('zone', { ascending: true });

      if (error || !dbMachines) throw new Error("DB Error");

      // 2. Loop through each machine
      for (const dbMachine of dbMachines) {
        let apiRes = null;
        
        // Retry Logic for API
        for (let i = 0; i < 2; i++) {
           try {
             apiRes = await getMachineConfig(dbMachine.device_no);
             if (apiRes && apiRes.code === 200) break;
             throw new Error("Bad Response");
           } catch (e) {
             if (i === 0) await sleep(1000);
           }
        }

        const configs = apiRes?.data || [];
        
        let isOnline = false;
        let statusCode = 0; 
        let statusText = "Offline";
        let compartments = [];

        if (apiRes && apiRes.code === 200 && configs.length > 0) {
          isOnline = true; 
          
          // ==========================================================
          // 🔥 NEW: AUTO-SYNC LOGIC
          // ==========================================================
          try {
              // Find Weight for Bin 1 (Plastic/UCO)
              const bin1 = configs.find((c: any) => c.positionNo === 1);
              const weight1 = bin1 ? Number(bin1.weight || 0) : 0;

              // Find Weight for Bin 2 (Paper)
              const bin2 = configs.find((c: any) => c.positionNo === 2);
              const weight2 = bin2 ? Number(bin2.weight || 0) : 0;

              // Update Supabase silently
              await supabase.from('machines').update({
                  current_bag_weight: weight1,
                  current_weight_2: weight2
              }).eq('id', dbMachine.id);
              
              console.log(`✅ Synced DB for ${dbMachine.device_no}: ${weight1}kg / ${weight2}kg`);
          } catch (syncErr) {
              console.warn("Sync failed (non-critical):", syncErr);
          }
          // ==========================================================

          const hasFault = configs.some((c: any) => c.status === 2 || c.status === 3);
          const hasActivity = configs.some((c: any) => c.status === 1);
          const isFull = configs.some((c: any) => c.isFull === true || c.isFull === "true");

          if (isFull) { statusCode = 4; statusText = "Bin Full"; }
          else if (hasFault) { statusCode = 3; statusText = "Maintenance"; }
          else if (hasActivity) { statusCode = 1; statusText = "In Use"; }
          else { statusCode = 0; statusText = "Online"; }

          compartments = configs.map((conf: any) => {
             const style = mapTypeToLabel(conf.rubbishTypeName);
             let percent = conf.rate ? Math.round(conf.rate) : 0;
             if (style.label === "Oil") {
               const currentWeight = Number(conf.weight || 0);
               percent = Math.round((currentWeight / 400) * 100); 
             }
             if (conf.isFull) percent = 100;
             return { ...style, percent, isFull: conf.isFull };
          });
        }

        let mapsUrl = "#";
        if (dbMachine.latitude && dbMachine.longitude) {
           mapsUrl = `http://googleusercontent.com/maps.google.com/?q=${dbMachine.latitude},${dbMachine.longitude}`;
        }

        tempMachines.push({
          deviceNo: dbMachine.device_no,
          name: dbMachine.name,
          address: dbMachine.address,
          zone: dbMachine.zone || 'General',
          maintenanceContact: dbMachine.maintenance_contact || 'Unassigned',
          googleMapsUrl: mapsUrl,
          isOnline,
          statusCode,
          statusText,
          compartments
        });
        
        await sleep(200);
      }

      machines.value = tempMachines;
      lastUpdated.value = Date.now();

    } catch (err) {
      console.error("Store Error:", err);
    } finally {
      loading.value = false;
    }
  };

  return { machines, loading, fetchMachines, lastUpdated };
});