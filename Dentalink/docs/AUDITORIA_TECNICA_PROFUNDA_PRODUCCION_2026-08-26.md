# Auditoría técnica profunda para producción — Dentalink

**Fecha de corte:** 2026-08-26  
**Checkout auditado:** `C:\Users\X\Documents\GitHub\DENTALSUITE\Dentalink`  
**Rama / commit:** `professionalization/phase-5` / `2b0ad1b`  
**Tipo de revisión:** código, contratos, base PostgreSQL local, pruebas, build, dependencias, CI local, operación y navegador local  
**Estado del árbol:** con cambios previos del usuario y archivos sin seguimiento

> (Seguro) Este documento ejecuta la fase de auditoría pedida en el prompt. No modifica código de producto ni corrige hallazgos, porque la sección 85 exige investigar, documentar, clasificar, priorizar y planificar antes de implementar.

## 1. Diagnóstico Raíz (Root Cause Analysis)

(Seguro) Dentalink ya tiene controles útiles —RBAC, scoping organizacional, migraciones, transacciones financieras, rate limiting compartido, health checks y una suite unitaria amplia—, pero la seguridad y consistencia dependen demasiado de disciplina manual dentro de servicios gigantes. No existe una frontera transversal e infalible para sucursal, concurrencia ni almacenamiento.

(Seguro) El primer límite productivo no es cosmético: existe una operación destructiva de archivos que valida organización pero omite sucursal; cambio de contraseña no revoca sesiones; refresh token escala linealmente contra todas las sesiones activas; y recuperación real no está demostrada. Con esos cuatro hechos no es responsable habilitar múltiples clínicas.

(Probable) A medida que crezcan sesiones, archivos, campañas y reportes, los fallos aparecerán antes por latencia, duplicidad y operación multiinstancia que por capacidad bruta de PostgreSQL.

## 2. Resumen Ejecutivo

### 2.1 Dictamen

**🔴 NO APTO PARA PRODUCCIÓN MULTICLÍNICA**

(Seguro) Hay un P0 confirmado de aislamiento horizontal: `deletePatientFile` permite a un usuario con permiso dentro de la misma organización ocultar un archivo de un paciente de otra sucursal si conoce `patientId` y `fileId`, porque la consulta no usa `branchScope(actor)` ni `ensurePatient` (`apps/api/src/modules/documents/documents.service.ts:709-723`).

(Seguro) Hay bloqueadores P1 adicionales: sesiones sobreviven a cambio de contraseña, refresh público hace bcrypt secuencial sobre todas las sesiones activas, archivos clínicos se almacenan localmente sin validación de contenido ni backup demostrado, y restore actual no pudo verificarse.

(Seguro) Resultado local positivo no equivale a preparación productiva: 421 pruebas API, 270 pruebas web, typecheck, build, contratos de rutas, auditoría de permisos y restricciones financieras pasaron; arquitectura, UI, dependencias y E2E dejaron gates rojos o no verificados.

### 2.2 Alcance y límites

(Seguro) Se inspeccionaron API NestJS, web React/Vite, Prisma/PostgreSQL, Redis, autenticación, autorización, aislamiento por organización/sucursal, pagos, agenda, documentos, reportes, workers, observabilidad, backups, CI y pruebas.

(Seguro) No se ejecutaron mutaciones clínicas, cobros reales, webhooks externos ni restore sobre la base principal. No se usaron credenciales de usuario ni datos sensibles.

(Seguro) No se verificó infraestructura productiva, TLS, WAF, DNS, balanceador, retención de logs, almacenamiento externo, secretos reales, réplicas, monitoreo administrado ni procedimientos humanos.

(Seguro) Playwright enumeró 238 casos pero Chromium no pudo iniciar por `spawn EPERM`; por ello E2E autenticado y accesibilidad quedan **NO VERIFICADOS**, no “fallidos funcionalmente”. El navegador integrado sí validó login, redirección anónima y endpoints de salud locales.

### 2.3 Respuesta ejecutiva a las preguntas críticas

| Pregunta | Respuesta | Evidencia |
|---|---:|---|
| ¿Puede una sucursal acceder o afectar datos de otra? | **Sí, en borrado lógico de archivos** | (Seguro) `deletePatientFile` omite filtro de sucursal. |
| ¿Cambio de contraseña revoca sesiones? | **No** | (Seguro) solo actualiza `passwordHash` e invalida caché. |
| ¿Refresh escala con sesiones? | **No** | (Seguro) carga todas las sesiones activas y compara bcrypt una por una. |
| ¿Hay integridad financiera en DB? | **Parcialmente sí** | (Seguro) nueve CHECK constraints aplicados localmente; migración aún sin seguimiento. |
| ¿Creación concurrente de citas está protegida? | **Sí** | (Seguro) advisory locks y revalidación en transacción. |
| ¿Reagendado concurrente está protegido igual? | **No** | (Seguro) valida fuera y actualiza después sin lock/revalidación. |
| ¿Backups son suficientes? | **No demostrado** | (Seguro) existen dumps, también archivos de 0 bytes; no se verificó restore actual ni backup de binarios. |
| ¿Escala a varias instancias? | **Parcial** | (Seguro) Redis y claim de reportes ayudan; disco local y worker de email impiden seguridad multiinstancia. |
| ¿CI bloquea regresiones críticas? | **No todavía** | (Seguro) workflow está sin seguimiento; arquitectura/UI y E2E son informativos. |
| ¿Hay prueba del flujo clínico completo? | **No** | (Seguro) E2E disponible no cubre paciente → agenda → atención → presupuesto → pago. |

