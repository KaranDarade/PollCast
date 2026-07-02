# PollCast — Development Conventions

## Commands
- `npm run dev` — Start both frontend + backend
- `npm run dev:server` — Start Express backend (port 4000)
- `npm run dev:web` — Start Next.js frontend (port 3000)
- `npm run db:migrate` — Run Prisma migrations
- `npm run db:seed` — Seed database
- `npm run test` — Run Jest tests
- `npm run test:e2e` — Run Playwright E2E tests
- `npm run lint` — Run ESLint
- `npm run typecheck` — Run TypeScript check

## Architecture
- **Monorepo**: apps/web (Next.js) + apps/server (Express) + packages/shared
- **Separate backend**: Express server for Socket.IO persistence
- **Realtime**: Socket.IO + Redis adapter for cross-server sync
- **Auth**: JWT access (15min) + refresh (7d) tokens with rotation
- **DB**: PostgreSQL + Prisma — controllers → services → repositories

## Code Conventions
- TypeScript strict mode
- No `any` types
- Controllers parse input → call service → send response
- Services contain business logic
- Repositories access Prisma only
- Validators use Zod schemas
- Errors use `AppError` class with status codes
- API responses: `{ success, message, data }` or `{ success, message, error: { code, details } }`

## File Patterns
- Components: PascalCase, one per file
- Hooks: `use` prefix, camelCase
- Services: `*.service.ts`
- Validators: `*.ts` (Zod schemas)
- Middlewares: `*.ts`
- Next.js pages: `page.tsx` in route folders
- UI components in `components/ui/`

## State Management
- Auth state: React Context (`AuthProvider`)
- Server state: Direct fetch + state
- Realtime state: Socket.IO events → local state
- UI state: Local component state
