# Multi-stage Dockerfile for Mastra Harvester on Google Cloud Run
# Optimized for Turborepo monorepo with workspace dependencies

# Stage 1: Alpine base with Node.js
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

# Install Turborepo globally
RUN npm install -g turbo


# Stage 2: Prune the monorepo to only include harvester dependencies
FROM base AS pruner
COPY . .
# Prune monorepo for harvester app with Docker optimization
RUN turbo prune harvester --docker


# Stage 3: Install dependencies and build
FROM base AS builder
WORKDIR /app

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

# Install dependencies (will be cached unless package.json changes)
RUN npm ci

# Copy pruned source code
COPY --from=pruner /app/out/full/ .

# Build workspace packages first (@roz/models, @roz/supabase)
# Then build harvester app
RUN npm run build --workspace=@roz/supabase
RUN npm run build --workspace=@roz/models
RUN npm run build --workspace=harvester


# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 mastra

# Copy built artifacts from builder
COPY --from=builder --chown=mastra:nodejs /app .

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Switch to non-root user
USER mastra

# Expose port (Cloud Run sets PORT env variable)
EXPOSE 8080

# Set Node environment to production
ENV NODE_ENV=production

# Health check endpoint (ES modules compatible)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node --input-type=module -e "import http from 'http'; http.get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Mastra production server
CMD ["npm", "start", "--workspace=harvester"]
