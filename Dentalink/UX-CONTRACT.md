# Dentalink UX contract

## Developer API credentials

### Permissions and navigation

- `developer_api.credentials.read` exposes the navigation item, list, detail and options.
- `developer_api.credentials.manage` exposes create, edit, rotate and revoke routes/actions.
- Direct navigation without the required permission renders the canonical permission-denied page.
- Server authorization remains final authority.

### List

- Search, status, page and page size are URL state. Search is IME-safe, debounced by 300 ms and clears immediately.
- The list provides loading, error, empty and no-results states without replacing controls.
- Status vocabulary is fixed: Activa, Por vencer, En rotacion, Expirada and Revocada.
- Mobile representation is owned by `DataTable`; actions remain keyboard and touch accessible.

### Create and edit

- Forms use `noValidate`, React Hook Form and Zod. Errors are inline and the first invalid field receives focus.
- At least one external scope is required. There is no select-all operation and no internal RBAC catalog.
- External scopes follow the role-permission interaction pattern, grouped as Pacientes, Agenda and Presupuestos y precios, with an individual checkbox, selected count and accessible contextual description.
- `SELECTED` requires at least one branch. `ALLOWLIST` requires exact IPv4/IPv6 entries and rejects CIDR.
- Create permits 30, 60 or 90 days. Edit cannot change lifecycle status, plan or expiry.
- Dirty in-app navigation uses an app-owned confirmation dialog; browser unload uses the narrow beforeunload safeguard.
- Duplicate submission is disabled while a mutation is pending.

### Secret reveal

- Create and rotate are the only operations that return a secret.
- Secret is masked by default, may be shown/hidden, and supports Clipboard API plus a local fallback.
- Examples reference `$DENTALINK_API_KEY`; they never interpolate the secret into a second DOM location.
- Closing before confirming secure storage opens an accessible irreversible-loss confirmation.
- Secret is never written to URL, localStorage, toast text, logs or snapshots.

### Rotation and revocation

- Rotation is a warning flow: new secret lives for 90 days and old secret overlaps for at most 24 hours.
- Revocation is a danger flow and is irreversible.
- Dialogs stay open after server failure so context and retry remain available.
- Successful operations invalidate list/detail queries; failure is announced without exposing credentials.

### Async, accessibility and responsive behavior

- Shared modal owns focus trap, Escape and focus restoration.
- Native labels, fieldsets, radios and checkboxes provide the interaction model.
- Focus indicators, semantic status text, 200% zoom, narrow viewport and reduced motion are release checks.

## Appointment reminder operations

- List state is URL-owned: local date, branch, stage, status, patient search and page survive reload and browser navigation.
- Reads require `appointments.read`; policy changes, SMTP tests, retries and uncertain resolution require `appointments.reminders.manage`.
- Email effects are pessimistic. `UNCERTAIN` is never automatically retried and requires an audited operator decision.
- Loading, empty, error, sent, failed, uncertain, skipped, expired and stale states remain distinguishable on desktop and narrow screens.
- SMTP tests target the authenticated user's email by default. Automated WhatsApp and phone delivery remain outside this workflow.
