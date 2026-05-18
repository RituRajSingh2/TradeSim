# TradeSim

Professional paper trading platform for Indian stock markets.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Cache/PubSub | Redis (Upstash) |
| Auth | Firebase Phone OTP + JWT |
| Charts | Lightweight Charts |
| Payments | Razorpay |
| Monorepo | Turborepo + pnpm |

## Project Structure

```
tradesim/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   └── shared/       # Shared types, constants, utils
└── docker/           # Docker Compose for local dev
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for local Postgres + Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start local database & cache
docker compose -f docker/docker-compose.yml up -d

# Push database schema
pnpm db:push

# Generate Prisma client
pnpm db:generate

# Start dev servers
pnpm dev
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Prisma Studio | Run `pnpm db:studio` |

## Environment Variables

Copy `.env.example` files in each app directory and fill in the required values:

- `apps/web/.env.local`
- `apps/api/.env`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:push` | Push Prisma schema to database |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:studio` | Open Prisma Studio |

## License

Private — All rights reserved.
