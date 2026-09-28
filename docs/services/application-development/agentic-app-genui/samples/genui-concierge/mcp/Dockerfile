# syntax=docker/dockerfile:1
# Node.js 24 LTS (supported until 2028-04-30).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json vite.config.ts vitest.config.ts ./
COPY src ./src
COPY app ./app
# Tests and type checks run on the same Node.js version as production.
RUN npm test && npm run typecheck && npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
