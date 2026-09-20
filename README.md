# File Share

A lightweight, password-protected, temporary file-sharing server with an AI
file-management assistant ("Smopi").

This repository contains two implementations:

| Directory | Stack | Status |
|---|---|---|
| **root (`server.ts`, `src/`)** | Node / Express 4 + React 19 + Vite 8 + Tailwind 4 | **Active product** — this is what `npm run dev` / `npm run build` / `npm start` runs |
| **`cloned/`** | Python 3 standard library (+ optional Cloudflare Quick Tunnel) | **Reference upstream** (v3.5.1), superseded by the Node app; not wired into the build |

> ⚠️ `cloned/` exists as the original implementation this project was ported from.
> Its `server.py` and `templates/` are read-only reference material and are not
> executed by any npm script.

## Flow

High-level request flow through the app, from first visit to a file operation:

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "ui-sans-serif, system-ui, sans-serif",
    "fontSize": "14px",
    "lineColor": "#F97316",
    "edgeLabelBackground": "#FFF7ED",
    "clusterBkg": "#FAFAFF",
    "clusterBorder": "#A78BFA"
  }
}}%%
flowchart TD
    subgraph CLIENT["🎨 React client — src/App.tsx"]
        direction TB
        U(["👀 Visitor opens share URL"]) --> V{"🔐 Valid session cookie?"}
        V -- "No" --> L(["🔑 LoginView — enter share password"])
        L --> LOGIN(["📡 POST /api/login"])
        LOGIN -- "wrong password / rate-limited" --> L
        LOGIN -- "✅ OK" --> COOKIE(["🍪 HTTP-only SameSite=Lax session cookie"])
        V -- "Yes" --> UI(["📁 File list UI"])
        COOKIE --> UI
        UI --> ACT(["⚡ User action"])
        ACT --> UP(["⬆️ Upload via dropzone"])
        ACT --> DL(["👁️ Preview / download / ZIP"])
        ACT --> ED(["✏️ Rename / move / delete / bulk ops"])
        ACT --> AI(["🤖 Smopi prompt (AI assistant)"])
    end

subgraph SERVER["🖥️ Express server — server.ts"]
        direction TB
        GUARD(["🛡️ Same-origin + auth middleware"])
        GUARD -- "🚫 unauthorized" --> REJECT(["401 / 403"])
        GUARD -- "✅ OK" --> PATH(["🧭 traversal-safe path resolution in SHARE_DIR"])
        PATH --> FS(["💾 filesystem — read / write / delete / zip"])
        AI --> ENG{"GEMINI_API_KEY set?"}
        ENG -- "Yes" --> GEM(["✨ Gemini-backed Smopi agent"])
        ENG -- "No" --> LOC(["⚙️ local fallback command engine"])
        GEM --> FS
        LOC --> FS
        FS --> RESP(["📤 JSON / file stream response"])
        REJECT --> RESP
    end

UP --> GUARD
    DL --> GUARD
    ED --> GUARD
    AI --> GUARD
    RESP --> UI
    UI -- "share expired / one-time download done / owner stop" --> STOP(["🛑 StoppedView"])

classDef client fill:#7C3AED,stroke:#4C1D95,stroke-width:2px,color:#FFFFFF
    classDef server fill:#0EA5E9,stroke:#0369A1,stroke-width:2px,color:#FFFFFF
    classDef decision fill:#FDE68A,stroke:#D97706,stroke-width:2px,color:#78350F
    classDef error fill:#EF4444,stroke:#B91C1C,stroke-width:2px,color:#FFFFFF
    classDef ai fill:#EC4899,stroke:#9D174D,stroke-width:2px,color:#FFFFFF
    classDef store fill:#10B981,stroke:#065F46,stroke-width:2px,color:#FFFFFF

class U,L,LOGIN,COOKIE,UI,ACT,UP,DL,ED client
    class V,ENG decision
    class GUARD,PATH,RESP server
    class AI,GEM,LOC ai
    class FS store
    class REJECT,STOP error
```



## Install (one-liner)

The recommended way to run the share on a server. Installs Node.js 22+ if
needed, clones the repo, builds `dist/server.mjs`, and exposes the `fsd`
command (start/stop/status/env/update/uninstall).

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/JCVERSA/file/main/scripts/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/JCVERSA/file/main/scripts/install.ps1 | iex
```

Then configure a password and start:

```bash
fsd env set SHARE_PASSWORD my-secret
fsd start        # production server (background), default port 3000
fsd status       # share stats
```

See `fsd help` for the full command set, or `fsd uninstall` to remove.
The installer also accepts `--source-dir <checkout>` to install from local
code and `--branch <name>` to pick a branch.

## Quick start (developer)

Requires Node.js 22+ (the repo uses a Bun lockfile; npm also works).

```bash
npm install --legacy-peer-deps   # peer dep ranges in the scaffold are loose
SHARE_PASSWORD=my-secret npm run dev
```

Then open `http://localhost:3000` and enter `my-secret`.

Production build & run:

```bash
npm run build
SHARE_PASSWORD=my-secret npm start   # node dist/server.mjs
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | tsx dev server (Express + Vite middleware) |
| `npm run build` | Vite client build + esbuild ESM server bundle (`dist/server.mjs`) |
| `npm start` | Run the production server bundle |
| `npm run lint` | `tsc --noEmit` with `noUnusedLocals`/`noUnusedParameters` |
| `npm test` | End-to-end smoke suite (`node --test tests/`) |

## Configuration (environment)

| Variable | Purpose | Default |
|---|---|---|
| `SHARE_PASSWORD` / `PASSWORD` | Share unlock password | random 12-hex at boot (printed to logs) |
| `SHARE_EXPIRY` | Share lifetime in seconds | `1800` (30 min); `0` disables expiry |
| `SHARE_ONE_TIME` | `true` stops the whole share after the first completed download | `false` |
| `OWNER_SESSION_SECRET` | When set, owner-only actions (stop share, restart, password disclosure) require `POST /api/login-owner` with this secret | unset ⇒ single-admin mode |
| `SHARE_DIR` | Absolute path to the backing files directory | `./shared_files` |
| `PORT` | HTTP listen port | `3000` |
| `GEMINI_API_KEY` | Enables the Gemini-backed Smopi agent (otherwise a local fallback engine runs) | unset |

## Security model

- Single share password (timing-safe compare, 5-attempt/min/IP login limit).
- Sessions via HTTP-only `SameSite=Lax` cookie (plus bearer/query token for the
  embedded preview); session TTL is capped so it never outlives the share.
- **Owner/guest split (opt-in):** set `OWNER_SESSION_SECRET` to restrict
  stop/restart and password disclosure to `POST /api/login-owner`.
- Same-origin guard on mutating requests rejects cross-site posts (CSRF).
- Path traversal/symlink safe resolution, forced-download for active content
  (HTML/SVG/JS/…), SVG never rendered inline (stored-XSS defense).
- `X-Content-Type-Options: nosniff`, frame + referrer policies.

## Testing

`npm test` spins up an isolated instance (random port + temp `SHARE_DIR`) and
verifies: auth, upload/list/preview round-trip (incl. non-ASCII names),
safe download content types/disposition, SVG neutralization, ZIP generation,
bulk delete, owner gating, unauthenticated rejection, path traversal, and the
same-origin guard.

## Notes

- `AI Studio` injects `GEMINI_API_KEY` at runtime; when it is unset, Smopi runs
  a local (non-LLM) command engine.
