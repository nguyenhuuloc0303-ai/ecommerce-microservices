FROM node:22-slim
WORKDIR /app
COPY gateway/package*.json ./
RUN npm install --omit=dev
COPY gateway/ ./
EXPOSE 8080
CMD ["node", "src/app.js"]
