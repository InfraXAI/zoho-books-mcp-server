# Zoho Bookkeeper MCP Server
# Provides Zoho Books API integration with proper multipart file uploads

FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Expose HTTP port
EXPOSE 8004

# Set default environment
ENV PORT=8004
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8004/health || exit 1

# Run the HTTP server
CMD ["node", "dist/server.js"]
