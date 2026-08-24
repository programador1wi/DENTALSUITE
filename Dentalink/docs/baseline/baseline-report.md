# Baseline Report — Dentalink Professionalization Program

**Fecha**: 2026-08-24T10:55 CST
**Rama**: `feature/redisenio-ui-v2`
**Commit de preservación**: `55a2f93`
**Commit baseline**: (pendiente — este commit)

---

## Estado de Git

| Campo | Valor |
|---|---|
| Rama activa | `feature/redisenio-ui-v2` |
| Ramas existentes | `PROGRAMADOR1`, `feature/redisenio-ui-v2`, `main` |
| Commit HEAD | `55a2f93` |
| Archivos en commit de preservación | 116 archivos (+13,614 / -5,969) |
| Estado del working tree post-commit | Limpio (hasta inicio de Fase 0) |

---

## Migraciones

- **Total aplicadas**: 99
- **Estado**: Schema up to date
- **Últimas 2 migraciones** (previamente sin commit, ya aplicadas):
  - `20260820120000_period_report_requests`
  - `20260821120000_graphical_reports_domain`

---

## Base de Datos (Backup Verificado)

| Métrica | Valor |
|---|---|
| Backup | `dentalwarner-2026-08-24T16-55-36-492Z.dump` (4.8 MB) |
| Tablas | 245 |
| Migraciones registradas | 99 |
| Restore verificado | Si (base temporal `dentalwarner_verify`, creada, restaurada, verificada, eliminada) |

### Conteos de tablas críticas

| Tabla | Filas |
|---|---|
| Organization | 1 |
| Branch | 37 |
| User | 236 |
| Role | **9** (ver nota sobre roles) |
| Permission | 459 |
| Patient | 419 |
| Appointment | 7,800 |

> **Nota sobre roles**: El código en `ROLE_CODES` define 10 roles (incluyendo `marketing`), pero la DB solo tiene 9 filas en la tabla `Role`. El rol `marketing` existe como constante pero no está persistido en seed.

---

## Verificaciones de Pipeline

| Check | Resultado | Detalle |
|---|---|---|
| `npm run typecheck` | **PASS** | API, Web, Shared, UI — 0 errores |
| `npm run lint` | **WARN** | 0 errores (post-fix), 498 warnings |
| `npm test` (API) | **PASS** | 62 suites, 391 tests, 0 fallos, 55s |
| `npm test` (Web) | **FAIL** | 63 passed / 3 failed suites, 251 passed / 11 failed tests |
| `npm run build` | **PASS** | API: Nest build OK. Web: Vite 9.01s, 1 warning |
| `npm run architecture:audit` | **PASS** | 571 archivos, 32 god files tracked (post-fix) |
| `npm run contracts:routes` | **PASS** | API: 710 rutas, Web: 347 rutas (post-update) |

### Tests Web Fallidos (Preexistentes)

3 suites con 11 tests fallidos. Estos son fallos **preexistentes**, no regresiones:

1. **`permission-checklist.test.tsx`** — Busca botón "Mostrar avanzadas" que ya no existe en la UI (checklist de permisos fue rediseñado)
2. **Otros 2 suites** — Pendiente de identificar (logs completos en `docs/baseline/test-web.log`)

### Warning de Build

- `[INEFFECTIVE_DYNAMIC_IMPORT]`: `src/features/novedades/index.ts` importado dinámicamente por router pero estáticamente por header — el code-splitting no puede aislar el chunk.

---

## Inventario de Permisos y Roles

### Roles (Código vs DB)

| # | Código (`ROLE_CODES`) | Persistido en DB |
|---|---|---|
| 1 | `super_admin` | Si |
| 2 | `corporate_admin` | Si |
| 3 | `branch_admin` | Si |
| 4 | `receptionist` | Si |
| 5 | `cashier` | Si |
| 6 | `doctor` | Si |
| 7 | `specialist` | Si |
| 8 | `assistant` | Si |
| 9 | `collections` | Si |
| 10 | `marketing` | **No** |

