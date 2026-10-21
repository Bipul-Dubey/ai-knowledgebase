# Stage 1: Build the Next.js app
FROM node:22.19-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# NEXT_PUBLIC_* are inlined by `next build`, so they must exist at build time;
# compose passes them from the repo-root .env as build args.
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_API_BASE_CHAT
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE_CHAT=$NEXT_PUBLIC_API_BASE_CHAT

# Without this the bundle ships `undefined` as its API base and 404s silently.
RUN : "${NEXT_PUBLIC_API_BASE:?is empty - set it in the repo-root .env}" \
 && : "${NEXT_PUBLIC_API_BASE_CHAT:?is empty - set it in the repo-root .env}"

# Build the app for production
RUN npm run build:prod

# Stage 2: Production image
FROM node:22.19-alpine AS runner

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Copy only necessary files to install prod dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy build output and public files from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# Expose the port
EXPOSE 3000

# Start the Next.js production server
CMD ["npm", "run", "start:prod"]