## 3. Cambios Clave (Agrupados lógicamente)

### 3.1 Matriz de riesgo técnico

| ID | Categoría | Hallazgo | Evidencia | Impacto | Prob. | Severidad | Prioridad |
|---|---|---|---|---:|---:|---:|---:|
| SEC-01 | Autorización | Borrado lógico de archivo sin scope de sucursal | CONFIRMADO | 5 | 4 | Crítica | P0 |
| AUTH-01 | Sesiones | Cambio de contraseña no revoca refresh sessions | CONFIRMADO | 5 | 4 | Crítica | P0 |
| AUTH-02 | Disponibilidad | Refresh busca todas las sesiones y ejecuta bcrypt secuencial | CONFIRMADO | 5 | 5 | Crítica | P0 |
| DR-01 | Recuperación | Restore actual, RPO/RTO y backup de binarios no demostrados | CONFIRMADO | 5 | 4 | Crítica | P0 |
| FILE-01 | Archivos | Validación por MIME/extensión declarados con OR; sin magic bytes/AV | CONFIRMADO | 5 | 4 | Alta | P1 |
| CON-01 | Concurrencia | Reagendado valida conflictos fuera de transacción | CONFIRMADO | 4 | 4 | Alta | P1 |
| DATA-01 | Concurrencia | Edición de paciente no tiene versión/compare-and-swap | CONFIRMADO | 4 | 4 | Alta | P1 |
| JOB-01 | Workers | Email multiinstancia puede procesar campaña/recipient concurrentemente | CONFIRMADO | 4 | 4 | Alta | P1 |
| SCALE-01 | Reportes | Carga hasta 50,000 filas en memoria y omite el resto silenciosamente | CONFIRMADO | 4 | 5 | Alta | P1 |
| SUP-01 | Supply chain | `npm audit` detecta 19 vulnerabilidades, 12 altas | CONFIRMADO | 4 | 4 | Alta | P1 |
| XSS-01 | Frontend | múltiples sinks HTML; sanitizador casero de encuestas incompleto | ALTAMENTE PROBABLE | 5 | 3 | Alta | P1 |
| ENV-01 | Configuración | producción acepta defaults inseguros; validador exige solo 3 variables | CONFIRMADO | 5 | 3 | Alta | P1 |
| STORE-01 | Arquitectura | binarios clínicos y reportes dependen de disco local | CONFIRMADO | 4 | 5 | Alta | P1 |
| CI-01 | Entrega | workflow local sin seguimiento y E2E/arquitectura no bloquean | CONFIRMADO | 4 | 4 | Alta | P1 |
| OBS-01 | Observabilidad | métricas viven en memoria por proceso; sin agregación o APM | CONFIRMADO | 3 | 5 | Media | P2 |
| ARCH-01 | Mantenibilidad | 33 archivos productivos superan 1,000 líneas | CONFIRMADO | 4 | 5 | Alta | P1 |
| REDIS-01 | Rendimiento | invalidación usa `KEYS auth:user:*` | CONFIRMADO | 3 | 4 | Media | P2 |
| AUD-01 | Auditoría | interceptor es fire-and-forget y registra ruta, no before/after de negocio | CONFIRMADO | 3 | 4 | Media | P2 |
| WEBHOOK-01 | Integración | secreto global, comparación simple y carrera de idempotencia | CONFIRMADO | 4 | 3 | Alta | P1 |
| DEPLOY-01 | Operación | no hay Dockerfile de API/web ni estrategia de rollback verificable | CONFIRMADO | 4 | 4 | Alta | P1 |

### 3.2 Hallazgos prioritarios con causa y corrección

#### SEC-01 — BOLA entre sucursales al eliminar archivos

- **Categoría:** autorización / aislamiento multiclínica.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) `listPatientFiles`, upload y download validan paciente o `patient.branchId`; `deletePatientFile` consulta solo `id`, `patientId`, `organizationId` y `deletedAt` (`documents.service.ts:60-78`, `160-171`, `481-488`, `709-723`).
- **Impacto real:** (Seguro) usuario autorizado en sucursal A puede ocultar expediente de sucursal B dentro de misma organización.
- **Probabilidad:** (Probable) alta cuando IDs aparecen en URLs, logs, historial o soporte.
- **Severidad / prioridad:** **Crítica / P0**.
- **Componente afectado:** `DocumentsService`, endpoint DELETE de archivos de paciente.
- **Por qué importa en producción:** (Seguro) viola aislamiento clínico y trazabilidad; es operación destructiva aunque sea soft delete.
- **Cómo verificar:** crear paciente/archivo en B; autenticar usuario limitado a A con `patients.files.manage`; DELETE debe devolver 404/403 y no modificar `deletedAt`.
- **Recomendación concreta:** llamar `ensurePatient(actor, patientId)` antes de buscar; agregar relación `patient: { branchId: branchScope(actor) }`; hacer update condicional; prueba negativa API con dos sucursales.

