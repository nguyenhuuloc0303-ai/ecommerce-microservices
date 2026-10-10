FROM node:22-slim
WORKDIR /app
COPY services/product-service/package*.json ./
RUN npm install --omit=dev
COPY proto/ ./proto/
COPY contracts/ ./contracts/
COPY services/product-service/ ./
EXPOSE 3003 50053
CMD ["node", "src/app.js"]
