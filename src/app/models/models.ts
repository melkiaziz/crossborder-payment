// ============================================
// 🏦 MODELS - TypeScript Interfaces
// ============================================

export interface Bank {
  id?: number;
  wallet_address: string;
  name: string;
  country: string;
  currency: string;
  balance?: string;
  tx_hash?: string;
  created_at?: string;
}

export interface Transaction {
  id: number;
  from_bank: string;
  to_bank: string;
  original_amount: string;
  converted_amount: string;
  fee: string;
  tx_hash?: string;
  block_number?: number;
  created_at: string;
}

export interface PendingTransfer {
  id: number;
  transfer_id: number;
  from_bank: string;
  to_bank: string;
  amount: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  created_at: string;
}

export interface Stats {
  totalBanks: number;
  totalTransactions: number;
  pendingTransfers: number;
  totalVolume: string;
  totalFees: string;
}

export interface ContractInfo {
  contractAddress: string;
  owner: string;
  rates: {
    eurToTnd: string;
    usdToTnd: string;
  };
  transferFeePercent: number;
  dailyLimit: string;
  approvalThreshold: string;
  statistics: {
    pendingTransfers: number;
    totalTransactions: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  total?: number;
  error?: string;
  message?: string;
}
