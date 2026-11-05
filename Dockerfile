# ==============================================================================
# OmniNet Enterprise NCM — Official Production Dockerfile
# Multi-Vendor Network Configuration, Topology & Autonomous AI RCA Platform
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy application source & build production frontend bundle
COPY . .
RUN npm run build

# ==============================================================================
# Production Runtime Image
# ==============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

# Install network diagnostic tools (iputils, bind-tools, openssh-client, net-snmp-tools)
RUN apk add --no-cache iputils bind-tools openssh-client curl

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npx", "tsx", "server.ts"]
