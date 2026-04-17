# Foundry and Knowledge base

This document captures the **intended product model** for the Platform console: how **uploads**, **Foundry**, and **Knowledge base** relate, what belongs in each surface, and what is **deferred** for later design or implementation.

It is the reference for frontend copy, navigation, and future backend work. The **Testing Agent app** (member-facing) consumes content that has been published from this pipeline where applicable.

---

## 1. High-level pipeline

The canonical flow is:

```text
Uploads → Foundry → Knowledge base → Testing Agent app (members)
```

| Stage | Role |
|--------|------|
| **Uploads** | Admins bring files into the system. Parsing may accept **single-entity** files or **bundles** (multiple entity types, optionally tied to a **domain** later). |
| **Foundry** | Admin **workshop**: validated content becomes **records** here. Draft, review, edit, domain tagging, and other “playground” behavior live here—not in the Knowledge base UI. |
| **Knowledge base** | **Downstream publish target**: only what admins explicitly **publish** from Foundry becomes visible for the **curated** experience members use. Not every Foundry asset appears here. |
| **Testing Agent app** | Members run tests using **Knowledge base** selections and (separately) **Project repo** / LLM-generated assets where the product allows. Connections and run behavior are documented elsewhere. |

**Important separation**

- **Project repo** (console): per-project **LLM-backed generation**. It is **not** the same as Foundry ingestion; do not treat Foundry as “LLM generates the library.”
- **Foundry**: ingestion, curation, and review **before** publication.
- **Knowledge base**: **publish / unpublish** from Foundry; **no** primary upload entry point on this tab (uploads remain in Foundry).

---

## 2. Uploads

### 2.1 Entry points

- There are **four conceptual upload paths**, aligned with entity types: **Personas**, **Dimensions**, **Profiles**, **Questions**.
- UX should expose **four distinct entry points** (not a single combined “upload anything” control that obscures type), while still allowing:
  - **One file → one entity type** (explicit mapping at upload time or inferred after parse), or
  - **One bundle → multiple types** (and optionally a domain), when the backend supports it.

### 2.2 File formats (product intent)

- **Any file format may be selected** at upload time for now; the **backend** decides whether the payload is valid.
- **Before upload**: surface **guidance** on expected shapes per entity (and per bundle, when specified)—even if initially static copy.
- **After a failed parse**: show a **clear, specific** message (which entity, what structure was expected, link to examples if available). “Beautiful” failure UX is a requirement once validation exists.

### 2.3 Admin capabilities (Foundry side)

Admins should eventually be able to:

- **Upload** and **re-upload** / replace files where product rules allow.
- **Inspect** (“watch”) what was ingested.
- **Edit** records (fields, metadata) in Foundry as the source of truth for curated content.

**Domain** modeling (global vs per-tenant, vs industry) is **explicitly deferred**; Foundry should not hard-code a domain story until that design is settled.

---

## 3. Foundry

### 3.1 Purpose

Foundry is the **full library workshop**: everything the org might use, experiment with, or retire—**before** it is pushed to members via Knowledge base.

### 3.2 Lifecycle (intent)

After a successful parse (“DC pass” / validation pass), material lands in Foundry as **draft** (or equivalent). Admins move items through states such as:

- **Draft** — imported or edited, not ready for wide use.
- **In review** — internal QA.
- **Ready to publish** — eligible to be pushed to Knowledge base.

Exact state names and rules are product decisions; engineering should implement a small **finite state** model and audit trail when the feature ships.

### 3.3 What Foundry is not

- Not the **Knowledge base** (no “everything in Foundry is automatically in the app”).
- Not **Project repo** LLM generation for a single project’s runtime assets (unless product later merges concepts—currently separate).

---

## 4. Knowledge base

### 4.1 Purpose

Knowledge base is the **subset** of Foundry-approved content that admins **choose to expose** to members for in-app testing and related flows. It may later be **scoped** (e.g. per customer, per industry, per tenant); **scoping rules are deferred** (see section 6).

### 4.2 Console surface

- **Placement**: Platform console **sidebar**, **next to Foundry** (same information architecture tier).
- **Layout**: **Four sections** — Personas, Dimensions, Profiles, Questions — mirroring Foundry so admins have a predictable mental model.
- **Primary actions** (when implemented): **Publish** (from Foundry selection / version) and **Unpublish** (hide from app, without necessarily deleting Foundry source).
- **Out of scope on this tab**: **Upload** and **edit** of raw library records as the main path; those remain **Foundry-first**. If “edit” appears later, it should be justified as operational metadata (e.g. display order), not a second ingestion pipeline.

### 4.3 Access

- **Admins** and **customer admins** (exact role matrix) are **deferred**; until then, assume **console-access roles** only.

### 4.4 Downstream usage

Members use Knowledge base–backed material **in the Testing Agent app** (e.g. alongside connections). Exact run-time integration (connections, cards, etc.) is specified in run/product docs, not duplicated here.

---

## 5. Console navigation (target)

| Order (example) | Route | Note |
|-------------------|--------|------|
| Overview | `/console` | |
| Foundry | `/console/content` | Upload + draft/review; four sections. |
| Knowledge base | `/console/knowledge-base` | Publish / unpublish; four sections; no uploads. |
| Project repo | `/console/project-repo` | Per-project LLM generation. |
| LLM configuration | `/console/llm` | |

Overview and in-app links should **describe** this split without implying the wrong pipeline order.

---

## 6. Explicitly deferred

The following are acknowledged but **not** locked in this document:

1. **Domain model** — global vs per-user vs per-industry; how domains attach to bundles and publishes.
2. **Bundle format** — multi-type file layout, versioning, conflict resolution.
3. **Knowledge base scoping** — tenant / customer / industry matrix and UI.
4. **Customer admin** vs platform admin permissions and audit.
5. **Run-time “stronger than particles”** generation story vs Knowledge base (terminology TBD).
6. **Backend APIs**, storage, search, and validation implementation details.

When any of the above is decided, update **this file first**, then align UI and API.

---

## 7. UI implementation notes (incremental)

Until backend endpoints exist:

- Use **disabled** primary actions where real publish/upload would go, with **copy** that states wiring is pending.
- **Pipeline diagrams** in the UI should read **Uploads → Foundry → Knowledge base** (Foundry before Knowledge base).
- **Foundry** should show **four upload entry points** (one per entity) in addition to per-section detail.
- **Knowledge base** should **not** duplicate upload CTAs; link back to Foundry for ingestion.

Implemented in the client (console): `/console/content` (Foundry) and `/console/knowledge-base` (Knowledge base), sidebar order Overview → Foundry → Knowledge base → Project repo → LLM.

---

## 8. Revision history

| Date | Change |
|------|--------|
| 2026-04-16 | Initial document from product discussion (pipeline, uploads, Foundry vs KB, deferred items). |
| 2026-04-16 | Console UI aligned: pipeline strip, four upload entry controls, Knowledge base route and overview link. |
