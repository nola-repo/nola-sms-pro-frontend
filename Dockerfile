# Stage 1: Build
FROM node:18 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files and build
COPY . .
RUN npm run build

# Stage 2: Serve built files
FROM node:18-alpine
WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy dist folder from build stage
COPY --from=builder /app/dist ./dist

# Use the PORT environment variable provided by Cloud Run
ENV PORT 8080
EXPOSE $PORT

# Start the server
CMD ["serve", "-s", "dist", "-l", "env:PORT"]