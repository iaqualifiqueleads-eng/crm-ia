# ---- Stage 1: Build ----
  FROM node:20-alpine AS builder

  WORKDIR /app
  
  COPY package*.json ./
  RUN npm ci
  
  COPY . .
  
  # A URL da API vem como build arg para dentro do Vite
  ARG VITE_API_BASE_URL
  ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
  
  RUN npm run build
  
  # ---- Stage 2: Serve com Nginx ----
  FROM nginx:alpine
  
  COPY --from=builder /app/dist /usr/share/nginx/html
  
  # Configuração do Nginx para funcionar com React Router
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  
  EXPOSE 80