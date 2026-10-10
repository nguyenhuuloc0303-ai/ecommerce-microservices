FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/order-service/package*.json ./
COPY services/order-service/prisma/ ./prisma/
RUN npm install --omit=dev && npx prisma generate
COPY proto/ ./proto/
COPY contracts/ ./contracts/
COPY services/order-service/ ./
EXPOSE 3004
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