#### AUTH-01 — Cambio de contraseña deja sesiones vigentes

- **Categoría:** autenticación / respuesta a compromiso.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) `changePassword` actualiza hash e invalida caché, pero no ejecuta `session.updateMany` (`auth.service.ts:309-330`).
- **Impacto real:** (Seguro) un refresh token robado sigue emitiendo access tokens hasta expirar, aun después de cambiar contraseña.
- **Probabilidad:** media-alta.
- **Severidad / prioridad:** **Crítica / P0**.
- **Cómo verificar:** iniciar dos sesiones, cambiar contraseña en una, intentar refresh en segunda; hoy debe seguir funcionando.
- **Recomendación concreta:** dentro de misma transacción actualizar password y revocar todas las sesiones; opcionalmente conservar la sesión actual solo mediante rotación explícita y `tokenId` conocido.

#### AUTH-02 — Refresh O(n · bcrypt) accesible sin autenticación

- **Categoría:** autenticación / rendimiento / DoS.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) `refresh()` usa `session.findMany` para todas las sesiones activas y `findMatchingSession()` itera con `bcrypt.compare` secuencial (`auth.service.ts:165-178`, `260-269`). El JWT incluye `tokenId`, pero `Session` no lo persiste ni indexa (`schema.prisma:6173-6185`).
- **Impacto real:** (Seguro) costo y latencia crecen con sesiones activas; tokens aleatorios obligan trabajo criptográfico repetido.
- **Probabilidad:** alta en crecimiento normal o abuso.
- **Severidad / prioridad:** **Crítica / P0**.
- **Cómo verificar:** sembrar 100/1,000/10,000 sesiones y medir p50/p95 de refresh válido e inválido.
- **Recomendación concreta:** persistir `tokenId`/selector único, verificar firma para extraer selector, consultar una sesión y comparar solo ese hash; mantener rotación y detección de replay.

#### DR-01 — Recuperación no demostrada y backups incompletos

- **Categoría:** continuidad / pérdida de datos.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) hay dumps de 5 MB y 4.8 MB, pero también dos artefactos de 0 bytes. `db-backup.cjs` abre archivo antes de saber si `pg_dump` terminó y no elimina fallo (`scripts/db-backup.cjs:6-28`). Docker impidió ejecutar restore drill actual. El runbook exige scheduler externo, cifrado y restore mensual, pero no prueba su ejecución (`docs/runbooks/production-operations.md:44-62`).
- **Impacto real:** (Seguro) pérdida de DB o archivos clínicos podría ser irreversible; dump no incluye `storage/`.
- **Probabilidad:** media; impacto crítico.
- **Severidad / prioridad:** **Crítica / P0**.
- **Cómo verificar:** backup cifrado, checksum, restore a DB temporal, conteos/constraints/migraciones, recuperación de un archivo clínico y un reporte.
- **Recomendación concreta:** definir RPO/RTO; escribir a `.partial` y renombrar solo tras éxito; borrar fallos; backup DB + object storage; copia offsite cifrada; restore drill automatizado con evidencia y alertas.

#### FILE-01 — Carga de archivos confía en metadatos controlados por cliente

- **Categoría:** archivos / malware / privacidad.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) `isAllowedFile` acepta MIME **o** extensión (`documents.service.ts:654-655`); ambos vienen del upload y no se inspeccionan magic bytes (`documents.service.ts:109-125`).
- **Impacto real:** (Probable) contenido ejecutable o malicioso puede almacenarse como expediente y distribuirse a usuarios.
- **Probabilidad:** alta sin gateway adicional.
- **Severidad / prioridad:** **Alta / P1**.
- **Recomendación concreta:** matriz extensión+MIME+firma real, AV/quarantine, tamaño por tipo, `Content-Disposition: attachment` para activos no renderizables y tests con archivos polyglot.

#### CON-01 — Reagendado concurrente puede crear solapamientos

- **Categoría:** concurrencia / agenda.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) creación usa advisory locks y revalida dentro de transacción (`appointments.service.ts:1278-1310`); `reschedule` valida reglas antes y luego actualiza en transacción sin lock ni reconsulta (`appointments.service.ts:735-834`).
- **Impacto real:** doble reserva de profesional/sillón bajo carreras.
- **Probabilidad:** media-alta en recepción concurrente.
- **Severidad / prioridad:** **Alta / P1**.
- **Recomendación concreta:** reutilizar `lockAndRevalidate` para update/reschedule, ordenar lock keys, revalidar dentro de transacción y agregar prueba concurrente real contra PostgreSQL.

#### DATA-01 — Última escritura gana al editar ficha de paciente

- **Categoría:** integridad / concurrencia.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) `Patient` no tiene `version` (`schema.prisma:2718-2828`); update lee snapshot y reemplaza contactos/alertas dentro de transacción sin compare-and-swap (`patients.service.ts:1061-1205`).
- **Impacto real:** dos recepcionistas pueden sobrescribir silenciosamente datos personales, contactos o alertas médicas.
- **Probabilidad:** alta con varias sucursales/usuarios.
- **Severidad / prioridad:** **Alta / P1**.
- **Recomendación concreta:** `version` o `updatedAt` esperado en DTO; `updateMany where id+version`; 409 en conflicto; merge explícito para colecciones.

