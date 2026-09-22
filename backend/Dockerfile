FROM node:20-alpine
WORKDIR /app
COPY src ./src
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "src/server.js"]
