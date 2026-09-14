# Rafiq-Bot — Agent Guidelines & Instructions

Welcome AI Coding Agents! This document describes the architecture, rules, and commands for contributing to **Rafiq-Bot**.

## Commands

- **Install dependencies**: `bun install`
- **Start dev server**: `bun run dev` (Express 5 + Vite SPA on http://localhost:3000)
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Run P0 tests**: `npm run test:p0`
- **Run full test suite**: `npm test`
- **Security scan**: `npm run security:scan`
- **Build production assets**: `bun run build`

## Key Conventions

1. **Server / Client File Boundary**:
   - `*.server.ts` files are server-only (Node.js runtime, Redis, Google SDK service accounts).
   - `*.ts` files are isomorphic or client-safe. Never import `.server.ts` modules into client code.
2. **Centralized Types**:
   - `types.ts` is the single source of truth for all Zod schemas and TypeScript interfaces.
3. **Event-Driven Architecture**:
   - Cross-component communication uses `services/eventBus.ts` (typed Mitt + RxJS).
4. **No Hardcoded Secrets**:
   - All environment variables are loaded via `services/env.server.ts` from `.env.local`.

## Directory Map

- `api/` — Serverless API functions (Vercel)
- `components/` — React UI components
- `hooks/` — React custom hooks and stateful controllers
- `services/` — Core business logic, Soul Engine, Psychology, Memory, Tools
- `stores/` — Zustand global state slices
- `tests/` — Standalone test scripts (run via `tsx`)
- `docs/` — Full technical documentation suite
