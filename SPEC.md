# Technical Specification: Go Links (`go/`)

> **Status**: Approved (MVP — 60-Minute Timebox)  
> **Methodology**: Spec-Driven Development (SDD)  
> **Stack**: TypeScript, Express, SQLite (`better-sqlite3`), Zod, React (Vite)

---

## 1. Overview & Problem Statement

Internal engineering and operations teams frequently share long, hard-to-remember URLs for dashboards, design systems, runbooks, and payroll portals. **Go Links** provides a human-friendly internal URL shortcut service where memorable aliases like `go/design-system`, `go/oncall`, or `go/payroll` resolve immediately to their destination URLs.

This specification defines the **first iteration** of Go Links, intentionally scoped for a ~60-minute engineering timebox while prioritizing API clarity, input validation, observability, accessibility, and maintainability so teammates can confidently extend it.

---

## 2. Functional Requirements & Acceptance Criteria

| ID | Requirement | Acceptance Criteria | Priority |
| :--- | :--- | :--- | :--- |
| **FR-01** | **Create Shortcut** | Users can submit a `slug` (e.g., `design-system`), a `targetUrl` (`http://` or `https://`), and an optional `description`. Returns `201 Created` with the persisted link entity. | Must Have |
| **FR-02** | **Input Validation & Conflict Handling** | `slug` is trimmed, lowercased, and validated against `^[a-z0-9]+(?:[-/][a-z0-9]+)*$` (length 2–64). `targetUrl` must be a valid HTTP/HTTPS URL (max 2,048 chars). Duplicate slugs return `409 Conflict` with a structured error code (`SLUG_ALREADY_EXISTS`). | Must Have |
| **FR-03** | **List & Search Shortcuts** | Users can view existing shortcuts ordered by popularity (`clicks DESC`) and recency (`createdAt DESC`), and filter them by `slug`, `description`, or `targetUrl` via query parameter `?q=`. | Must Have |
| **FR-04** | **Resolve & Redirect (`/go/:slug`)** | Visiting `GET /go/:slug` atomically increments `clicks`, updates `lastAccessedAt`, and responds with `302 Found` (`Location: <targetUrl>`). Unknown slugs return a clear `404 Not Found` response. | Must Have |
| **FR-05** | **Delete Shortcut** | Users can remove an obsolete shortcut via `DELETE /api/links/:id`. Returns `204 No Content` or `404 Not Found`. | Should Have |
| **FR-06** | **Default Seed Data** | On initial boot against an empty database, the service seeds `go/design-system`, `go/oncall`, and `go/payroll` so the application is immediately testable. | Must Have |

### Explicit Non-Goals (Out of Scope for 60-Minute Iteration)
- **Authentication & Authorization (RBAC)**: Assumed to run inside a trusted corporate network / VPN for v1.
- **Time-series Analytics**: Only aggregate click counts and `lastAccessedAt` timestamps are tracked in v1.
- **Browser Extension / DNS Search Domain Setup**: The web app exposes `/go/:slug` directly and provides one-click copy/visit actions.

---

## 3. System Architecture & Data Model

### 3.1 Architecture Diagram

```
+-------------------------------------------------------------+
|                   Client (React + Vite + TS)                |
|  - Searchable Directory  - Accessible Form  - Copy/Redirect |
+------------------------------+------------------------------+
                               | HTTP / JSON (X-Request-Id)
                               v
+-------------------------------------------------------------+
|                   Server (Express + TypeScript)             |
|  1. Request ID & Structured Logging Middleware              |
|  2. Zod Request Validation                                  |
|  3. Route Handlers (/api/links, /go/:slug, /api/health)     |
|  4. Centralized Error Handler (Consistent Error Envelope)   |
+------------------------------+------------------------------+
                               | Synchronous Prepared Statements
                               v
+-------------------------------------------------------------+
|                 SQLite Database (better-sqlite3)            |
|                     Table: links (WAL mode)                 |
+-------------------------------------------------------------+
```

### 3.2 SQLite Schema (`links`)

```sql
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  target_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
```

### 3.3 Domain Entity (`GoLink`)

```ts
export interface GoLink {
  id: number;
  slug: string;
  targetUrl: string;
  description: string;
  clicks: number;
  createdAt: string;
  lastAccessedAt: string | null;
}
```

---

## 4. API Contract

Every HTTP response includes the `X-Request-Id` header for request correlation and debugging.

### 4.1 Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR | SLUG_ALREADY_EXISTS | LINK_NOT_FOUND | INTERNAL_ERROR",
    "message": "Human-readable summary of what went wrong.",
    "details": {
      "slug": ["Slug may only contain lowercase letters, numbers, hyphens, and slashes"]
    },
    "requestId": "req_4b8e9a1c"
  }
}
```

### 4.2 Endpoints

| Method & Path | Description | Success Response | Error Responses |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | Service and SQLite liveness check | `200 OK` `{ status: "ok", timestamp, requestId }` | `500 Internal Server Error` |
| `GET /api/links?q=` | List all shortcuts (optionally filtered by `q`) | `200 OK` `{ data: GoLink[], meta: { total: number } }` | `500 Internal Server Error` |
| `POST /api/links` | Create a new shortcut | `201 Created` `{ data: GoLink }` | `400 Bad Request`, `409 Conflict` |
| `DELETE /api/links/:id` | Delete a shortcut by ID | `204 No Content` | `400 Bad Request`, `404 Not Found` |
| `GET /go/:slug` | Increment usage metrics & redirect to `targetUrl` | `302 Found` (`Location: <targetUrl>`) | `404 Not Found` |

---

## 5. Cross-Cutting Concerns

1. **Observability**:
   - **Correlation IDs**: Incoming `X-Request-Id` headers are preserved; otherwise a unique `req_<uuid>` is generated and returned in response headers and error payloads.
   - **Structured Logging**: Every request logs a structured JSON entry with `timestamp`, `level`, `requestId`, `method`, `path`, `statusCode`, and `durationMs`.
2. **Accessibility (a11y)**:
   - Semantic landmarks (`<header>`, `<main>`, `<section>`, `<form>`).
   - Explicit `<label htmlFor="...">` bindings for all form controls.
   - Field-level validation errors linked via `aria-invalid` and `aria-describedby`.
   - `aria-live="polite"` status announcements for clipboard copy actions and shortcut creation/deletion.