#### JOB-01 — Campañas de email no tienen claim por recipient

- **Categoría:** workers / idempotencia.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) worker selecciona campañas `QUEUED` o `SENDING`; solo reclama las `QUEUED`. Dos instancias pueden tomar una `SENDING`. Cada recipient se actualiza a `QUEUED` sin compare-and-swap antes de enviar (`email-marketing.worker.ts:33-65`, `115-123`).
- **Impacto real:** mensajes duplicados, límites diarios rebasados y pérdida de confianza.
- **Probabilidad:** alta al horizontalizar.
- **Severidad / prioridad:** **Alta / P1**.
- **Recomendación concreta:** lease/claim atómico por recipient, `SKIP LOCKED`, idempotency key en proveedor, expiración/recovery y prueba con dos workers.

#### SCALE-01 — Reportes cargan 50,000 filas y silencian excedente

- **Categoría:** escalabilidad / exactitud.
- **Nivel de evidencia:** **CONFIRMADO**.
- **Evidencia técnica:** (Seguro) provider usa `findMany(... take: 50_000)` y normaliza todo en memoria (`period-report-provider.service.ts:111-117`). La generación posterior base64/XLSX amplifica memoria.
- **Impacto real:** reportes incompletos sin advertencia y OOM/latencia en periodos amplios.
- **Probabilidad:** alta en históricos grandes.
- **Severidad / prioridad:** **Alta / P1**.
- **Recomendación concreta:** paginación por cursor/stream, snapshot de filtros, límites explícitos con error visible, export async, almacenamiento compartido y pruebas de exactitud >50k.

#### SUP-01 — Dependencias con vulnerabilidades conocidas

- **Categoría:** supply chain.
- **Nivel de evidencia:** **CONFIRMADO** al 2026-08-26.
- **Evidencia técnica:** (Seguro) `npm audit --omit=dev --audit-level=low` reportó 19 vulnerabilidades: 12 altas, 5 moderadas, 2 bajas. Incluye cadenas de Axios, body-parser, Multer, React Router y Swagger/js-yaml.
- **Impacto real:** variable; (Seguro) no todas son explotables en runtime, pero uploads y parser sí están en superficie API.
- **Probabilidad:** media-alta.
- **Severidad / prioridad:** **Alta / P1**.
- **Recomendación concreta:** actualizar por cadena directa, revisar breaking changes, regenerar lock, reejecutar unit/integration/E2E; no usar `npm audit fix --force` ciegamente.

### 3.3 Seguridad, autenticación y autorización

#### Controles confirmados

- (Seguro) Helmet, compresión, CORS configurado, límite JSON de 2 MB, trusted proxy por allowlist, validación global con whitelist y excepción global están registrados en `main.ts`.
- (Seguro) contraseñas usan bcrypt costo 12; login uniforma error de credenciales; access token 15 min y refresh 7 días por default.
- (Seguro) cookie refresh es HttpOnly, Secure en producción y SameSite=Lax.
- (Seguro) rate limiting utiliza Redis compartido y falla cerrado si Redis no responde.
- (Seguro) `/metrics` exige token y devolvió 401 sin él; `/health/live` y `/health/ready` devolvieron 200 localmente.
- (Seguro) 47 controllers / 715 endpoints se clasificaron: 673 RBAC, 4 JWT y 38 públicos/webhook.
- (Seguro) auditoría DB de permisos pasó con 100 permisos canónicos, 459 registros clasificados, 288 keys usadas por guards, 9 roles esperados y cero asignaciones directas.

#### Límites de la evidencia

- (Seguro) el auditor de rutas es regex/vecindad de líneas; no demuestra comportamiento real de los 715 endpoints ni aislamiento negativo.
- (Seguro) `BranchAccessGuard` existe pero no se usa en controllers; el aislamiento depende de que cada servicio invoque `branchScope`/`assertBranchAccess` correctamente.
- (Seguro) `AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE` cae a `true` y `.env.example` lo deja activo (`auth.controller.ts:64-71`, `.env.example:9-10`). Esto expone refresh token a JavaScript para compatibilidad.
- (Seguro) validación de entorno solo exige DB y dos JWT secrets (`environment.validation.ts:1-9`) y no rechaza `change-me-*` en producción.
- (Seguro) sanitizer global transforma todas las strings; no reemplaza sanitización contextual de HTML y puede alterar datos legítimos.
- (Probable) sinks `dangerouslySetInnerHTML` con HTML histórico/importado pueden derivar en stored XSS. El sanitizador de encuestas es una regex casera (`public-survey-page.tsx:125-126`), no una política robusta.
- (Seguro) logs estructurados redactan claves sensibles, pero URL completa puede incluir búsquedas o identificadores clínicos; no hay evidencia de retención/rotación centralizada.

### 3.4 Matriz representativa de endpoints críticos

