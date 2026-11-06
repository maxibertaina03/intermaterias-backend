FROM node:24-alpine
# tini: reenvía las señales (docker stop) a Node y limpia procesos zombis
RUN apk add --no-cache tini tzdata
ENV NODE_ENV=production TZ=America/Argentina/Buenos_Aires
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src/ ./src/
COPY database/ ./database/
COPY scripts/ ./scripts/
# Corre como el usuario "node" (sin privilegios), no como root
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
