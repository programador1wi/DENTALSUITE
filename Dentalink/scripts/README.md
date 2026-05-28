# Scripts

Scripts operativos del monorepo: base de datos, setup local, seeds, migraciones, backups y tareas de mantenimiento.

## Desarrollo local

- `dev.cjs`: levanta API y web sin depender de `npm run` anidado ni de resolucion de binarios por `PATH`.
- `dev.cjs --detached`: levanta API y web en segundo plano, escribe logs en `logs/` y omite servicios cuyo puerto ya este ocupado.
