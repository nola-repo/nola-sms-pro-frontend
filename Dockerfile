# Stage 1: Build React frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the build with Nginx
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html

# Expose Cloud Run port
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]