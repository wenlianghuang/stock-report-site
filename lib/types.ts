export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type ReportStatus =
  | "queued"
  | "fetching"
  | "gating"
  | "done"
  | "failed";

export type ReportRecord = {
  id: string;
  userId: string;
  stockId: string;
  agentJobId: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  tradeDate?: string;
  error?: string;
};

export type DbShape = {
  users: User[];
  reports: ReportRecord[];
};

export type AgentJob = {
  id: string;
  stock_id: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  trade_date?: string | null;
  error?: string | null;
  markdown?: string | null;
  md_path?: string | null;
  csv_path?: string | null;
};
