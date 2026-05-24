# TradeSim — Production Scaling Strategy

> Last updated: 2026-05-24
> Status: **Beta-ready**

---

## Overview

TradeSim is a monorepo composed of three independently scalable units:

| Service | Type | Scaling Axis |
|---------|------|-------------|
| `apps/api` | Stateless NestJS + Socket.IO | Horizontal (with Redis adapter) |
| `apps/web` | Stateless Next.js SSR | Horizontal (CDN + multiple instances) |
| PostgreSQL | Stateful DB | Vertical + Read Replicas |
| Redis | Stateful Cache/PubSub | Vertical (sentinel/cluster) |

---

## Phase 1 — Single Server (Beta, up to ~500 concurrent users)

The current Docker Compose setup runs everything on one host.

```
[Internet]
    │
[Reverse Proxy: Nginx/Caddy]
    ├── :443 → tradesim-web:3000 (Next.js)
    └── /api, /socket.io → tradesim-api:3001 (NestJS + WS)

[tradesim-api] → [tradesim-postgres]
             └── [tradesim-redis]
```

### Bottlenecks at this scale
- **WebSocket connections**: Socket.IO is single-process; ~500–2000 concurrent sockets before event loop saturates
- **Market data polling**: Single `ProviderManager` cron cycle; not distributed
- **DB writes**: Order execution hits the main Postgres instance directly

### Mitigations already in place
- ✅ JWT-based auth (stateless; no session store needed)
- ✅ Redis caching for market quotes (TTL-based, avoids DB on every read)
- ✅ Rate throttling via `ThrottlerModule`
- ✅ WebSocket backpressure through `SubscriptionManager` deduplication
- ✅ Circuit breaker on market data providers

---

## Phase 2 — Multi-Instance API (1,000–10,000 concurrent users)

Scale the API horizontally behind a load balancer. WebSocket connections require **sticky sessions** OR the `@socket.io/redis-adapter`.

### Required changes

#### 1. Redis Adapter for Socket.IO

When multiple API replicas exist, a WebSocket client connected to Replica A cannot receive events emitted by Replica B unless they share a PubSub channel.

```typescript
// apps/api/src/modules/websocket/websocket.module.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

#### 2. Load Balancer with Sticky Sessions (alternative to Redis adapter)

If the Redis adapter is not installed, configure sticky sessions:

```nginx
# nginx.conf
upstream tradesim_api {
  ip_hash;  # Routes each client IP to the same upstream
  server api_1:3001;
  server api_2:3001;
  server api_3:3001;
}
```

#### 3. Kubernetes HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tradesim-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tradesim-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Phase 3 — Database Scaling (write-heavy load)

### Read Replicas

Route all `SELECT` queries to one or more read replicas to reduce primary load:

```typescript
// prisma.schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")        // Primary (writes)
  // readReplicaUrls = [env("DATABASE_READ_URL")] // Prisma v5+ accelerate
}
```

### Connection Pooling

Use **PgBouncer** in transaction mode in front of Postgres to reduce connection overhead with multiple API replicas:

```
API replicas → PgBouncer:5432 → PostgreSQL:5432
```

PgBouncer config (transaction pooling — compatible with Prisma):
```ini
[databases]
tradesim = host=postgres port=5432 dbname=tradesim

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## Phase 4 — Redis Scaling

### Sentinel (High Availability)

For multi-replica setups, deploy Redis Sentinel to auto-failover:

```yaml
# docker-compose.prod.yml addition
redis-sentinel:
  image: redis:7-alpine
  command: redis-sentinel /etc/redis/sentinel.conf
  volumes:
    - ./redis/sentinel.conf:/etc/redis/sentinel.conf
```

### Redis Cluster (Horizontal Sharding)

For very high message throughput (>100k msg/sec), shard with Redis Cluster. Update the connection string:

```
REDIS_URL=redis+cluster://node1:6379,node2:6380,node3:6381
```

---

## Current Scaling Ceilings (Measured / Estimated)

| Metric | Ceiling | Mitigation |
|--------|---------|------------|
| Concurrent WS connections | ~2,000 / instance | Add Redis adapter + replicas |
| HTTP req/sec | ~500 req/s / instance | Horizontal scale + rate limit |
| DB writes (orders) | ~200 TPS | PgBouncer + read replicas |
| Redis throughput | ~100k ops/sec | Redis Cluster |
| Market data freshness lag | 5s | Reduce `MARKET_DATA_POLL_INTERVAL_MS` |

---

## Observability Prerequisites for Scaling

Before scaling beyond single-server, ensure:

- [ ] Structured JSON logs shipping to a log aggregator (Loki, Datadog, CloudWatch)
- [ ] Health check endpoints gating load balancer traffic (`/health/live`, `/health/ready`)
- [ ] Redis connection pool monitoring (rejected connections = scale signal)
- [ ] Database slow-query log enabled (threshold: 100ms)
- [ ] Event loop lag alert set at > 50ms sustained

---

## Deployment Checklist

### Before going to production:
- [ ] Generate strong JWT secrets: `openssl rand -hex 32`
- [ ] Set `NODE_ENV=production` in all containers
- [ ] Configure `CORS_ORIGIN` to exact production domain(s) only
- [ ] Enable HTTPS on the reverse proxy (Let's Encrypt / ACM)
- [ ] Set Redis `requirepass` and rotate credentials
- [ ] Enable Postgres SSL (`?sslmode=require` in `DATABASE_URL`)
- [ ] Review and tighten `THROTTLE_LIMIT` for your expected traffic
- [ ] Run `pnpm audit --audit-level=high` and resolve any critical CVEs
- [ ] Verify `/health/ready` returns 200 before routing traffic
- [ ] Test graceful shutdown: `kill -SIGTERM <pid>` should drain cleanly

### After deployment:
- [ ] Run `pnpm run test:storm` against staging to validate WS capacity
- [ ] Run `pnpm run test:orders` to establish TPS baseline
- [ ] Run `pnpm run chaos:redis` to verify Redis reconnect works
- [ ] Run `pnpm run chaos:provider` to verify mock fallback activates
