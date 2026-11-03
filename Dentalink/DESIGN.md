# Dentalink UI design context

## Product register

Dentalink is a dense clinical and administrative product used during daily operations. Interfaces prioritize scanability, explicit state, keyboard access and stable geometry over decorative expression.

## Canonical runtime source

`apps/web/src/styles.css` remains the canonical source for runtime design tokens. This document records intent and ownership; it does not duplicate token values into a second theme.

- Typography: DM Sans for interface text and DM Mono for identifiers, codes and technical values.
- Brand: Dentalink navy for hierarchy, blue for primary action and established semantic success, warning and danger tones.
- Geometry: compact spacing; controls use existing `--radius-md`; surfaces use `--radius-lg`; pills are reserved for badges.
- Elevation: shared modal and component shadows only. Borders and wide decorative shadows are not combined.
- Motion: existing fast interaction transitions; no decorative entrance animation. Reduced-motion behavior in `styles.css` is authoritative.

## Component ownership

- Page hierarchy: `PageHeader`.
- Dataset controls: `TableToolbar` and URL search parameters.
- Responsive tabular content: `DataTable`.
- Inputs: `Input`, authored `Select`, `Textarea`, React Hook Form and Zod.
- Dates: `DatePicker` owns date-only filtering and deliberately delegates the popup to the platform-native control; stored values remain ISO `YYYY-MM-DD`.
- Binary policy flags: native checkbox semantics styled within the field label; no competing switch owner exists.
- Feedback: shared loading, error, empty, toast, `Modal` and `ConfirmDialog` primitives.
- Authorization: server guards are authoritative; `PermissionGate` and route boundaries prevent predictable 403 responses.

## Developer API console

Visual direction: clinical integration instrument. The memorable element is the concise, live scope summary before generation. It exposes the real security boundary without rebranding Dentalink.

- One primary surface for the form; sections are divided by rules instead of nested cards.
- API identifiers use DM Mono, but human labels lead every decision.
- Token permissions reuse the role checklist grammar: domain headers, compact rows, circular selected state and contextual detail. The catalog remains limited to external M2M scopes and has no bulk-selection action.
- Secret values are masked by default and never repeated in examples.
- No gradients, glass effects, oversized metrics, sandbox visual language or decorative animation.

## Appointment reminder operations

Visual direction: compact clinical operations ledger. Summary values support triage, while the responsive table and explicit delivery states remain the primary evidence surface.

- Filters remain URL-owned and reuse `TableToolbar`, `DatePicker`, `Select` and `Input`.
- Delivery results use existing semantic badges; `UNCERTAIN` and `FAILED` remain visually distinct and never collapse into a generic error count.
- Policy and resolution use shared modal owners. External effects are pessimistic and no decorative motion or dashboard chart is introduced.
