# TradeSim

**Professional paper trading platform for Indian stock markets.**
Real-time quotes · Portfolio analytics · Leaderboard · Order simulation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, CSS Modules, Framer Motion |
| Backend | NestJS, TypeScript, Prisma ORM, Socket.IO |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| Auth | Firebase Phone OTP + JWT (access + refresh tokens) |
| Charts | Lightweight Charts |
| Payments | Razorpay |
| Monorepo | Turborepo + pnpm workspaces |
| Containerization | Docker (multi-stage, non-root images) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
tradesim/
├── apps/
│   ├── web/            # Next.js 15 frontend (standalone output for Docker)
│   └── api/            # NestJS REST + WebSocket API
├── packages/
│   └── shared/         # Shared TypeScript types, constants, events
├── docker/
│   ├── Dockerfile.api          # Multi-stage API image (~200MB)
│   ├── Dockerfile.web          # Multi-stage Next.js image (~120MB)
│   └── docker-compose.prod.yml # Production orchestration
├── scripts/
│   ├── load-test.ts            # Market open burst + event loop monitor
│   ├── ws-storm.ts             # WebSocket reconnect storm simulator
│   ├── order-stress.ts         # Order execution HTTP stress test
│   ├── chaos-test.ts           # Master chaos test runner
│   ├── redis-failure.ts        # Redis outage simulation
│   ├── provider-failure.ts     # Market provider outage simulation
│   ├── ws-instability.ts       # WebSocket instability simulation
│   └── generate-token.ts       # JWT generator for local testing
├── SCALING_STRATEGY.md         # Phased scaling plan (Phase 1–4)
└── turbo.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9.15
- Docker Desktop (for local Postgres + Redis)

### Local Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Fill in required values (see each .env.example for guidance)

# 3. Start local database & cache
docker compose -f docker/docker-compose.yml up -d

# 4. Push database schema + generate Prisma client
pnpm db:push
pnpm db:generate

# 5. Start all dev servers
pnpm dev
```

### Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api |
| Health (live) | http://localhost:3001/health/live |
| Health (ready) | http://localhost:3001/health/ready |
| Prisma Studio | `pnpm db:studio` |

---

## Production Deployment

### With Docker Compose

```bash
# 1. Create production env file
cp apps/api/.env.example .env.production
# Edit .env.production with real secrets (openssl rand -hex 32 for JWT secrets)

# 2. Build and start the full stack
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d

# 3. Verify services are healthy
docker compose -f docker/docker-compose.prod.yml ps
```

### Requirements for production
- Generate strong JWT secrets: `openssl rand -hex 32`
- Set `NODE_ENV=production`
- Set `CORS_ORIGIN` to your exact frontend domain
- Enable HTTPS on your reverse proxy (Nginx, Caddy, or Traefik)

See [`SCALING_STRATEGY.md`](./SCALING_STRATEGY.md) for a detailed deployment checklist and phased scaling plan.

---

## All Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers (hot reload) |
| `pnpm build` | Build all packages for production |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript typecheck across all packages |
| `pnpm test` | Run unit tests across all packages |
| **Database** | |
| `pnpm db:push` | Push Prisma schema (dev only) |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:studio` | Open Prisma Studio UI |
| **Testing & Ops** | |
| `pnpm token` | Generate a local JWT for testing |
| `pnpm test:load <URL> <TOKEN>` | Market open burst simulation |
| `pnpm test:storm <URL> <TOKEN> [N]` | WebSocket reconnect storm (N clients) |
| `pnpm test:orders <URL> <TOKEN> [C] [N]` | Order execution stress (C concurrent, N total) |
| `pnpm test:chaos <URL> <TOKEN>` | Full chaos test suite |
| `pnpm chaos:redis <URL>` | Simulate Redis outage + recovery |
| `pnpm chaos:provider <URL>` | Simulate market provider outage |
| `pnpm chaos:ws <URL> <TOKEN>` | Simulate WebSocket gateway crash + reconnect |

---

## Architecture Highlights

### Resilience
- **Circuit Breaker** on all market data providers (trips after 3 failures, 5-min cooloff)
- **Mock provider fallback** activates automatically when all real providers are down
- **Stale-data protection** — quotes older than configurable TTL are flagged or rejected
- **WebSocket backpressure** — per-room deduplication in `SubscriptionManager`
- **Graceful shutdown** — drains WebSocket connections, Redis locks, and in-flight requests on SIGTERM

### Observability
- Structured JSON logging with event types (`MARKET_PROVIDER_TRIPPED`, `WS_DISCONNECT`, etc.)
- Split health probes: `/health/live` (process alive) and `/health/ready` (dependencies ready)
- `APP_SHUTDOWN_STARTED / COMPLETED / TIMEOUT` log events on shutdown

### Security
- JWT access tokens (15m) + httpOnly refresh tokens (7d)
- Helmet with strict CSP, HSTS, X-Frame-Options in production
- SSRF protection middleware blocks private IP ranges and cloud metadata endpoints
- Env validation rejects weak/placeholder secrets at startup in production
- Rate limiting via `ThrottlerModule`

---

## License

Private — All rights reserved.
