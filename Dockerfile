# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1000 -S nodejs && \
    adduser -S musicapp -u 1000

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create music directory with proper permissions
RUN mkdir -p /app/music && \
    chown -R musicapp:nodejs /app && \
    chmod -R 755 /app/music

# Switch to non-root user
USER musicapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start the application
CMD ["npm", "start"]
