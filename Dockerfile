# ---- Stage 1: Build Frontend ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (cache layer)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build


# ---- Stage 2: Build Go Binary ----
FROM golang:1.25-alpine AS go-builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy Go source
COPY . .

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Build the Go binary
RUN CGO_ENABLED=0 GOOS=linux go build -o apprasal main.go


# ---- Stage 3: Minimal Production Image ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy the compiled binary and static assets
COPY --from=go-builder /app/apprasal .
COPY --from=go-builder /app/dist ./dist

# Expose the default port
EXPOSE 8080

# Run the server
CMD ["./apprasal"]
