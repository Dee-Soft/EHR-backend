# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Build
FROM node:24-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Stage 3: Production
FROM node:24-alpine AS runner
WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --from=builder /app .

# Create logs directory
RUN mkdir -p /app/logs

# Set permissions for key files if they exist
RUN if [ -d "config/keys" ]; then \
      find config/keys -type f -name "*.pem" -exec chmod 600 {} \; ; \
    fi

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --spider -q http://localhost:3001/api/health/live || exit 1

# Start application
CMD ["node", "server.js"]
