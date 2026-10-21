/**
 * NEXT_PUBLIC_* are inlined by `next build`. A missing value makes every API
 * call resolve against the frontend's own origin, so fail the build instead.
 *
 * Dev reads rag-frontend/.env.local; Docker gets build args from the root .env.
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