| Dominio / operación | Auth | Permiso | Scope organización | Scope sucursal | Validación | Rate limit | Auditoría | Resultado |
|---|---|---|---|---|---|---|---|---|
| Auth login/refresh | Público | N/A | tras identidad | N/A | DTO | Redis | parcial | Parcial; refresh bloqueante |
| Paciente lectura/update | JWT | granular | Sí | Sí en query | DTO | global | manual + global | Parcial; lost update |
| Archivo listar/subir/descargar | JWT | granular | Sí | Sí | DTO/tamaño | global | manual | Parcial; contenido no inspeccionado |
| Archivo eliminar | JWT | `patients.files.manage` | Sí | **No** | DTO | global | manual | **P0** |
| Cita crear/batch | JWT | granular | Sí | Sí | DTO/reglas | global | manual | Implementado con lock |
| Cita reagendar | JWT | granular | Sí | Sí | DTO/reglas | global | manual | Parcial; carrera |
| Pago/void/refund | JWT | granular | Sí | branch en servicios | DTO | global | manual | Parcial; buena transacción, falta E2E real |
| Payment webhook | Público | secreto | deriva del link | deriva del link | payload | global | evento DB | Parcial; secreto global/carrera retry |
| Report request/download | JWT | granular | Sí | Sí | filtros | global | historial DB | Parcial; límite/memoria/storage |
| Health | Público | N/A | N/A | N/A | N/A | exento | N/A | Implementado DB/Redis |
| Metrics | token técnico | N/A | N/A | N/A | bearer | global | N/A | Implementado local; no agregado |

### 3.5 Integridad de datos y concurrencia

- (Seguro) PostgreSQL local reportó 98 migraciones aplicadas y esquema al día.
- (Seguro) Prisma contiene 244 modelos, 125 enums, 521 índices y 188 restricciones únicas.
- (Seguro) verificación financiera pasó nueve CHECK constraints para importes no negativos de pagos, caja, planes, refunds e installments.
- (Seguro) migración de constraints y scripts de reconciliación están sin seguimiento; no se puede afirmar que otro entorno los reciba.
- (Seguro) pagos clave usan transacciones serializables e idempotencia con unique organization+key.
- (Seguro) creación de citas usa advisory locks; reagendado no.
- (Seguro) ficha principal de paciente carece de control optimista, aunque coberturas y otros catálogos sí tienen `version`.
- (Seguro) webhook comprueba duplicados y unique key, pero dos solicitudes simultáneas pueden terminar en éxito + unique violation/500 en vez de respuesta idempotente uniforme.

### 3.6 Arquitectura y mantenibilidad

| Señal | Resultado | Lectura |
|---|---:|---|
| Archivos productivos | 607 | (Seguro) monorepo grande y modular por carpetas. |
| Archivos >1,000 líneas | 33 | (Seguro) concentración severa de responsabilidades. |
| `treatment-plans.service.ts` | 5,760 líneas auditadas | (Seguro) costo de cambio y prueba alto. |
| `payments.service.ts` | 5,703 líneas auditadas | (Seguro) dominio financiero demasiado centralizado. |
| Rutas API / web | 715 / 347 | (Seguro) superficie extensa; contratos pasaron. |
| Auditoría arquitectura | FAIL | (Seguro) nuevo `orthodontic-plan-workspace.tsx` supera umbral sin baseline. |

(Seguro) No se recomienda reescritura, microservicios ni Kubernetes como respuesta inicial. La corrección de mayor ROI es extraer boundaries por dominio, formalizar políticas transversales y endurecer gates.

### 3.7 Escalabilidad y multiinstancia

| Área | 10k entidades | 100k entidades | 1M entidades | Evidencia |
|---|---|---|---|---|
| Pacientes/listados paginados | Probable operable | Requiere EXPLAIN/carga | No verificado | índices y paginación, sin benchmark |
| Sesiones/refresh | Riesgo visible | Degradación severa | No viable | O(n·bcrypt) confirmado |
| Reportes | Operable bajo límite | truncamiento/memoria | No viable actual | `take: 50_000` |
| Archivos | Disco local crece | operación compleja | no horizontal | storage local sin lifecycle |
| Campañas | una instancia | duplicidad probable | no viable actual | claim incompleto |
| Redis invalidación | tolerable | riesgo de bloqueo | riesgo alto | `KEYS auth:user:*` |

(Seguro) No hay benchmark que permita prometer latencia, throughput o cantidad máxima de clínicas. Cualquier cifra sería inventada.

### 3.8 Resiliencia, backup y recuperación

| Control | Estado | Evidencia |
|---|---|---|
| Backup DB manual | Parcial | dumps existentes; dos de 0 bytes |
| Checksum automático | Faltante | runbook manda comando manual |
| Cifrado/offsite | No verificado | instrucción, no evidencia de ejecución |
| Retención | No definida | no policy automatizada localizada |
| Backup de `storage/` | Faltante | script solo ejecuta `pg_dump` |
| Restore drill actual | No verificado | Docker bloqueado en entorno de auditoría |
| RPO | Faltante | no definido |
| RTO | Faltante | no definido |
| Rollback app | No verificado | sin artefacto/despliegue versionado demostrado |
| Readiness | Implementado | DB + Redis local 200 |

### 3.9 Observabilidad y auditoría

