# Obra10+ HUB (TanStack Start + Nitro node-server)
# Build com variáveis VITE_* — no Render (Docker), definir como Docker Build Arguments
# idênticos às variáveis de runtime.
#
# Ex.: docker build \
#   --build-arg VITE_SUPABASE_URL=... \
#   --build-arg VITE_SUPABASE_ANON_KEY=... \
#   --build-arg VITE_APP_ORIGIN=https://seu-app.onrender.com \
#   -t obra10-hub ./web

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_ORIGIN

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_APP_ORIGIN=$VITE_APP_ORIGIN

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
