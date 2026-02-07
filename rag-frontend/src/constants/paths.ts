export const PATHS = {
  pl: {
    LOGIN: "/pl",
    REGISTER: "/pl/register",
    VERIFY_ACCOUNT: (token: string, accountId: string) =>
      `/pl/verify-account?token=${token}&account_id=${accountId}`,

    DASHBOARD: (orgId: string) => `/pl/${orgId}/analytics`,
  },
};
