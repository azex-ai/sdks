export interface APIKey {
  uid: string;
  name: string;
  prefix: string;
  status: "active" | "suspended" | "revoked";
  rpm_limit?: number;
  created_at: string;
  last_used_at?: string | null;
  /** Only present on creation */
  key?: string;
}

export interface APIKeyList {
  items: APIKey[];
  total: number;
}

export interface APIKeyCreateParams {
  name: string;
  rpm_limit?: number;
}

export interface APIKeyUpdateParams {
  name?: string;
  rpm_limit?: number;
}
