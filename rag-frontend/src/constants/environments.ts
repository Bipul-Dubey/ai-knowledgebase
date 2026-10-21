/**
 * NEXT_PUBLIC_* values are inlined by `next build` and cannot change at
 * runtime. If one is missing when the bundle is built, every API call
 * resolves against the frontend's own origin and 404s with no useful error -
 * so this fails the production build instead of shipping a broken bundle.
 *
 * Local dev reads rag-frontend/.env.local (NOT the repo-root .env).
 * Docker reads the repo-root .env, passed through as build args by compose.
 */
const required = (name: string, value: string | undefined): string => {
  if (value) return value;

  const message =
    `Missing ${name}. Set it in rag-frontend/.env.local for local dev, ` +
    `or pass it as a Docker build arg (see docker-compose.yml).`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  console.error(`[env] ${message}`);
  return "";
};

export const ENV = {
  BASE_API_URL: required(
    "NEXT_PUBLIC_API_BASE",
    process.env.NEXT_PUBLIC_API_BASE,
  ),
  BASE_API_URL_CHATS: required(
    "NEXT_PUBLIC_API_BASE_CHAT",
    process.env.NEXT_PUBLIC_API_BASE_CHAT,
  ),
};
