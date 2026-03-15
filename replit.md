# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with expo-router

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── safewatch-mobile/   # Expo React Native mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Auth: `src/middlewares/auth.ts` — verifies Firebase ID tokens using Google's public signing keys (no service account needed). Extracts `firebaseUid` and looks up the user in the database.
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)

#### API Routes

- `GET/POST /api/users/me` — get or create user profile (Firebase auth required)
- `GET /api/children` — list children for the authenticated user
- `POST /api/sessions/playlist` — generate a playlist based on session config
- `POST /api/sessions` — create a new viewing session
- `PATCH /api/sessions/:id` — update/end a session
- `POST /api/watch-history` — record a video watch entry
- `POST /api/feedback/:sessionId/complete` — submit post-session behavior feedback
- `GET /api/caregivers/invite/:token` — validate a caregiver invite
- `POST /api/caregivers/accept` — accept a caregiver invite

### `artifacts/safewatch-mobile` (`@workspace/safewatch-mobile`)

Expo React Native companion app for SafeWatch — manages children's screen time with YouTube video playback.

- **Auth**: Firebase email/password + Google Sign-In (Google requires dev client build)
- **Navigation**: expo-router with stack navigation (no tabs)
- **Screens**: Login → Start Viewing Session (combined child selection + session config) → Playlist Preview → Player → Feedback
- **YouTube**: react-native-youtube-iframe for embedded playback
- **Chromecast**: Stubbed CastContext (requires dev client build for real Chromecast)
- **State**: React Context (AuthContext, SessionContext, CastContext) + React Query

#### Key Files

- `app/index.tsx` — Login screen (email/password auth)
- `app/invite.tsx` — Caregiver invitation acceptance
- `app/(main)/children.tsx` — Combined "Start Viewing Session" screen (child selection + young child protection + session length + energy pattern)
- `app/(main)/playlist-preview.tsx` — Dark-themed playlist preview with thumbnails, stim dots, HD/SD badges, age ratings, wind-down toggle, session progress bar
- `app/(main)/player.tsx` — YouTube player with session timer and controls
- `app/(main)/session-feedback.tsx` — Post-session behavior rating
- `lib/auth.ts` — Firebase auth wrapper (signIn, signUp, token management)
- `lib/api.ts` — API URL configuration
- `lib/query-client.ts` — React Query client with auth header injection
- `contexts/AuthContext.tsx` — Auth state provider
- `contexts/SessionContext.tsx` — Active session state provider

#### Environment Variables (Mobile)

- `EXPO_PUBLIC_FIREBASE_API_KEY` — Firebase web API key
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` — Firebase auth domain
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` — Firebase project ID
- `EXPO_PUBLIC_DOMAIN` — auto-set to `REPLIT_DEV_DOMAIN` for API calls

#### Environment Variables (Backend)

- `FIREBASE_PROJECT_ID` — for token verification (issuer/audience check)
- `FIREBASE_CLIENT_EMAIL` — stored but not currently required (public key verification)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/schema/users.ts` — users table (Firebase UID, email, role, parent account link)
- `src/schema/children.ts` — children table (name, birth date, entertainment limits, evening protection)
- `src/schema/videos.ts` — videos table (YouTube ID, title, duration, stimulation level, age range)
- `src/schema/sessions.ts` — sessions table (taper mode, flatline level, wind-down, finish mode)
- `src/schema/watchHistory.ts` — watch history entries per session
- `src/schema/feedback.ts` — session feedback + behavior ratings per child
- `src/schema/caregiverInvites.ts` — caregiver invitation tokens

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`.
