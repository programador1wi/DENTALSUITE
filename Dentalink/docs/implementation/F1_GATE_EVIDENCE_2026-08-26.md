# Evidencia Gate F1 — 2026-08-26

## Alcance

Este documento registra evidencia reproducible del cierre local de los bloqueadores P0 de aislamiento multiclínica, sesiones y recuperación. No autoriza producción por sí solo: PITR administrado, copia externa y un restore con el volumen productivo real requieren evidencia del entorno de despliegue.

## Aislamiento multiclínica

- La eliminación de archivos exige `organizationId`, `patientId` y `branchScope(actor)` tanto en la lectura como en el `updateMany` condicional.
- Lectura, soft delete y auditoría se ejecutan en una sola transacción.
- Un `count` distinto de uno produce `NotFoundException`; no revela si el recurso existe fuera del scope.
- Las pruebas unitarias cubren paciente de otra sucursal, archivo de otra sucursal o inexistente y eliminación válida con auditoría.

## Sesiones y refresh

- El `tokenId` firmado identifica directamente una única fila `Session.id`; no existe fallback que recorra sesiones ni bcrypt lineal.
- La rotación reclama la sesión anterior con `updateMany` condicionado a usuario, revocación y expiración. Una segunda rotación concurrente obtiene `count = 0` y se rechaza.
- El cambio de contraseña revoca todas las sesiones activas dentro de la transacción.
- La migración `20260826123000_revoke_legacy_refresh_sessions` revoca sesiones legacy para forzar un inicio de sesión único después del switch.
- Producción rechaza refresh en JSON; la web usa cookie `HttpOnly`, `Secure`, `SameSite=Lax`.

## Recuperación

- Backup PostgreSQL: escritura `.partial`, validación del proceso, tamaño mínimo, SHA-256, manifest y publicación mediante rename atómico.
- Restore PostgreSQL: valida manifest, tamaño y checksum antes de invocar PostgreSQL; usa `--exit-on-error` y limpia la base temporal.
- Backup de storage: manifiesto cifrado y archivos cifrados individualmente con AES-256-GCM, hashes SHA-256 y publicación atómica. Rechaza symlinks y rutas que escapen del destino.
- Backup DB real verificado: `dentalwarner-2026-08-26T21-17-41-039Z.dump`, SHA-256 `7a4983d7dffe7779865f70b3b5ac22f5c9ea5b0ca81011c3b1f168de4622a64a`.
- Restore aislado real verificado: 245 tablas; 1 organización, 37 sucursales, 236 usuarios, 9 roles, 459 permisos, 419 pacientes y 15,080 citas. La base temporal fue eliminada después de verificar integridad.
- El 27 de agosto se detectó que el valor por defecto del backup apuntaba a `Dentalink/storage`, pero los servicios históricos escribían en `apps/api/storage` por depender de `process.cwd()`. Ese falso positivo reabrió recuperación hasta corregir la raíz canónica.
- `storage-backup.cjs` usa ahora `apps/api/storage` de forma independiente al directorio de ejecución. Un drill aislado cifró, verificó y restauró 14/14 archivos reales; los dos directorios temporales del drill fueron eliminados después de validar integridad.
- El secreto operativo de backup no existe en el entorno local y el comando falla cerrado. El drill usó una clave efímera; no sustituye secreto externo, copia off-host ni restore del volumen productivo.

## Comandos ejecutados y resultado

```powershell
npm run lint:regression
# PASS: errors=0, warnings=637, limit=641

npm run db:backup:test
# PASS: 3/3

npm run storage:backup:test
# PASS: 2/2

npm test --workspace=@dentalwarner/api -- --runInBand
# PASS: 70 suites, 434 tests

npm test --workspace=@dentalwarner/web -- --maxWorkers=1
# PASS: 68 archivos, 273 tests

npm run typecheck
# PASS

npm run build
# PASS; permanecen advertencias conocidas de chunks/import de novedades

npm run contracts:routes
# PASS: 715 rutas API, 347 rutas web

npm run permissions:audit
npm run permissions:audit --workspace=@dentalwarner/database
# PASS: 100 permisos canónicos, 459 filas DB, 288 guards, 9 roles, sin brechas

npm run financial:constraints:verify --workspace=@dentalwarner/database
# PASS: 9 constraints

npm run db:migrate:status
# PASS: 102 migraciones aplicadas; esquema actualizado
```

## Estado del gate

- **Gate F1 local:** aprobado para algoritmo DB + storage no vacío; la corrección de raíz elimina el falso positivo anterior.
- **Gate productivo:** bloqueado hasta demostrar PITR/WAL con pérdida máxima de 15 minutos, copia de backups fuera del host y restore DB + storage representativo dentro de 2 horas.
- Este bloqueo externo no debe ocultarse elevando una puntuación ni sustituyéndose por pruebas unitarias.
