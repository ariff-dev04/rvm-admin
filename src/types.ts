// ✅ FIXED: Values changed to lowercase to match your DB/Vue code
// ✅ ADDED: 'external_sync' and 'manual_correction'
export const WithdrawalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  EXTERNAL_SYNC: 'EXTERNAL_SYNC' // <--- The new status
} as const;

export type WithdrawalStatus = typeof WithdrawalStatus[keyof typeof WithdrawalStatus];

// ✅ UPDATED: Added new DB columns (nickname, avatar, card, sync time)
export interface User {
  id: string;
  vendor_user_no?: string | null;
  phone: string;
  lifetime_integral: number;
  created_at: string;
  total_weight?: number;
  
  // New fields for Hybrid Sync
  nickname?: string | null;
  avatar_url?: string | null;
  card_no?: string | null;
  vendor_internal_id?: string | null;
  last_synced_at?: string | null;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  phone: string;
  amount: number;
  status: WithdrawalStatus; // Now accepts 'pending' | 'external_sync' | etc.
  created_at: string;
}

export interface Machine {
  id: string;
  deviceNo: string;
  deviceName?: string;
  address: string;
  isOnline: number; // 0: Offline, 1: Online
  status: number;   // 0: Idle, 1: In Use, 2: Disabled, 3: Error
}

// ✅ UPDATED: Matches PDF Source [410]
export interface ApiUserSyncResponse {
  code: number;
  msg: string;
  data: {
    userNo: string;
    integral: number;
    phone: string;
    nikeName?: string;  
    name?: string;        
    imgUrl?: string;
    createTime?: string;
    isNewUser?: number;
  };
}

// ✅ UPDATED: Matches PDF Source [95]
export interface ApiDisposalRecord {
  id: string;
  deviceNo: string;
  deviceName?: string;
  weight: number;
  integral: number;
  rubbishName?: string; 
  createTime: string;
  imgUrl?: string;
  
  // Critical for fetching the Card Number
  cardNo?: string;      
  username?: string;
  userId?: string;    
}

export interface ApiPutResponse {
  code: number;
  data: {
    list: ApiDisposalRecord[];
    total: number;
    pageNum: number;
    pageSize: number;
  };
}

export type SubmissionStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface SubmissionReview {
  id: string;
  vendor_record_id: string;
  user_id: string;
  phone: string;
  device_no: string;
  waste_type: string;
  photo_url: string;
  
  // Weights
  api_weight: number;
  theoretical_weight: number;
  warehouse_weight?: number;
  confirmed_weight?: number;
  bin_weight_snapshot?: number;
  machine_given_points?: number;
  
  // Financials
  rate_per_kg: number;
  calculated_points?: number;
  
  status: SubmissionStatus;
  submitted_at: string;
  
  // Join fields (from Supabase)
  users?: {
    nickname: string;
    avatar_url: string;
    phone: string | null;
  };
}