### Permisos Canónicos

- **98 permisos canónicos** definidos en `CANONICAL_PERMISSION_KEYS`
- **459 registros en tabla Permission** (incluye aliases y permisos por rol)
- Motor RBAC en `packages/shared/src/access-control.ts` (2,734 líneas)
- Presentation tiers: `BASIC`, `ADVANCED`, `INTERNAL`

---

## God Files (>1,000 líneas)

**32 archivos tracked** (31 `planned` + 1 `cohesive-exception`):

| Top 10 | Líneas | Workspace |
|---|---|---|
| `patient-treatments-page.tsx` | 8,386 | Web |
| `treatment-plans.service.ts` | 6,811 | API |
| `payments.service.ts` | 6,084 | API |
| `patient-identity.service.ts` | 3,366 | API |
| `reports-analytics.service.ts` | 3,121 | API |
| `appointment-modal.tsx` | 2,832 | Web |
| `patients.service.ts` | 2,743 | API |
| `settings.service.ts` | 2,724 | API |
| `clinical.service.ts` | 2,541 | API |
| `labs-inventory.service.ts` | 2,525 | API |

---

## Rutas

| Tipo | Conteo |
|---|---|
| API (controllers) | 710 |
| Web (router) | 347 |
| Rutas primarias (español) | 78 |
| Redirects legacy (inglés) | 69 |
| Subrutas anidadas | 14 |
| Comodín 404 | 1 |

---

## Inventario de Comandos (Plan vs Realidad)

| Comando | Existe | Estado Baseline |
|---|---|---|
| `npm run typecheck` | Si | PASS |
| `npm run lint` | Si | WARN (498 warnings, 0 errors) |
| `npm run permissions:audit` | **No** | **POR CREAR** |
| `npm run contracts:routes` | Si | PASS |
| `npm run architecture:audit` | Si | PASS |
| `npm run ui:audit` | Si (en web) | No ejecutado (baseline) |
| `npm test` (API) | Si | PASS |
| `npm test` (Web) | Si | FAIL (11 tests preexistentes) |
| `npm run build` | Si | PASS |
| `npm run test:e2e` | Si | No ejecutado (requiere app corriendo) |
| `npm run test:responsive` | Si | No ejecutado |
| `npm run test:a11y` | Si | No ejecutado |
| `npm run db:backup` | Si | PASS |
| `npm run db:restore` | **Nuevo** | Creado en Fase 0 |
| `npm run db:restore --verify` | **Nuevo** | PASS (verificación exitosa) |

---

## Backup Inventory

| Archivo | Tamaño | Fecha | Restaurable |
|---|---|---|---|
| `dentalwarner-2026-08-24T16-55-36-492Z.dump` | 4.8 MB | 2026-08-24 | **Si** (verificado) |
| `dentalwarner-2026-07-08T17-19-41-878Z.dump` | 2.5 MB | 2026-07-08 | No verificado |
| `dentalwarner-2026-06-04T19-23-05-840Z.dump` | 590 KB | 2026-06-04 | No verificado |
| `dentalwarner-2026-06-04T19-21-57-594Z.dump` | **0 bytes** | 2026-06-04 | **Corrupto** |
| `dentalink-2026-05-20T21-55-08-455Z.dump` | 254 KB | 2026-05-20 | No verificado |

---

## Lint Warnings por Categoría

| Categoría | Cantidad aprox. |
|---|---|
| `@typescript-eslint/no-explicit-any` | ~350 |
| `@typescript-eslint/no-unused-vars` | ~148 |

---

## Infraestructura

| Componente | Estado |
|---|---|
| Docker Compose | Activo (PostgreSQL 16, Redis 7) |
| GitHub Actions | **Inexistente** |
| Dockerfiles producción | **Inexistente** |
| CI/CD | Solo `npm run verify:refactor` local |
| Feature flags | 4 (`AGREEMENTS_V2_ENABLED`, `PRICE_LISTS_V2_ENABLED` + variantes Vite) |
