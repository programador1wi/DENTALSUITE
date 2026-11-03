# Operación productiva

## Health checks

- `GET /api/v1/health/live`: proceso Nest activo; no consulta dependencias.
- `GET /api/v1/health/database`: conectividad PostgreSQL.
- `GET /api/v1/health/redis`: conectividad Redis.
- `GET /api/v1/health/ready`: PostgreSQL y Redis disponibles; usar como readiness.
- `GET /api/v1/health`: contrato histórico compatible para PostgreSQL.

El balanceador debe retirar una instancia cuando `ready` responda distinto de `200`, pero no reiniciarla
solo por una dependencia temporalmente caída. `live` determina si el proceso debe reiniciarse.

## Refresh token

La cookie `HttpOnly` es el único contrato productivo. La API debe arrancar con:

```text
AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE=false
```

La migración `20260826123000_revoke_legacy_refresh_sessions` revoca sesiones emitidas antes de que
`Session.id` se utilizara como selector del JWT. Después del despliegue los usuarios legacy deben volver a
iniciar sesión. No reactivar el scan bcrypt como mecanismo de compatibilidad.

## Proxy confiable

Configurar `TRUSTED_PROXY_IPS` con las IP reales del balanceador o reverse proxy, separadas por coma. No usar
`trust proxy=true`: permitiría falsificar la IP usada por auditoría y rate limiting.

## Métricas y alertas

`GET /api/v1/metrics` expone formato Prometheus y exige `Authorization: Bearer <METRICS_BEARER_TOKEN>`.
Además de restringir el token, limitar acceso de red al recolector. Señales disponibles:

- `dentalink_http_requests_total`: volumen por método, endpoint normalizado y estado.
- `dentalink_http_request_duration_ms`: histograma de latencia.
- `dentalink_http_5xx_total`: errores internos acumulados.
- `dentalink_process_uptime_seconds`: uptime del proceso.

Alertas iniciales: 5xx mayor a 1% durante cinco minutos; p95 mayor a 500 ms en lecturas o 800 ms en
mutaciones durante diez minutos; readiness fallido por dos minutos. PostgreSQL, Redis y jobs de reportes
requieren además métricas del servicio administrado o del host; no se deben inferir solo desde HTTP.

## Continuidad: RPO 15 minutos y RTO 2 horas

Los objetivos productivos aprobados son:

- **RPO máximo: 15 minutos.** PostgreSQL debe mantener PITR/WAL continuo o una capacidad administrada
  equivalente. Un dump diario por sí solo no cumple el objetivo.
- **RTO máximo: 2 horas.** El drill debe recuperar PostgreSQL y los binarios clínicos en un entorno aislado,
  ejecutar controles de integridad y registrar tiempos de inicio/fin.

### PostgreSQL

Backup manual verificable:

```powershell
npm run db:backup
npm run db:restore -- --verify
```

`db:backup` publica `.dump` y `.manifest.json` solo después de completar `pg_dump`, validar tamaño y calcular
SHA-256. `DB_BACKUP_DRIVER=docker` es para desarrollo; producción debe usar `direct` o snapshots administrados.

### Binarios clínicos

```powershell
$env:STORAGE_BACKUP_ENCRYPTION_KEY = "<secret-store>"
npm run storage:backup
npm run storage:backup:verify
node scripts/storage-backup.cjs --restore <directorio-vacio> <backup>
```

El backup de storage cifra contenido y manifest con AES-256-GCM. La clave debe ser independiente de las claves
de aplicación y vivir fuera del host respaldado. Mientras exista storage local, ejecutar este backup cada 15
minutos y copiarlo offsite. Después de migrar a object storage, habilitar versionado/replicación continua y
conservar el script para exportación y restore drill.

Un scheduler externo debe ejecutar dump completo diario, verificar PITR continuamente y ejecutar restore drill
mensual. Cada ejecución debe conservar manifest, checksum, duración, versión de esquema y destino offsite. No
programar backups productivos desde GitHub Actions: el runner no debe tener acceso directo a datos productivos.

## Puerta previa a despliegue

```powershell
npm run db:migrate:status
npm run db:backup:test
npm run storage:backup:test
npm run permissions:audit --workspace=@dentalwarner/database
npm run contracts:routes
npm run lint:regression
npm run typecheck
npm test --workspace=@dentalwarner/api
npm test --workspace=@dentalwarner/web
npm run build
```
