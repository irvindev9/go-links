# Go Links (`go/`) — Business Rules & Domain Invariants

This document defines the domain rules, validation constraints, and behavioral invariants enforced by the **Go Links** service. In alignment with our **Spec-Driven Development (SDD)** workflow, every business rule below is backed by deterministic validation in [`server/src/schemas.ts`](../server/src/schemas.ts), persistence constraints in [`server/src/db.ts`](../server/src/db.ts), and automated Jest test cases in [`server/src/__tests__/`](../server/src/__tests__/).

---

## 1. Shortcut Alias (`slug`) Rules

### BR-01: Canonical Normalization
To prevent human error when typing or sharing shortcuts in chat tools, all incoming `slug` inputs are normalized before validation and storage:
1. **Whitespace Trimming**: Leading and trailing whitespace is stripped (`"  oncall  "` $\rightarrow$ `"oncall"`).
2. **Case Insensitivity**: All characters are converted to lowercase (`"Design-System"` $\rightarrow$ `"design-system"`). SQLite also enforces `COLLATE NOCASE` on the `slug` column.
3. **Prefix Stripping**: If a user includes the `go/` prefix or leading/trailing slashes when creating or searching a shortcut, it is stripped automatically (`"go/eng/oncall/"` $\rightarrow$ `"eng/oncall"`).

### BR-02: Allowed Character Set & Hierarchy
- After normalization, a `slug` must match the regular expression:
  ```regex
  ^[a-z0-9]+(?:[-/][a-z0-9]+)*$
  ```
- **Permitted characters**: Lowercase ASCII letters (`a–z`), digits (`0–9`), hyphens (`-`), and forward slashes (`/`) for team-namespaced shortcuts (e.g., `eng/oncall`, `hr/benefits`).
- **Prohibited patterns**:
  - Spaces, underscores (`_`), or special punctuation (`!`, `?`, `@`, etc.).
  - Leading or trailing hyphens/slashes (`-oncall`, `oncall-`).
  - Consecutive separators (`bad--slug`, `eng//oncall`).

### BR-03: Alias Length Bounds
- **Minimum length**: `2` characters (prevents accidental single-key collisions).
- **Maximum length**: `64` characters (keeps shortcuts human-memorable and concise).

### BR-04: Global Uniqueness & Conflict Handling
- Each normalized `slug` is globally unique across the directory.
- Attempting to register an existing `slug` does **not** overwrite the existing destination URL. Instead, the service rejects the mutation with HTTP `409 Conflict` and error code `SLUG_ALREADY_EXISTS` so an existing team shortcut (such as `go/oncall`) cannot be silently hijacked or broken.

---

## 2. Destination URL (`targetUrl`) & Security Rules

### BR-05: Strict Protocol Allowlist (Anti-XSS / Open-Protocol Guard)
- Every `targetUrl` must be a valid RFC-3986 URL using either the **`http:`** or **`https:`** protocol.
- Unsafe or non-web schemes such as `javascript:`, `data:`, `vbscript:`, `file:`, or `ftp:` are explicitly rejected with HTTP `400 Bad Request` (`VALIDATION_ERROR`).
- **Maximum length**: `2,048` characters.

### BR-06: Optional Context Description
- Shortcuts may include an optional human-readable `description` explaining the destination resource or owning team.
- Descriptions are trimmed of surrounding whitespace, default to an empty string (`""`), and are capped at **`200` characters**.

---

## 3. Redirection & Usage Telemetry Rules (`GET /go/:slug`)

```
User / Browser
     │
     ▼  GET /go/payroll
┌────────────────────────────────────────────────────────┐
│ 1. Normalize slug ("/go/Payroll/" -> "payroll")        │
│ 2. Lookup in SQLite:                                   │
│    ├─ Not Found -> Return 404 LINK_NOT_FOUND           │
│    └─ Found     -> Execute Atomic SQLite Transaction:  │
│                    • clicks = clicks + 1               │
│                    • last_accessed_at = <ISO-8601 UTC> │
│                    Return 302 Found (Location: URL)    │
└────────────────────────────────────────────────────────┘
```

### BR-07: Temporary Redirect Semantics (`302 Found`)
- Resolving a shortcut via `GET /go/:slug` always responds with **HTTP `302 Found`** rather than `301 Moved Permanently`.
- **Rationale**: Internal destinations change over time (e.g., an on-call schedule moving from PagerDuty to Opsgenie, or a Q3 roadmap doc changing to Q4), and the server must observe every visit to maintain accurate usage metrics. A `301` would cause browsers to cache the redirect indefinitely and bypass telemetry.

