# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

# 单独复制依赖清单，利用缓存提升构建效率
COPY package.json package-lock.json ./
RUN npm ci

# 复制剩余源码并构建
COPY . .
ARG VITE_YOUTUBE_API_KEY
ARG VITE_API_BASE_URL
ENV VITE_YOUTUBE_API_KEY=${VITE_YOUTUBE_API_KEY}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
