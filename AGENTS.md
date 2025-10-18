# AGENTS.md

Guidelines for the coding agent (and human reviewer) building **Klar Parat** in **small, testable iterations**.
This document evolves with the project — **update it as new iterations, conventions, or insights emerge**.

It references two other key documents that define scope and sequencing:

* **[`PRD.md`](./PRD.md)** — the **Product Requirements Document**, defining what the system must do and why.
* **[`PLAN.md`](./PLAN.md)** — the **Implementation Plan**, defining how and in what order each iteration is built and tested.

These three documents together form the **project’s governing trio**:
**PRD = What**, **PLAN = When/How**, **AGENTS = How to Build Correctly**.

---

## 0) Principles

* **Vertical slices first.** Each iteration should deliver a testable feature from database to UI.
* **Stay faithful to the PRD.** If implementation diverges, update `PRD.md` (not just code).
* **Stay aligned with PLAN.** Build only the iteration currently active in `PLAN.md`.
* **Safety by contracts.** Shared types and schemas must be validated at all boundaries.
* **Determinism > cleverness.** Urgency, timing, and medals must be reproducible and unit tested.
* **Online-only.** Assume connectivity for LLM/TTS; no offline mode or text fallback.
* **Multi-child by design.** Always isolate per-child data and session state.
* **Kid-first UX.** Large targets, minimal text, immediate feedback.

---

## 1) Working Agreement

* **Branching:** `main` (protected); feature branches `feat/<iteration>-<slug>`.
* **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`).
* **PRs:** ≤ 400 LOC when possible; reference the relevant iteration in `PLAN.md`.
* **PR template must include:**

  * Purpose (iteration number and brief)
  * Acceptance criteria from `PLAN.md`
  * Manual validation steps
  * Screenshots (UI) or sample requests/responses (API)
  * Links to updated docs (`PRD.md`, `PLAN.md`, `AGENTS.md` if modified)
* **Definition of Done:**

  * CI passes (lint, typecheck, tests)
  * Acceptance criteria met
  * Manual validation on tablet (Safari/iOS)
  * Docs updated if scope or sequence changed

---

## 2) Repository Layout

```
/apps
  /web       # React + Vite + Tailwind
  /api       # Express + Prisma (SQLite)
/packages
  /shared    # Types, Zod schemas, constants
/docs
  PRD.md     # Product Requirements
  PLAN.md    # Implementation Plan
  AGENTS.md  # (this file)
