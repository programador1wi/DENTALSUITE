# Evidencia F2 — seguridad e integridad (parcial)

## Archivos clínicos

- Uploads binarios validan extensión, MIME declarado y magic bytes; contenido disfrazado se rechaza y audita antes de persistir.
- `ObjectStoragePort` desacopla proveedores local y S3-compatible. Producción rechaza proveedor local.
- `ClinicalFileStorageService` escanea antes de persistir, cifra con AES-256-GCM y verifica SHA-256 después de descifrar. Producción exige ClamAV; desarrollo queda marcado `SKIPPED`, nunca `CLEAN`.
- `FileAttachment` conserva `url` y añade metadata nullable de storage, checksum, MIME detectado, escaneo y versión de cifrado mediante migración expand.
- Lectura nueva usa object storage; filas históricas sin `storageKey` conservan fallback filesystem durante backfill.
- Backfill idempotente: inventario por defecto y `--apply` explícito. La ejecución local migró 2/2 binarios elegibles, releyó y verificó checksum; segunda ejecución migró 0. No eliminó fuentes legacy.
- Inventario local restante: 525 filas clasificadas como enlaces metadata/seed y 0 binarios administrados faltantes. Contract seguirá bloqueado hasta repetir esta clasificación sobre copia productiva.

## Integridad y entrada no confiable

- Pacientes usan compare-and-swap por `version`; cambios secundarios ocurren después de reclamar versión dentro de la misma transacción.
- Create, update, reschedule y reprogramación usan una política compartida de advisory locks ordenados para cita, profesional, sillón y paciente/día; conflictos se revalidan dentro de la transacción y devuelven 409.
- Webhooks fallan cerrado sin secreto, comparan en tiempo constante y manejan colisión idempotente concurrente sin duplicar efectos.
- Providers manuales no ejecutan efectos automáticos.
- Texto plano y rich text están separados; API usa allowlist mantenida y web centraliza renders en `SafeHtml`/`SafeSvg` con DOMPurify. El editor sanea entrada, salida y pegado.
- Backfill rich text trabaja en dry-run por defecto, usa compare-and-swap y conserva original + checksums en `RichTextSanitizationBackup`; no altera consentimientos firmados ni snapshots legales. El inventario local inspeccionó 3 campos y encontró 0 cambios pendientes; pruebas cubren HTML malicioso y carrera concurrente.

## Dependencias

- Cadenas parchadas y verificadas: Axios 1.20.0, React Router 7.18.2, Nest platform 11.2.3/Multer 2.2.0 y Swagger 11.4.7/js-yaml 5.3.0.
- Prisma Client/adapter/CLI están alineados en 7.10.0.
- `npm audit --omit=dev` conserva tres altas en el CLI Prisma por `deepmerge-ts@7.1.5`; existe excepción propuesta, no aprobada y con caducidad.
- `npm run audit:production` excluye dev y peers opcionales, elimina esa cadena del árbol runtime y reporta 0 vulnerabilidades; la futura imagen multi-stage deberá demostrar el mismo SBOM.

## Evidencia ejecutada

```powershell
npm test --workspace=@dentalwarner/api -- --runInBand
# PASS: 83 suites, 494 tests

npm test --workspace=@dentalwarner/web -- --pool=threads --maxWorkers=1
# PASS: 68 archivos, 276 tests

npm run typecheck
# PASS

npm run build
# PASS; advertencia conocida de import estático/dinámico de novedades

npm run lint:regression
# PASS: errors=0, warnings=635, limit=641

npm run contracts:routes
# PASS: API 715, web 347

npm run db:migrate:status
# PASS: 104 migraciones
```

## Estado del gate

- **F2 permanece parcial.** Falta integración real S3 + ClamAV, repetir inventario sobre datos productivos, CSP enforcement y cierre/aprobación de la cadena Prisma.
- No se autoriza contract migration, purga física ni producción.