### BR-08: Atomic Usage Tracking
- Every successful resolution of `GET /go/:slug` executes inside a single SQLite transaction that:
  1. Increments `clicks` by `1`.
  2. Updates `last_accessed_at` to the current UTC ISO-8601 timestamp.
- Newly created shortcuts initialize with `clicks = 0` and `last_accessed_at = null`.

---

## 4. Discovery, Ranking & Lifecycle Rules

### BR-09: Popularity-First Directory Ordering
- When listing or searching shortcuts (`GET /api/links`), results are ordered deterministically by:
  1. **Primary sort**: `clicks DESC` (most frequently used company shortcuts surface at the top).
  2. **Tie-breaker**: `id DESC` (newest shortcuts appear first among links with equal click counts).

### BR-10: Multi-Field Instant Search
- Providing a search query (`GET /api/links?q=<term>`) performs a case-insensitive substring match across three fields simultaneously:
  1. `slug` (ignoring any leading `go/` typed by the user)
  2. `description`
  3. `target_url`

### BR-11: Default Seed Bootstrap
- When the service starts against an empty database (`COUNT(*) = 0`), it automatically seeds three baseline shortcuts (`go/design-system`, `go/oncall`, `go/payroll`) inside a transaction.
- If the database already contains at least one record, seeding is skipped so user state is preserved across restarts.

---

## 5. Observability & Error Contract Rules

### BR-12: Request Correlation (`X-Request-Id`)
- Every HTTP request is assigned a correlation identifier:
  - If the caller supplies a non-empty `X-Request-Id` header, the server preserves and echoes it.
  - Otherwise, the server generates an identifier with prefix `req_` (e.g., `req_4b8e9a1c`).
- All error responses include both a machine-readable `code` (`VALIDATION_ERROR`, `SLUG_ALREADY_EXISTS`, `LINK_NOT_FOUND`, `INTERNAL_ERROR`) and the `requestId` so operators can correlate UI errors directly with backend JSON logs.

---

## 6. Traceability Matrix (Rules $\leftrightarrow$ Code & Tests)

| Rule ID | Summary | Enforcement Module | Automated Jest Test Coverage |
| :--- | :--- | :--- | :--- |
| **BR-01** | Slug normalization (`go/` strip, lowercase) | `server/src/schemas.ts` (`normalizeSlug`) | `schemas.unit.test.ts`, `app.test.ts` |
| **BR-02** | Allowed slug characters & nested slashes | `server/src/schemas.ts` (`SLUG_REGEX`) | `schemas.unit.test.ts`, `app.test.ts` |
| **BR-03** | Slug length bounds (`2..64`) | `server/src/schemas.ts` (`createLinkSchema`) | `schemas.unit.test.ts` |
| **BR-04** | Unique slug & `409 Conflict` protection | `server/src/db.ts` (`LinkRepository.create`) | `db.unit.test.ts`, `app.test.ts` |
| **BR-05** | HTTP/HTTPS protocol allowlist | `server/src/schemas.ts` (`createLinkSchema`) | `schemas.unit.test.ts`, `app.test.ts` |
| **BR-06** | Optional description (`<= 200` chars) | `server/src/schemas.ts` (`createLinkSchema`) | `schemas.unit.test.ts` |
| **BR-07** | `302 Found` redirect semantics | `server/src/app.ts` (`GET /go/*`) | `app.test.ts` |
| **BR-08** | Atomic `clicks` & `lastAccessedAt` update | `server/src/db.ts` (`recordVisitAndGetTarget`) | `db.unit.test.ts`, `app.test.ts` |
| **BR-09** | Popularity (`clicks DESC, id DESC`) ordering | `server/src/db.ts` (`LinkRepository.list`) | `app.test.ts` |
| **BR-10** | Multi-field search (`slug`, `description`, `url`) | `server/src/db.ts` (`LinkRepository.list`) | `db.unit.test.ts`, `app.test.ts` |
| **BR-11** | Initial seed bootstrap | `server/src/db.ts` (`seedIfEmpty`) | `db.unit.test.ts`, `app.test.ts` |
| **BR-12** | `X-Request-Id` correlation & error envelope | `server/src/middleware/*` | `observability.unit.test.ts`, `app.test.ts` |
