export const PATHS = {
  pl: {
    LOGIN: "/pl",
    REGISTER: "/pl/register",
    VERIFY_ACCOUNT: (token: string, accountId: string) =>
      `/pl/verify-account?token=${token}&account_id=${accountId}`,

    DASHBOARD: (orgId: string) => `/pl/${orgId}/analytics`,

    // chats
    NEW_CHAT: (orgId: string) => `/pl/${orgId}/c`,
    CHAT: (orgId: string, chatId: string) => `/pl/${orgId}/c/${chatId}`,
  },
};
