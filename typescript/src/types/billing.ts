export interface Balance {
  available: string;
  locked: string;
  pending: string;
  currency: string;
}

export interface Transaction {
  uid: string;
  type: string;
  amount: string;
  currency: string;
  description?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
