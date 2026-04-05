# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files and build the React app
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS production
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=5002

# Copy package manifest and install only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built server and frontend assets
COPY --from=builder /app/server.js ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/src ./src

# Use a non-root user for security
USER node

EXPOSE 5002

CMD ["node", "server.js"]