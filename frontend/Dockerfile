# Stage 1: build ứng dụng React thành các file tĩnh
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm ci cài đúng phiên bản trong package-lock.json (build lặp lại được, không tự nâng phiên bản)
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: phục vụ file tĩnh bằng nginx + proxy /api sang backend
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
