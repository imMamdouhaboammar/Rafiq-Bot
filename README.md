# Rafiq (رفيق) — Open-Source Human-Like AI Companion Engine

[![CI Pipeline](https://github.com/imMamdouhaboammar/Rafiq-Bot/actions/workflows/ci.yml/badge.svg)](https://github.com/imMamdouhaboammar/Rafiq-Bot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/Express-5.0-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com)

> **Rafiq (رفيق — "companion")** is a production-grade, open-source multimodal AI companion engine engineered specifically for authentic Egyptian Arabic vernacular conversations. It combines a dynamic 11-variable psychological state machine, a customizable "Soul Engine" personality kernel, a WhatsApp export persona synthesizer, and multi-agent skill orchestration into a single-codebase full-stack architecture.

---

## ✨ Highlights & Capabilities

| Capability | Module & Location | Description |
|---|---|---|
| **Streaming Gemini AI** | `services/geminiService.server.ts` → `api/gemini-stream.ts` | Real-time thinking and fast-response SSE streaming |
| **Soul Engine Kernel** | `services/soul.ts` → `services/soulRegistry.ts` | 5-trait personality axes (`chaos`, `empathy`, `slang`, `intellect`, `positivity`) |
| **Psychological State Machine** | `services/dynamicEngines.ts` | Dynamic mood decay, intimacy levels, hunger, and emotional ledger |
| **WhatsApp Persona Cloner** | `services/whatsappImporter.server.ts` → `soulSynthesizer.server.ts` | Parses raw chat logs into living, executable persona definitions |
| **Multimodal Generation** | `services/visualEngine.ts` → `api/gemini.ts` | Image generation, selfies, profile avatars, studio editing, VEO video |
| **Group Chat Simulation** | `services/groupEngine.ts` → `hooks/useGroupController.ts` | Orchestrates multi-bot conversations with turn control |
| **Realtime Tools Router** | `services/tools/*.server.ts` | Web search, URL reader, Cairo timezone, food nutrition |
| **IndexedDB Authority** | `services/db.ts` | Dexie 4 local state authority with schema versioning v1–v6 |
| **Multi-Agent Skill Installer** | `install.sh` + `marketplace.json` + `.skills.json` | Compatible with Claude Code, Skills.sh, Cursor, Codex, Gemini CLI |

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser (React 19 SPA)                       │
│  index.tsx ── App.tsx ── PasswordGate ── WhatsApp Chat UI       │
│      │                        │                      │          │
│      ▼                        ▼                      ▼          │
│  Zustand Store          Dexie IndexedDB         Event Bus       │
│  (useRafiqStore)        (Local State DB)       (Mitt + RxJS)    │
└─────────────────────────────────────────────────────────────────┘
                                │
                      HTTPS Requests (/api/*)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server Runtime                               │
│   Development: Express 5 + Vite Middleware (server.ts)          │
│   Production:  Vercel Serverless Functions (api/*.ts)           │
│                                                                 │
│   assertAppSession ──► Dispatch Router                          │
│                             ├── geminiService.server.ts         │
│                             ├── soulSynthesizer.server.ts       │
│                             ├── tools/toolRouter.server.ts      │
│                             └── progressiveCloneAnalysis.ts     │
└─────────────────────────────────────────────────────────────────┘
                                │
                    External Cloud Providers
                                ├─ Google Gemini API / Vertex AI
                                └─ Redis (Optional Vector Memory)
```

---

## 🚀 Quickstart

### Prerequisites

- **Node.js ≥ 20** or **Bun** (recommended)
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Install

```bash
git clone https://github.com/imMamdouhaboammar/Rafiq-Bot.git
cd Rafiq-Bot
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Set your Gemini API key in `.env.local`:

```env
GEMINI_API_KEY=your-api-key-here
```

### 3. Launch Application

```bash
bun run dev
```

Navigate to `http://localhost:3000` in your browser.

---

## 🧪 Testing & Code Quality

Rafiq-Bot enforces zero-regression quality through a 110-file test suite run via `tsx`:

```bash
npm run typecheck   # TypeScript static verification
npm run test:p0     # Fast P0 gate (security + core unit tests)
npm test            # Full test suite
npm run security:scan # Secret detection scanner
```

---

## 📖 Technical Documentation

| Documentation Guide | Path | Focus Area |
|---|---|---|
| **Architecture** | [`docs/architecture/overview.md`](docs/architecture/overview.md) | Layer map, component graph, data flow, subsystems |
| **Configuration** | [`docs/configuration/env-reference.md`](docs/configuration/env-reference.md) | Complete environment variable specification |
| **Getting Started** | [`docs/guides/getting-started.md`](docs/guides/getting-started.md) | Setup, initialization, first companion creation |
| **Development** | [`docs/guides/development.md`](docs/guides/development.md) | Code conventions, adding actions/souls/tools |
| **Testing** | [`docs/guides/testing.md`](docs/guides/testing.md) | Test runner, assertion categories, P0 suite |
| **API Reference** | [`docs/api/api-reference.md`](docs/api/api-reference.md) | Endpoints, SSE streaming, RPC actions |
| **Deployment** | [`docs/deployment/deployment.md`](docs/deployment/deployment.md) | Vercel production deployment & environment setup |

---

## 🤖 Multi-Agent Distribution & Skill Installation

Rafiq-Bot can be installed as an AI agent skill across host platforms:

```bash
# Skills.sh Registry
npx skills add imMamdouhaboammar/Rafiq-Bot

# Universal Shell Installer
./install.sh
```

---

## 🤝 Contributing

We welcome community contributions! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CLAUDE.md`](CLAUDE.md) before submitting a pull request.

---

## 🪪 License

This project is licensed under the [MIT License](LICENSE).
