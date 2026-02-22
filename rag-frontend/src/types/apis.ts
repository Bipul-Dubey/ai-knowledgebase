export interface ApiResponse<T> {
  error: boolean;
  message: string;
  data: T | null;
  status: number;
}

//

export type TUSER_ROLE = "owner" | "maintainer" | "member";
export type TUSER_STATUS = "pending" | "active" | "suspended";

export type TDOCUMENT_STATUS = "untrained" | "training" | "trained" | "failed";

// ======================= INTERFACE | TYPE ========================
export interface SignupPayload {
  organization_name: string;
  owner_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  account_id: string;
  email: string;
  password: string;
}

export interface LoginUser {
  access_token: string;
  user_id: string;
  organization_id: string;
  role: string;
  name: string;
  email: string;
  status: string;
  organization_name: string;
}

export interface VerifyAccountPayload {
  token: string;
}

export interface VerifyAccountData {
  user_id: string;
  email: string;
  status: string;
  is_verified: boolean;
  organization_id: string;
}

export interface IOrganizationDetails {
  organization_id: string;
  account_id: number;
  name: string;
  status: "active" | "inactive" | "pending";

  created_at: string;
  updated_at: string;

  total_users: number;
  total_maintainers: number;
  total_members: number;

  owner_email?: string;

  created_by_user_id?: string;
  created_by_user_name?: string;
}

export interface IConversation {
  id: string;
  title: string;
  last_message_at: string;
}

export interface IBackendMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface IChatMessagesPayload {
  messages: IBackendMessage[];
}

export interface IDocumentResource {
  id: string;
  file_name: string;
  type: string;
  url: string;
  status: TDOCUMENT_STATUS;
  created_at: string;
  last_trained_at: string;
  file_size: number;
}

export interface DailyActivity {
  date: string;
  total_chats: number;
  total_messages: number;
}

export interface DashboardStatsResponse {
  organization_name: string;
  user_name: string;
  user_role: string;
  // Users
  total_users: number;
  active_users: number;
  // Documents
  total_documents: number;
  active_documents: number;
  // Chats
  total_chats: number;
  active_chats: number;
  // Messages & Cost
  total_queries: number;
  total_messages: number;
  total_cost: number;

  last_30_days: DailyActivity[];
}

export interface TrainDocumentsPayload {
  document_ids: string[];
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: TUSER_ROLE;
  status: TUSER_STATUS;
  created_at: string;
  profile?: string;
}

export interface InviteUserPayload {
  email: string;
  role: Exclude<TUSER_ROLE, "owner">;
  name: string;
}

export interface AcceptInvitePayload {
  token: string;
  name: string;
  email: string;
  account_id: string;
  password: string;
}

export interface IDownloadUrlResponse {
  url: string;
  expires_at: number; // timestamp
}
