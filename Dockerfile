# Stage 1: Next.js 정적 export
FROM node:20-alpine AS web
WORKDIR /web

COPY package.json package-lock.json ./
RUN npm ci

COPY next.config.ts tsconfig.json eslint.config.mjs ./
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY public ./public

RUN npm run build

# Stage 2: Go 백엔드 빌드
FROM golang:1.24-alpine AS builder
WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gatekeeper .

# Stage 3: Minimal runtime image
FROM alpine:3.20 AS runner
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup --system --gid 1001 gatekeeper \
    && adduser --system --uid 1001 --ingroup gatekeeper gatekeeper

WORKDIR /app
COPY --from=builder /out/gatekeeper /app/gatekeeper
COPY --from=web /web/out /app/web

USER gatekeeper

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STATIC_DIR=/app/web

ENTRYPOINT ["/app/gatekeeper"]
