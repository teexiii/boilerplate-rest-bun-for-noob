# Use the official Bun image
FROM oven/bun:latest as builder

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json prisma ./
RUN bun install

# Copy source code
COPY . .
COPY ./.env.docker.local ./.env

# Set environment variables
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3082

# Run the app
CMD ["bun", "index.ts"]