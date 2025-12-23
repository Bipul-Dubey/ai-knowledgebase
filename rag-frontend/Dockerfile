# Stage 1: Build the Next.js app
FROM node:22.19-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

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