- (Seguro) request IDs, JSON logs, redacción, exception filter, health y métricas Prometheus básicas existen.
- (Seguro) métricas se acumulan en memoria por proceso y se pierden al reiniciar; no se demostró Prometheus externo, dashboards ni alertas reales.
- (Seguro) health cubre proceso, DB y Redis, no almacenamiento, cola/workers ni proveedores externos.
- (Seguro) interceptor global audita POST/PATCH/PUT/DELETE en fire-and-forget, guarda método/ruta/requestId, pero no estado de negocio before/after (`audit-trail.interceptor.ts:17-53`). Servicios críticos agregan auditoría manual de calidad variable.
- (Seguro) no se encontró Sentry/APM/OpenTelemetry ni política de rotación/retención en repositorio.

### 3.10 Calidad frontend y UX técnica

- (Seguro) build Vite pasó; chunk mayor observado: `vendor-core` 532 kB raw / 169 kB gzip. Existen rutas con lazy loading razonable.
- (Seguro) Vite advirtió import dinámico inefectivo de `features/novedades/index.ts` porque también se importa estáticamente.
- (Seguro) `ui:audit` falló por regresiones: 442 hex hardcoded (baseline 396), 252 anchos arbitrarios (223), 54 overflows horizontales sin marcar, 161 radios grandes (144), 46 sombras (43) y 17 gradientes (11).
- (Seguro) navegador local mostró login completo sin errores de consola y redirigió `/agenda/lista` a `/iniciar-sesion` sin sesión.
- (Seguro) accesibilidad automatizada y UX autenticada móvil/escritorio quedan **NO VERIFICADAS** por bloqueo de Chromium y falta de credenciales.

### 3.11 CI/CD y reproducibilidad

- (Seguro) workflow local incluye Postgres/Redis, instalación, generación Prisma, migración desde cero, seed CI, reconciliación, contratos, permisos, typecheck, tests y build.
- (Seguro) directorio `../.github/` está sin seguimiento; el workflow no forma parte del commit auditado.
- (Seguro) arquitectura/UI y E2E tienen `continue-on-error: true`; no bloquean entrega (`dentalink-ci.yml:118-154`).
- (Seguro) no hay Dockerfile de API o web; compose solo levanta PostgreSQL y Redis.
- (Seguro) no se demostró staging, migración expand/contract, canary, blue/green ni rollback reproducible.

### 3.12 Puntuación de madurez

Escala: 0 inexistente, 5 parcial/no probado, 10 production-grade demostrado.

| Área | Nota /10 | Justificación |
|---|---:|---|
| Seguridad | 4.5 | P0 de sucursal, uploads débiles, deps altas; buenos headers/rate limit |
| Autenticación | 4.5 | tokens/cookies correctos; revocación y lookup críticos |
| Autorización | 6.0 | catálogo/roles reconciliados; scoping descentralizado con hueco real |
| Integridad de datos | 6.5 | constraints y transacciones; lost updates y migración sin seguimiento |
| Arquitectura | 5.0 | módulos claros; 33 god files |
| Escalabilidad | 4.0 | Redis/índices; refresh, reports, storage y workers bloquean |
| Performance | **NO VERIFICADO** | no hay carga/benchmark; solo señales estáticas |
| Concurrencia | 5.5 | creación cita/pagos sólidos; update/reagendado incompletos |
| Resiliencia | 4.0 | readiness y retries parciales; dependencias locales fuertes |
| Backups | 3.0 | dumps presentes, proceso permite 0 bytes y no cubre storage |
| Recuperación | 2.0 | restore actual/RPO/RTO no demostrados |
| Observabilidad | 4.5 | logs/IDs/metrics base; sin agregación/APM/retención demostrada |
| Testing | 6.0 | 691 tests unit/component; E2E crítico ausente/no ejecutable |
| API | 6.0 | contratos y validación; superficie enorme sin negativa exhaustiva |
| DevOps | 3.5 | workflow útil pero no versionado; gates informativos; sin imagen app |
| Mantenibilidad | 4.0 | lint pasa al límite con 641 warnings; god files |
| Multi-sucursal | 5.0 | scoping amplio, un P0 confirmado |
| Producción | 4.0 | buenos cimientos, gates críticos abiertos |

### 3.13 Puntuación ejecutiva /100

| Dimensión | Nota |
|---|---:|
| Seguridad | 45/100 |
| Escalabilidad | 40/100 |
| Integridad de datos | 65/100 |
| Arquitectura | 50/100 |
| Observabilidad | 45/100 |
| Testing | 60/100 |
| Multi-sucursal | 50/100 |
| Preparación productiva | **40/100** |

### 3.14 Top 10 riesgos antes de producción

1. (Seguro) **P0:** borrar lógicamente archivos de otra sucursal.
2. (Seguro) **P0:** sesiones robadas sobreviven al cambio de contraseña.
3. (Seguro) **P0:** refresh público O(n·bcrypt), vector de degradación/DoS.
4. (Seguro) **P0:** recuperación no demostrada; backup no cubre storage y deja artefactos de 0 bytes.
5. (Seguro) **P1:** uploads clínicos sin inspección real, AV ni lifecycle seguro.
6. (Seguro) **P1:** reagendado concurrente puede producir doble reserva.
7. (Seguro) **P1:** edición simultánea de paciente pierde cambios silenciosamente.
8. (Seguro) **P1:** campañas multiinstancia pueden enviar duplicados.
9. (Seguro) **P1:** reportes se truncan a 50k y cargan todo en memoria/disco local.
10. (Seguro) **P1:** CI real no contiene todavía workflow/gates y hay 12 vulnerabilidades altas reportadas.