```

> Keep `/docs` as the single source of truth for requirements, planning, and process.

---

## 3) Coding Standards

### Language & Tooling

* **TypeScript everywhere** with `strict: true`.
* **ESLint + Prettier** enforced; no inline disable unless justified.
* Use **absolute imports** (`@shared/*`) via TS paths.

### API

* REST, JSON only.
* All inputs validated with **Zod**.
* Standard error shape:

  ```json
  { "error": { "code": "BAD_REQUEST", "message": "..." } }
  ```
* Idempotent endpoints for task completion and session finalization.

### Web

* State: Local for UI, global via Zustand or RTK Query.
* Effects: React Query (preferred).
* Accessibility: ≥44px tap targets, ARIA labels, keyboard navigation.
* No magic animations; keep transitions subtle.

### Time & Logic

* Use `dayjs` or `luxon` consistently.
* Time/urgency/medal functions must be **pure** and **unit-tested** (no direct `Date.now()`).

---

## 4) Testing Conventions

### Pyramid

* **Unit tests:** shared logic and validators.
* **Integration tests:** API (supertest).
* **Component tests:** key UI flows with React Testing Library.
* **Manual validation:** follow checklists in `PLAN.md`.

### Structure

* Tests mirror source folder structure.
* One test file per pure module.
* Deterministic seeds for DB; reset per suite.

### External Services

* Mock LLM/TTS by default; real tests behind env flags.
* No live network calls in unit tests.

---

## 5) Data & Contracts

Follow schemas as defined in **`PRD.md`**, section *System Design > Data Model*.
If schema changes, **update both the code and PRD.md simultaneously**.

* Snapshots are immutable (template changes do not affect past sessions).
* `expected_minutes` defaults come from global settings.
* All times are 24h `"HH:MM"` strings; store UTC internally.

---

## 6) Urgency & Medal Logic

Defined precisely in **`PRD.md` → Timing, Medals & Urgency**.

* Implement functions `computeMedal()` and `computeUrgency()` in `/packages/shared/logic/`.
* Cover boundary tests (≤, ≥) and rounding errors.
* Never rely on client-side clocks for final medal computation.

---

## 7) LLM & TTS Integration

Phased implementation per **`PLAN.md` Iterations 5–6**.

* LLM: Server-only call to OpenAI, strict JSON schema `{ text }`.
* TTS: Use a provider abstraction with fake, WebSpeech, and cloud variants.
* No on-screen text fallback; retries and continue silently if failure persists.
* Respect the “Enable Voice” gesture to comply with autoplay restrictions.

---

## 8) Observability & Error Handling

* Log structured entries: `request_id`, `route`, `duration`, `result`, `error`.
* Never crash on network/TTS/LLM issues; log and continue.
* Add debug panel (dev only) showing recent voice events.

---

## 9) Privacy & Security

* HTTPS for any non-local deployment.
* API keys only on the server (via `.env`).
* PII limited to `first_name` and `birthdate`.
* No analytics or third-party trackers in MVP.

---

## 10) Documentation Rules

* **`PRD.md`** defines **scope and behavior** — update if logic or data model changes.
* **`PLAN.md`** defines **order and milestones** — update when iterations change or merge.
* **`AGENTS.md`** defines **how to build safely** — update when new tools, coding rules, or testing practices emerge.

Every PR that alters any of these dimensions must include the relevant doc edits.

---

## 11) Iteration Checklists (Template)

> Paste into each PR description when implementing an iteration from `PLAN.md`.

**Iteration:** (e.g., I3 — Timing & Medal Engine)
**Linked Docs:** `PLAN.md#iteration-3`, `PRD.md#timing-medals-urgency`

**Acceptance Criteria:**

* [ ] Matches behavior in PRD
* [ ] Meets iteration objectives in PLAN
* [ ] Passes tests and manual validation

**Tasks:**

* [ ] Schema updates (if needed)
* [ ] API routes & Zod validators
* [ ] Web components & hooks
* [ ] Unit + Integration tests
* [ ] Docs updated (PRD/PLAN/AGENTS)

---

## 12) PR Quality Gate

Reject any PR that:

* ❌ Lacks references to PRD/PLAN iterations
* ❌ Introduces untyped or `any` code
* ❌ Breaks test or lint pipelines
* ❌ Adds untracked dependencies
* ❌ Changes logic without doc update

---

## 13) UI Rules (Kid Mode)

* Only one primary action visible per screen.
* Progress and next task always visible.
* Voice feedback is authoritative; UI complements it.
* Never introduce text-based fallback dialogues.
* Avoid stress-inducing colors (no red countdowns).

---

## 14) Manual Validation Scripts

Keep updated per iteration; see `PLAN.md` for current list.
Each iteration PR should note which script(s) were used.

---

## 15) Adding New Capabilities

When extending beyond MVP:

1. Propose change in `PRD.md`.
2. Add or adjust iteration in `PLAN.md`.
3. Reflect process/tooling changes here in `AGENTS.md`.
4. Implement feature only after documentation alignment.

---

## 16) Non-Goals (MVP)

* No offline support.
* No authentication or remote accounts.
* No text-based fallbacks for voice.
* No gamified reward stores or stickers (future potential).

---

## 17) Glossary

* **PRD.md:** Product Requirements Document — defines **what** and **why**.
* **PLAN.md:** Implementation Plan — defines **when** and **how**.
* **AGENTS.md:** Development Guidelines — defines **how to build correctly**.
* **Iteration:** A small, testable vertical slice described in PLAN.md.
* **Today Session:** Per-child routine instance with snapshot.
* **Urgency Level:** 0–3 pacing indicator driving voice tone.

---

### Edit History

* **v0.2** — Added cross-references to `PRD.md` and `PLAN.md`, clarified document roles, aligned iteration workflow.
* Future updates: append new version entries with summary and date.

---

> ⚙️ **Reminder:** The coding agent must never invent features or behavior outside `PRD.md`.
> Always cross-check implementation details with `PLAN.md`, and use this `AGENTS.md` as the rulebook for code quality and testing discipline.
