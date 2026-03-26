export interface ChainInfo {
  chain_id: number;
  name: string;
  confirmations_required: number;
}

export interface DepositRecord {
  uid: string;
  chain_id: number;
  token: string;
  amount: string;
  tx_hash: string;
  status: "pending" | "confirmed" | "credited";
  created_at: string;
  confirmed_at?: string | null;
}

export interface DepositInfo {
  deposit_address: string;
  chains: ChainInfo[];
  tokens: string[];
  deposits: DepositRecord[];
}

export interface CheckoutSession {
  uid: string;
  chain_id: number;
  currency_id: number;
  amount?: string;
  status: "pending" | "completed" | "cancelled" | "expired";
  payment_address?: string;
  created_at: string;
  expires_at?: string;
}

export interface CheckoutCreateParams {
  chain_id: number;
  currency_id: number;
  amount?: string;
}