### 3.15 Top 10 cambios de mayor ROI

1. (Seguro) Cerrar `deletePatientFile` por sucursal y añadir test negativo A→B.
2. (Seguro) Revocar sesiones al cambiar password; desactivar refresh token en JSON.
3. (Seguro) Indexar selector/tokenId de sesión y eliminar scan bcrypt global.
4. (Seguro) Definir RPO/RTO y demostrar restore DB + storage con checksum/cifrado/offsite.
5. (Seguro) Validar firma real de archivos, quarantine/AV y cleanup físico transaccional.
6. (Seguro) Aplicar locks/revalidación a create **y** reschedule/update de citas.
7. (Seguro) Añadir optimistic concurrency a Patient y entidades clínicas mutables.
8. (Seguro) Implementar claim/lease idempotente por recipient y almacenamiento compartido.
9. (Seguro) Hacer reportes cursor/stream + async, sin truncamiento silencioso.
10. (Seguro) Versionar CI y convertir seguridad, arquitectura y E2E de negocio en gates bloqueantes; actualizar dependencias de forma dirigida.

### 3.16 Plan de remediación por etapas

#### Etapa A — Bloqueadores inmediatos (P0, 1–3 días)

- (Seguro) Corregir scope de borrado de archivos y prueba de aislamiento inter-sucursal.
- (Seguro) Revocar sesiones en cambio de contraseña y `AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE=false` en producción.
- (Seguro) Rediseñar lookup de refresh con selector único e índice.
- (Seguro) Definir RPO/RTO; producir backup verificable de DB+storage y ejecutar restore drill no destructivo.
- (Seguro) Validación de salida: ninguna operación A→B, sesiones antiguas 401, refresh p95 estable respecto a número de sesiones, restore completo reproducible.

#### Etapa B — Alto riesgo (P1, semana 1–2)

- (Seguro) Upload hardening, storage abstraction y lifecycle/delete real sujeto a retención clínica.
- (Seguro) Locks de reagendado y optimistic concurrency de Patient.
- (Seguro) Idempotencia/claim de email y webhook retry uniforme.
- (Seguro) Actualización dirigida de dependencias altas.
- (Seguro) CI versionado y blocking gates mínimos.

#### Etapa C — Escalabilidad y rendimiento (semana 2–4)

- (Seguro) Cursor/stream de reportes, storage compartido y error explícito de límites.
- (Seguro) Reemplazar Redis `KEYS` por versionado/SCAN o invalidación por conjunto.
- (Seguro) Load tests de auth, pacientes, agenda, pagos y reportes con datasets 10k/100k.
- (Seguro) Presupuesto de bundle y corrección de chunks/imports.

#### Etapa D — Resiliencia y observabilidad (semana 3–5)

- (Seguro) Prometheus externo o equivalente, dashboards, alertas, retención de logs y APM/error tracking.
- (Seguro) health de storage/workers/proveedores; métricas de cola y latencia DB.
- (Seguro) leases, retries, dead-letter operacional y runbooks ensayados.

#### Etapa E — Mantenibilidad y evolución (incremental)

- (Seguro) Extraer treatment plans, payments, patients y reports por casos de uso, sin reescritura big-bang.
- (Seguro) Reducir warnings y convertir baseline en tendencia descendente.
- (Seguro) Centralizar política organization/branch para impedir omisiones futuras.
- (Seguro) Incorporar contratos de seguridad y concurrencia a templates de módulos.

## 4. Plan de Verificación y Pruebas

### 4.1 Comandos ejecutados y resultado

