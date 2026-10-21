# AGENTS

Instructions for coding agents working in this repo.

## Stack

- Node 26, TypeScript, Fastify
- Run with tsx (no build step); `tsc` is used for type checking only
- TypeScript only: all source files are `.ts`, no `.js`
- Import alias: `@/*` maps to `src/*`; imports have no extension (e.g. `@/lib/x`)
- DI: Awilix via `@fastify/awilix` (PROXY mode, strict). Register dependencies and their `Cradle` types in the app's DI container module; resolve them from `request.diScope` in routes or `app.diContainer` elsewhere

## Commands

- `npm run dev`: start with watch (`tsx watch src/app.ts`)
- `npm start`: start (`tsx src/app.ts`)
- `npm run typecheck`: type check (`tsc`)

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md): system structure
- [RULES.md](RULES.md): coding rules
- [PLAN.md](PLAN.md): current plan; finished plans go to [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md)
- [MEMORY.md](MEMORY.md): decisions and learned facts; stale entries go to [MEMORY_ARCHIVE.md](MEMORY_ARCHIVE.md)
