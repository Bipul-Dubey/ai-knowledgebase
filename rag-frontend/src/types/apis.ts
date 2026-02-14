export interface ApiResponse<T> {
  error: boolean;
  message: string;
  data: T | null;
  status: number;
}

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

export interface OrganizationDetails {
  organization_id: string;
  account_id: number;
  name: string;
  status: "active" | "inactive";
  created_at: string;
  total_users: number;
  owner_email: string;
  created_by_user_id: string;
  created_by_user_name: string;
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
  status: "untrained" | "training" | "active" | "trained";
  created_at: string;
  last_trained_at: string;
  file_size: number;
}
