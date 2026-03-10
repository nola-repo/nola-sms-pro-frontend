# Stage 1: Build
FROM node:18 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx (supports API proxying to avoid CORS)
FROM nginx:alpine
WORKDIR /app

# Copy the built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run provides PORT env var; nginx listens on 8080 (set in nginx.conf)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]