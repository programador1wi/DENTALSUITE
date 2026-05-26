# Fase 0 - Inicializacion del monorepo

## Objetivo

Crear una estructura inicial profesional para un sistema dental ERP/CRM grande, modular y escalable.

## Estado

Completado como correccion posterior a la Fase 2 para alinear el proyecto con la metodologia definida.

## Estructura base

- `apps/web`: aplicacion Next.js.
- `apps/api`: API NestJS.
- `packages/shared`: tipos, constantes y utilidades compartidas.
- `packages/ui`: componentes UI reutilizables.
- `packages/config`: configuraciones compartidas de ESLint, Prettier y TypeScript.
- `packages/database`: Prisma schema, migraciones y seed. Se conserva por necesidad tecnica del ORM.
- `docs/architecture`: documentacion de arquitectura.
- `docs/database`: documentacion de base de datos.
- `docs/api`: documentacion de API.
- `docs/phases`: documentacion por fases.
- `docker`: archivos auxiliares de contenedores.
- `scripts`: scripts operativos.

## Scripts principales

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run format`
- `npm run test`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:studio`

## Nota tecnica

La funcionalidad de Fase 2 ya existia antes de esta correccion. No se elimino ni se reescribio logica funcional; solo se ordeno la base del monorepo.
