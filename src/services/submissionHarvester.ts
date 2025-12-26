import { supabase } from '../services/supabase'; // Adjust path as needed
import { getUserRecords, getMachineConfig } from '../services/autogcm'; // Adjust path
import { THEORETICAL_CONSTANTS, UCO_DEVICE_IDS, detectWasteType } from '../utils/wasteUtils';

// This function scrapes the Hardware API and inserts missing records into Supabase
export const runHarvester = async () => {
    try {
        console.log("🚜 Starting Harvest...");
        
        // 1. Get Users to check
        const { data: users } = await supabase.from('users').select('id, phone');
        if (!users) return;

        const machineCache: Record<string, any[]> = {};

        for (const user of users) {
            // Fetch last 10 records from Hardware API
            const apiRecords = await getUserRecords(user.phone, 1, 10);
            
            for (const record of apiRecords) {
                // Check if we already have this record
                const { data: existing } = await supabase
                    .from('submission_reviews')
                    .select('id')
                    .eq('vendor_record_id', record.id)
                    .maybeSingle();

                if (!existing) {
                    console.log(`✨ New Record Found: ${record.id} for device ${record.deviceNo}`);
                    await processSingleRecord(record, user, machineCache);
                }
            }
        }
    } catch (err) {
        console.error("Harvesting failed:", err);
        throw err;
    }
};

// Helper to process one API record
async function processSingleRecord(record: any, user: any, machineCache: Record<string, any[]>) {
    let detailName = "";
    let detailPositionId = "";
    
    // 1. Extract Details
    if (record.rubbishLogDetailsVOList && record.rubbishLogDetailsVOList.length > 0) {
        const detail = record.rubbishLogDetailsVOList[0];
        detailName = detail.rubbishName || "";
        detailPositionId = detail.positionId || "";
    }

    // 2. Get/Cache Machine Config
    if (!machineCache[record.deviceNo]) {
        const config = await getMachineConfig(record.deviceNo);
        machineCache[record.deviceNo] = (config && config.data) ? config.data : [];
    }
    const machineBins = machineCache[record.deviceNo] || [];

    // 3. Identify Waste Type
    let finalWasteType = "Unknown";
    if (detailName) {
        finalWasteType = detectWasteType(detailName);
    } else if (detailPositionId) {
        if (UCO_DEVICE_IDS.includes(record.deviceNo)) finalWasteType = 'UCO';
        else if (String(detailPositionId) === '2') finalWasteType = 'Paper';
        else if (String(detailPositionId) === '1') finalWasteType = 'Plastik / Aluminium';
    }

    // 4. Find Rate
    let finalRate = 0;
    const matchedBin = machineBins.find((bin: any) => {
        if (detailPositionId && (String(bin.rubbishType) === String(detailPositionId))) return true;
        const binName = bin.rubbishTypeName?.toLowerCase() || '';
        return binName.includes(finalWasteType.toLowerCase());
    });

    if (matchedBin) {
        finalRate = matchedBin.integral > 0 ? matchedBin.integral : matchedBin.amount;
    } else if (record.weight > 0) {
        const totalVal = Number(record.integral) || Number(record.amount) || 0;
        finalRate = totalVal / Number(record.weight);
    }

    // 5. Calculate Theoretical
    const safeTypeStr = finalWasteType || 'plastic';
    const typeKey = safeTypeStr.toLowerCase().split('/')[0]?.trim() || 'plastic';
    const unitWeight = THEORETICAL_CONSTANTS[typeKey] || 0.05;
    const theoretical = (Number(record.weight) / unitWeight) * unitWeight;

    // 6. Insert into DB
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
        machine_given_points: record.integral || 0,
        source: 'FETCH' // Distinct from WEBHOOK
    });

    if (error) console.error("Insert Error:", error.message);
}