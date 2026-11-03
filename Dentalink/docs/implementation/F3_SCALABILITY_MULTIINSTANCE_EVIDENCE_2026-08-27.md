# Evidencia F3 — escalabilidad y multiinstancia (parcial)

## Reportes persistentes

- `PeriodReportProviderService` expone `AsyncIterable` y pagina por cursor `id`, con orden estable fecha + id; ya no usa `skip` creciente.
- Worker genérico escribe CSV y XLSX incrementalmente en archivo temporal. No conserva arreglo de filas ni construye base64 para esta ruta.
- XLSX rechaza más de 1,048,575 filas con `LIMIT_EXCEEDED`; CSV no hereda límite de Excel ni trunca silenciosamente.
- Prueba reproducible genera 50,001 filas CSV, verifica última fila, neutralización de fórmulas y progreso cada 5,000 filas.
- `ReportRequest` registra dueño, expiración y heartbeat de lease, próxima ejecución, filas/progreso y código de error.
- Claim usa `FOR UPDATE SKIP LOCKED`; finalización y fallo requieren `leaseOwner`. Lease perdido no puede publicar resultado.
- Reportes se cifran por stream y se cargan mediante `ObjectStoragePort`; clave final es compartible entre instancias y descarga verifica checksum del objeto antes de descifrar.
- Cada intento usa clave física única. Si pierde lease después de almacenar, elimina solo su artefacto y no el resultado de otro worker.

## Email marketing

- Cada recipient se reclama atómicamente con `FOR UPDATE SKIP LOCKED`, dueño, lease, heartbeat, próxima ejecución y backoff.
- `idempotencyKey` del recipient llega al provider SMTP como `Message-ID` determinista.
- Persistencia posterior a aceptación del provider ocurre en transacción y exige dueño del lease.
- Si SMTP aceptó pero falla persistencia, recipient queda `UNCERTAIN` sin reintento automático; evita duplicación silenciosa.
- Lease vencido durante envío también queda `UNCERTAIN` para resolución operacional explícita.
- Dos workers comparten cola sin reclamar el mismo recipient en la prueba de concurrencia.

## Redis y degradación

- Invalidación por patrón ya usa `SCAN`, no `KEYS`.
- Rate limiting compartido falla cerrado en login, refresh, booking público, webhooks y exports.
- Lecturas clínicas ordinarias fallan abierto durante caída Redis y exponen `X-RateLimit-Degraded: redis-unavailable`.

## Evidencia ejecutada

```powershell
npm test --workspace=@dentalwarner/api -- --runInBand
# PASS: 83 suites, 494 tests

npm run typecheck
# PASS: API, web, shared y UI

npm run lint:regression
# PASS: errors=0, warnings=635, limit=641

npm run build
# PASS; permanece advertencia conocida de import estático/dinámico de novedades

npm run contracts:routes
# PASS: API 715, web 347

npm run db:migrate:status
# PASS: 104 migraciones

npm audit --omit=dev --omit=optional --audit-level=low
# PASS: 0 vulnerabilidades
```

## Estado del gate

- **F3 permanece parcial.** Faltan carga reproducible con dataset objetivo y 100 usuarios, p95/error budget, prueba real con dos procesos y PostgreSQL/S3, métricas Redis y resolución manual auditada de recipients `UNCERTAIN`.
- Handlers no genéricos de reportes aún usan generación en memoria; deben migrarse por caso de uso sin cambiar respuestas públicas.
- `progressRows` es real; `progressPercent` solo se fija en 100 al completar porque todavía no existe conteo total barato y estable para todas las fuentes.
- No se autoriza producción ni cierre de F3 con pruebas unitarias como sustituto de carga/multiinstancia real.