| Comando / validación | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint:regression` | PASS: 0 errores, 641 warnings, límite 641 |
| `npm test --workspace=@dentalwarner/api -- --runInBand` | PASS: 69 suites, 421 tests |
| `npm test --workspace=@dentalwarner/web -- --maxWorkers=1` | PASS: 67 archivos, 270 tests |
| `npm run build` | PASS con warning de chunk/import dinámico |
| `npm run contracts:routes` | PASS: 715 API, 347 web |
| `npm run permissions:audit` | PASS estático, con límites descritos |
| `npm run permissions:audit --workspace=@dentalwarner/database` | PASS: catálogo/DB/roles reconciliados |
| `npm run db:migrate:status` | PASS local: 98 migraciones, schema up to date |
| `npm run financial:constraints:verify --workspace=@dentalwarner/database` | PASS: 9 constraints |
| `npm run architecture:audit` | FAIL: 33 god files; archivo nuevo sobre umbral |
| `npm run ui:audit --workspace=@dentalwarner/web` | FAIL: regresiones sobre baseline |
| `npm audit --omit=dev --audit-level=low` | FAIL: 19 vulnerabilidades, 12 altas |
| `npx playwright test --list` | 238 tests enumerados |
| `npx playwright test` | NO VERIFICADO: Chromium `spawn EPERM` |
| `docker compose ps` / restore verify | NO VERIFICADO: acceso al daemon bloqueado |
| Navegador local `/login` | PASS visual/DOM; sin errores consola |
| Navegador local ruta privada | PASS: redirección a `/iniciar-sesion` |
| `GET /health/live` | 200 |
| `GET /health/ready` | 200, DB+Redis connected |
| `GET /metrics` sin token | 401 |

### 4.2 Gates obligatorios antes de cambiar el semáforo

#### Gate G0 — Seguridad de tenant

- [ ] DELETE/GET/PATCH por ID de otra organización devuelve 404/403.
- [ ] Mismos casos entre sucursales para los nueve roles.
- [ ] Test específico de `deletePatientFile` A→B.
- [ ] Fuzz de IDs en pacientes, citas, expedientes, pagos, reportes y configuraciones.

#### Gate G1 — Sesiones

- [ ] cambio de password revoca todos los refresh tokens previos.
- [ ] refresh lookup consulta una sesión por selector único.
- [ ] replay de refresh rotado falla cerrado.
- [ ] secrets default o débiles detienen boot en `NODE_ENV=production`.
- [ ] refresh token no aparece en JSON productivo.

#### Gate G2 — Integridad y concurrencia

- [ ] dos reagendados concurrentes no pueden ocupar mismo recurso.
- [ ] dos updates de Patient producen uno exitoso y uno 409, no lost update.
- [ ] doble webhook concurrente conserva una sola aplicación y responde idempotente.
- [ ] constraints financieras verificadas desde migración limpia.

#### Gate G3 — Recuperación

- [ ] RPO y RTO aprobados.
- [ ] backup DB+storage cifrado, checksum y offsite.
- [ ] restore a entorno aislado desde cero con evidencia.
- [ ] cero artefactos `.dump` vacíos presentados como backup válido.

#### Gate G4 — E2E negocio

- [ ] paciente → cita → llegada → atención → plan/presupuesto → pago → cierre caja.
- [ ] cancelación/reagendado con reglas y concurrencia.
- [ ] usuario/rol/sucursal y negativos de permiso.
- [ ] report request → worker → descarga → recarga/historial.
- [ ] viewport móvil y desktop con axe en rutas prioritarias.

#### Gate G5 — Escala y operación

- [ ] carga de refresh con 10k sesiones sin pendiente proporcional a n.
- [ ] pacientes/listados con 100k registros y EXPLAIN ANALYZE capturado.
- [ ] reporte >50k completo o rechazo explícito, sin truncamiento.
- [ ] dos instancias API/workers sin duplicar emails/jobs.
- [ ] rollback probado con migración compatible.

### 4.3 Comandos exactos para repetir baseline

```powershell
npm run db:migrate:status
npm run permissions:audit
npm run permissions:audit --workspace=@dentalwarner/database
npm run financial:constraints:verify --workspace=@dentalwarner/database
npm run contracts:routes
npm run typecheck
npm run lint:regression
npm test --workspace=@dentalwarner/api -- --runInBand
npm test --workspace=@dentalwarner/web -- --maxWorkers=1
npm run build
npm run architecture:audit
npm run ui:audit --workspace=@dentalwarner/web
npm audit --omit=dev --audit-level=low
npm run test:e2e --workspace=@dentalwarner/web
npm run db:restore -- --verify
```

### 4.4 Criterio de salida

(Seguro) Dentalink solo debe pasar de rojo a ámbar cuando G0–G3 estén completos y reproducibles. Puede pasar a verde cuando G4–G5 sean bloqueantes en CI, exista restore probado, no haya P0/P1 abiertos de aislamiento/sesiones/integridad y métricas productivas demuestren comportamiento bajo carga esperada.

## Apéndice A — Evidencia de inventario

- (Seguro) Stack: NestJS 11, React 19, Vite 8, Prisma 7, PostgreSQL 16 y Redis 7.
- (Seguro) Compose local solo contiene PostgreSQL y Redis.
- (Seguro) base local: 98 migraciones aplicadas.
- (Seguro) superficie: 715 endpoints API y 347 rutas web detectadas por contratos.
- (Seguro) permisos efectivos: 100 canónicos, 459 rows clasificadas, 288 keys usadas por guards, 9 roles.
- (Seguro) pruebas: 421 API + 270 web; 238 E2E enumerados pero no ejecutados.
- (Seguro) árbol sucio: resultados representan estado local actual, no exclusivamente el commit `2b0ad1b`.

## Apéndice B — Supuestos y evidencia faltante

- (Seguro) **NO VERIFICADO:** despliegue real, dominio/TLS, balanceador, secretos, proveedor de correo, pagos externos, antivirus, object storage y observabilidad central.
- (Seguro) **NO VERIFICADO:** volumen y distribución reales por clínica.
- (Seguro) **NO VERIFICADO:** restore más reciente y recuperación de binarios.
- (Seguro) **NO VERIFICADO:** E2E autenticado de los nueve roles.
- (Seguro) **NO VERIFICADO:** latencia p50/p95/p99 y throughput bajo 10k/100k/1M.
- (Seguro) Estas ausencias no se reinterpretan como fallas confirmadas; sí impiden declarar producción lista.
