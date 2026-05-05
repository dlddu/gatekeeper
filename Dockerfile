# Stage 1: Build Go backend
FROM golang:1.24-alpine AS builder
WORKDIR /src

# Cache modules separately so dependency downloads can be reused.
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gatekeeper .

# Stage 2: Minimal runtime image
FROM alpine:3.20 AS runner
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup --system --gid 1001 gatekeeper \
    && adduser --system --uid 1001 --ingroup gatekeeper gatekeeper

WORKDIR /app
COPY --from=builder /out/gatekeeper /app/gatekeeper

USER gatekeeper

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/app/gatekeeper"]
