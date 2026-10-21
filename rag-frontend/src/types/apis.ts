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

// Used by both forgot-password and resend-verification: the backend
// identifies a person by organization account id plus email.
export interface AccountVerificationPayload {
  account_id: string;
  email: string;
}

export interface ForgotPasswordData {
  email: string;
  account_id: string;
  message: string;
  expires_at?: string;
}

export interface ResetPasswordByEmailPayload {
  token: string;
  new_password: string;
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
  sources?: { id: string; title: string; pages: number[] }[] | null;
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
  // Messages
  total_queries: number;
  total_messages: number;

  // Index health: only 'trained' documents are actually searchable.
  documents_trained: number;
  documents_training: number;
  documents_untrained: number;
  documents_failed: number;

  // Knowledge base size
  total_chunks: number;
  indexed_pages: number;
  storage_bytes: number;

  // Answer quality
  answered_queries: number;
  unanswered_queries: number;
  answer_rate: number;

  // Engagement, as distinct from seats
  active_users_30d: number;

  // Load (self-hosted inference has no per-token cost)
  total_prompt_tokens: number;
  total_completion_tokens: number;

  unanswered_questions: UnansweredQuestion[];
  top_documents: DocumentUsage[];

  last_30_days: DailyActivity[];
}

export interface UnansweredQuestion {
  question: string;
  asked_at: string;
}

export interface DocumentUsage {
  title: string;
  citations: number;
}

export interface UserListParams {
  page: number;
  limit: number;
  search?: string;
}

export interface PaginatedUsers {
  users: IUser[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface UserStats {
  total_users: number;

  owners: number;
  maintainers: number;
  members: number;

  active: number;
  pending: number;
  suspended: number;

  active_users_7d: number;

  total_queries: number;
  avg_queries_per_user: number;
}

export interface UpdateUserRolePayload {
  userId: string;
  role: Exclude<TUSER_ROLE, "owner">;
}

export interface DocumentListParams {
  page: number;
  limit: number;
  search?: string;
}

export interface PaginatedDocuments {
  documents: IDocumentResource[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/** Org-wide usage plus the limits it is measured against, served by the API
 *  so the numbers live in one place rather than being mirrored client-side. */
export interface DocumentStats {
  used_count: number;
  used_bytes: number;

  trained: number;
  training: number;
  untrained: number;
  failed: number;

  max_documents: number;
  max_storage_bytes: number;
  max_file_size_bytes: number;
}

export interface RejectedUpload {
  file_name: string;
  reason: string;
}

export interface UploadResult {
  uploaded: IDocumentResource[];
  rejected: RejectedUpload[];
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
  profile_image_url?: string;
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
