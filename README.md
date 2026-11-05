# Go Links (`go/`) — Internal URL Shortcut Service

A lightweight, production-minded internal URL shortcut service (e.g., `go/design-system`, `go/oncall`, `go/payroll`) built using **Spec-Driven Development (SDD)** with **TypeScript**, **Express**, **SQLite (`better-sqlite3`)**, **Zod**, **React (Vite)**, and **Jest**.

## Live Deployment

| Environment | URL | Description |
| :--- | :--- | :--- |
| **Web Application (UI)** | [https://golinks.irvin-lopez.com](https://golinks.irvin-lopez.com) | Interactive shortcut directory, search, and creation form |
| **Sample Redirect (`302`)** | [https://golinks.irvin-lopez.com/go/design-system](https://golinks.irvin-lopez.com/go/design-system) | Resolves `go/design-system` and increments usage counter |
| **API Health Check** | [https://golinks.irvin-lopez.com/api/health](https://golinks.irvin-lopez.com/api/health) | Service and SQLite liveness endpoint with `X-Request-Id` |
| **GitHub Repository** | [https://github.com/irvindev9/go-links](https://github.com/irvindev9/go-links) | Source code, specification, business rules, and Jest suite |

> **Specification & Business Rules**:
> - [`SPEC.md`](./SPEC.md): Formal functional requirements (`FR-01`–`FR-06`), data model, API contract, and observability/accessibility standards.
> - [`doc/business-rules.md`](./doc/business-rules.md): Detailed domain invariants (`BR-01`–`BR-12`), validation rules, redirect semantics, and traceability matrix to Jest tests.

---

## Quick Start

### Prerequisites
- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Servers (Backend + Frontend)
```bash
npm run dev
```
- **Frontend UI (Vite + React)**: [http://localhost:5173](http://localhost:5173) (proxies `/api` and `/go` requests to the backend)
- **Backend API (Express + SQLite)**: [http://localhost:3001](http://localhost:3001)

On initial startup, the SQLite database (`server/golinks.db`) is automatically migrated and seeded with three example shortcuts:
- `go/design-system` → `https://m3.material.io/`
- `go/oncall` → `https://www.pagerduty.com/`
- `go/payroll` → `https://gusto.com/`

### 3. Run Unit & Integration Tests (Jest)
```bash
# Run full Jest suite (unit + HTTP integration tests)
npm test

# Run only isolated unit tests
npm run test:unit

# Run strict TypeScript typechecking across workspaces
npm run typecheck
```

---

## Project Organization

```text
.
├── SPEC.md                 # Single Source of Truth specification (requirements, schema, API contract)
├── README.md               # Setup guide, assumptions, tradeoffs, and roadmap
├── doc/
│   └── business-rules.md   # Domain invariants (BR-01..BR-12) & test traceability matrix
├── package.json            # npm workspaces root config (server + client)
├── tsconfig.base.json      # Shared strict TypeScript configuration
├── server/                 # Express + SQLite + Zod backend
│   ├── src/
│   │   ├── app.ts          # Express app factory & REST/redirect route handlers
│   │   ├── db.ts           # SQLite repository (WAL mode, prepared statements, seeding)
│   │   ├── schemas.ts      # Zod validation & slug normalization schemas
│   │   ├── types.ts        # Domain models & structured AppError class
│   │   ├── middleware/     # X-Request-Id correlation, structured JSON logger, error handler
│   │   └── __tests__/      # Jest unit tests (schemas, db, middleware) & API integration tests
└── client/                 # React 19 + Vite + Tailwind CSS frontend
    └── src/
        ├── api.ts          # Typed HTTP client with X-Request-Id extraction & error parsing
        ├── App.tsx         # Accessible UI (create form, live search, copy & redirect tracking)
        └── main.tsx        # React application entrypoint
```

---

## Engineering Highlights

1. **Clear API Design & Sensible Validation (`Zod`)**:
   - Every endpoint returns a predictable JSON envelope.
   - Input slugs are normalized (trimmed, lowercased, optional leading `go/` stripped) and validated against `^[a-z0-9]+(?:[-/][a-z0-9]+)*$`.
   - Destination URLs are strictly validated to require `http://` or `https://` protocols, preventing `javascript:` or `data:` URI injection.
2. **Consistent Error Handling**:
   - All validation (`400`), conflict (`409`), not-found (`404`), and internal (`500`) errors return a unified error envelope containing `code`, `message`, field-level `details`, and `requestId`.
3. **Observability (`X-Request-Id` & Structured Logs)**:
   - Every request is assigned (or propagates) an `X-Request-Id` correlation header.
   - The server outputs structured JSON request logs including `timestamp`, `level`, `requestId`, `method`, `path`, `statusCode`, and `durationMs`.
   - The UI displays the latest correlated `X-Request-Id` in the header and inside error alerts so operators can immediately trace issues.
4. **Accessibility (`a11y`) & User Experience**:
   - Semantic landmarks (`<header>`, `<main>`, `<section>`), explicit `<label htmlFor>` bindings, and field-level error associations via `aria-invalid` and `aria-describedby`.
   - Screen-reader polite announcements (`aria-live="polite"`) for clipboard copy actions, shortcut creation, and deletion.

---

## Assumptions Made

1. **Internal Network Trust Model (v1)**: Because Go Links is an internal employee tool, v1 assumes deployment behind an existing corporate VPN / Zero-Trust proxy (e.g., Cloudflare Access or Tailscale), so any authenticated employee on the network can create and view shortcuts.
2. **Case-Insensitive Slugs**: `go/OnCall` and `go/oncall` resolve to the same canonical lowercase slug (`oncall`) to avoid confusing collisions when employees type shortcuts from memory.
3. **Read-Heavy Workload**: Internal shortcut services experience a high read-to-write ratio (many redirects per created link). SQLite in `WAL` (Write-Ahead Logging) mode handles thousands of concurrent reads per second on a single node with zero external infrastructure.

---

## Intentional Tradeoffs (60-Minute Timebox)

| Decision | Why We Chose It for v1 | Tradeoff Accepted |
| :--- | :--- | :--- |
| **SQLite (`better-sqlite3`) over PostgreSQL / Prisma** | Zero external setup for reviewers (`npm install && npm run dev` works immediately); synchronous prepared statements are fast and deterministic, and `:memory:` databases make Jest tests run in milliseconds. | Single-node storage; horizontal multi-instance scaling would require migrating `LinkRepository` to PostgreSQL or LiteFS. |
| **Aggregate click counter (`clicks` + `last_accessed_at`) over event table** | Delivers immediate popularity sorting and "last used" visibility with a single atomic `UPDATE` inside `/go/:slug`. | Does not store historical time-series click trends or referrer metadata. |
| **No Authentication, Docker, or CI/CD pipelines** | Explicitly prioritized core application quality, validation, observability, accessibility, and automated Jest tests within the 60-minute constraint. | Anyone with access to the UI can delete a link; ownership permissions are deferred to v2. |
| **Direct `/go/:slug` route + Vite proxy over custom local DNS** | Allows testing real `302 Found` redirects immediately in the browser without modifying `/etc/hosts` or corporate DNS settings. | Users click or visit `localhost:5173/go/<slug>` rather than typing bare `go/<slug>` in the OS address bar until DNS search domains are configured. |

---

## If I Had Another Day (What I Would Improve Next)

1. **Edit & Ownership Model (SSO Integration)**:
   - Add `PUT /api/links/:id` so owners can update destination URLs when documents move (e.g., migrating from Notion to Confluence) without breaking existing `go/` links.
   - Capture `ownerEmail` from SSO headers (`X-Forwarded-User`) and restrict deletion/editing to the creator or team admins.
2. **Audit Log & Soft Deletes**:
   - Record an append-only `link_audit_events` table tracking who created, updated, or deleted a shortcut so broken critical links (like `go/oncall`) can be rolled back immediately.
3. **Dynamic / Parameterized Shortcuts**:
   - Support parameterized templates such as `go/jira/$1` → `https://company.atlassian.net/browse/$1` so `go/jira/ENG-402` redirects directly to ticket `ENG-402`.
4. **Browser Extension & OpenSearch Descriptor**:
   - Add an OpenSearch XML manifest and a lightweight Chrome/Firefox extension so employees can type `go <tab> payroll` directly in their browser omnibox even without corporate DNS changes.
5. **Frontend Component & Accessibility Tests**:
   - Expand the Jest suite to include `@testing-library/react` and `jest-axe` automated accessibility assertions on the `client/` workspace.
