FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

FROM base AS api

COPY --from=builder /app/drizzle ./drizzle
COPY public ./public

RUN mkdir -p /var/log/github-release-notifier

EXPOSE 3000

CMD ["npm", "start"]

FROM base AS tracker

EXPOSE 3001

CMD ["node", "dist/tracker-server.js"]

FROM base AS notification

EXPOSE 3002

CMD ["node", "dist/notification-server.js"]
