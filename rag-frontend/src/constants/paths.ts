export const PATHS = {
  pl: {
    LOGIN: "/pl",
    REGISTER: "/pl/register",
    FORGOT_PASSWORD: "/pl/forgot-password",
    RESET_PASSWORD: "/pl/reset-password",
    VERIFY_ACCOUNT: (token: string, accountId: string) =>
      `/pl/verify-account?token=${token}&account_id=${accountId}`,

    DASHBOARD: (orgId: string) => `/pl/${orgId}/analytics`,
    USERS: `/pl/:orgId/users`,
    ANALYTICS: `/pl/:orgId/analytics`,
    DOCUMENTS: `/pl/:orgId/documents`,
    SETTINGS: `/pl/:orgId/settings`,

    // chats
    NEW_CHAT: (orgId: string) => `/pl/${orgId}/c`,
    CHAT: (orgId: string, chatId: string) => `/pl/${orgId}/c/${chatId}`,
    PROFILE: (orgId: string) => `/pl/${orgId}/profile`,
  },
};
