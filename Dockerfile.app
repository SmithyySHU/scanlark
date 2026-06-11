FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/crawler/package.json packages/crawler/package.json
RUN npm ci --include=dev

COPY tsconfig.base.json tsconfig.json ./
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db
COPY packages/crawler ./packages/crawler
RUN npm run -w @scanlark/db build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--import", "tsx", "apps/api/src/index.ts"]
