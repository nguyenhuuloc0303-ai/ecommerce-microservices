FROM node:22-slim
WORKDIR /app
COPY services/shipment-service/package*.json ./
RUN npm install --omit=dev
COPY contracts/ ./contracts/
COPY services/shipment-service/ ./
EXPOSE 3005
CMD ["node", "src/app.js"]
