FROM node:20-alpine
WORKDIR /app
COPY src ./src
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "src/server.js"]
