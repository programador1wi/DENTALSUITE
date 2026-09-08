# Scripts

Scripts operativos del monorepo: base de datos, setup local, seeds, migraciones, backups y tareas de mantenimiento.

## Desarrollo local

- `dev.cjs`: levanta API y web sin depender de `npm run` anidado ni de resolucion de binarios por `PATH`.
- `dev.cjs --detached`: levanta API y web en segundo plano, escribe logs en `logs/` y omite servicios cuyo puerto ya este ocupado.

## Backup y restore

- `npm run db:backup`: genera primero un `.partial`, valida tamaño, calcula SHA-256 y publica dump + manifest de forma atómica.
- `DB_BACKUP_DRIVER=docker`: usa el contenedor local `dentalwarner-postgres`.
- `DB_BACKUP_DRIVER=direct`: usa `pg_dump` y `DATABASE_URL`; la contraseña se pasa mediante `PGPASSWORD`, no como argumento.
- `npm run db:backup:test`: prueba publicación atómica, limpieza al fallar y rechazo de dumps manipulados.
- `npm run db:restore -- --verify`: restaura en una base temporal y falla si checksum, tablas o migraciones no son válidos.
- `npm run storage:backup`: cifra cada binario con AES-256-GCM y publica un manifest cifrado solo al completar todos los archivos.
- `npm run storage:backup:verify`: descifra en streaming y compara tamaño, autenticidad y SHA-256 sin escribir PHI.
- `node scripts/storage-backup.cjs --restore <directorio-vacio> [backup]`: restaura en un destino aislado para el drill.
- `STORAGE_BACKUP_ENCRYPTION_KEY`: clave independiente de 32 bytes en hexadecimal o base64; nunca se guarda en el backup.
