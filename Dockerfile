# Multi-stage Dockerfile for Feitian SK Manager WebApp

# Stage 1: Build frontend
FROM node:20 AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd frontend && npm ci

# Copy frontend source
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Stage 2: Production nginx server
FROM nginx:alpine

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend
COPY --from=frontend-builder /build/frontend/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
