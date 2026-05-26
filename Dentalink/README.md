# Dentalwarner Platform

Sistema web modular para gestion integral de clinicas dentales multisucursal.

## Stack

- Frontend: Next.js + TypeScript
- Backend/API: NestJS + TypeScript
- Base de datos: PostgreSQL
- ORM: Prisma
- Cache y sesiones operativas: Redis
- Monorepo: npm workspaces

## Estructura

```text
apps/
  web/          Aplicacion web Next.js
  api/          Backend NestJS
packages/
  shared/       Tipos, constantes y utilidades compartidas
  ui/           Componentes UI reutilizables
  config/       Configuracion compartida ESLint, Prettier y TypeScript
  database/     Prisma schema, migraciones y seed
docs/
  architecture/ Documentacion de arquitectura
  database/     Documentacion de base de datos
  api/          Documentacion de API
  phases/       Documentacion por fases
docker/         Archivos auxiliares de contenedores
scripts/        Scripts operativos
```

## Primer arranque local

1. Copiar `.env.example` a `.env`.
2. Instalar dependencias:

```bash
npm install
```

3. Levantar infraestructura:

```bash
npm run db:up
```

4. Generar Prisma Client, aplicar migraciones y cargar seed:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Ejecutar API y web:

```bash
npm run dev:api
npm run dev:web
```

API: `http://localhost:3001/api/v1`
Web: `http://localhost:3000`
PostgreSQL local: `localhost:55432`
Redis local: `localhost:6379`

## Scripts principales

- `npm run dev`: ejecuta web y API.
- `npm run build`: compila todos los workspaces.
- `npm run lint`: ejecuta ESLint.
- `npm run format`: aplica Prettier.
- `npm run test`: ejecuta pruebas configuradas por workspace.
- `npm run db:migrate`: aplica migraciones Prisma.
- `npm run db:seed`: carga datos iniciales.
- `npm run db:studio`: abre Prisma Studio.

## Usuario seed de desarrollo

- Email: valor de `SEED_ADMIN_EMAIL`
- Password: valor de `SEED_ADMIN_PASSWORD`

Los valores por defecto de `.env.example` son solo para desarrollo local.
