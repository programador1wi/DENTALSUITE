# Excepción de seguridad propuesta — Prisma CLI / deepmerge-ts

## Estado

- Estado: **propuesta; no aprobada**.
- Propietario: Plataforma.
- Caducidad máxima: 2026-09-27.
- Producción: bloqueada mientras la excepción no sea aprobada o la cadena no sea corregida.

## Hallazgo

`npm audit --omit=dev --audit-level=low` reporta tres vulnerabilidades altas por una misma cadena: `prisma@7.10.0` → `@prisma/config@7.10.0` → `deepmerge-ts@7.1.5`. La versión estable más reciente de `@prisma/config` sigue fijando `deepmerge-ts@7.1.5`; `npm audit fix --force` propone bajar a Prisma 6.12, cambio mayor incompatible con el esquema y cliente validados.

## Exposición y controles compensatorios

- La cadena pertenece al CLI de migración/generación, no al código que atiende peticiones HTTP.
- Prisma solo debe leer `prisma.config.ts` y esquema versionados; CI y despliegue no deben aceptar configuración Prisma proveniente de usuarios.
- Imágenes productivas deberán excluir dependencias de desarrollo y el CLI del proceso de API.
- `npm prune --omit=dev --omit=optional --dry-run` confirma que elimina `prisma`, `@prisma/config` y `deepmerge-ts`; `npm run audit:production` reporta 0 vulnerabilidades para ese árbol runtime.
- `package-lock.json` fija Prisma 7.10.0 y la auditoría se repetirá al actualizar dependencias.

## Cierre requerido

La imagen multi-stage debe ejecutar el prune anterior y validar su SBOM. Además, actualizar a la primera versión estable de Prisma que use `deepmerge-ts >= 8`, ejecutar generación, estado de migraciones, base vacía, suite API/web y build. No aplicar override mayor ni `npm audit fix --force` sin evidencia de compatibilidad.
