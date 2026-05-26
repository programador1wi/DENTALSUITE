# Fase 2 - Autenticacion, usuarios, roles y sucursales

## Objetivo

Crear la base administrativa del sistema desde cero con Next.js, NestJS, PostgreSQL, Prisma y Redis.

## Modulos incluidos

- Login
- Logout
- Usuario autenticado
- Usuarios
- Roles
- Permisos
- Sucursales
- Perfil de usuario
- Configuracion general
- Healthcheck tecnico

## Decisiones tecnicas

- Monorepo con npm workspaces.
- API NestJS con prefijo `/api/v1`.
- Web Next.js con App Router y proxy interno hacia API.
- PostgreSQL y Redis mediante Docker Compose.
- Prisma centralizado en `packages/database`.
- Prisma 7 configurado con `prisma.config.ts` y adapter `@prisma/adapter-pg`.
- JWT access token y refresh token persistido con hash.
- Cookies HttpOnly en la capa web para no exponer tokens al cliente.
- RBAC por permisos atomicos `modulo.accion`.
- Scoping por organizacion para preparar SaaS multisucursal.
- Soft deactivation para usuarios, roles, permisos y sucursales.
- AuditLog base para cambios administrativos.

## Puertos locales

- API: `3001`
- Web: `3000`
- Redis: `6379`
- PostgreSQL Docker: `55432` en host, `5432` dentro del contenedor.

Se usa `55432` porque en este equipo `5432` tambien esta ocupado por un PostgreSQL local (`postgres` PID `6564`) ademas de Docker. Con `localhost:5432`, Node conecta al PostgreSQL local incorrecto y falla el rol `dentalwarner`.

## Riesgos

- No existe Git en PATH, por lo que no se pudo crear commit ni validar diff con Git.
- El workspace estaba vacio; todas las convenciones fueron definidas desde cero.
- Si se desea usar `5432` en host, primero debe detenerse o reconfigurarse el PostgreSQL local instalado fuera de Docker.
- `npm audit` reporta vulnerabilidades moderadas transitivas en Prisma/Next. El fix automatico requiere `npm audit fix --force` y propone cambios breaking, por lo que no se aplico.

## Pruebas ejecutadas

- `npm install`
- `npm run db:up`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`
- `npm run typecheck`
- `npm run build`
- Smoke test API compilada:
  - `GET /api/v1/health` -> `ok`
- `POST /api/v1/auth/login` con admin seed -> `super_admin`, 20 permisos
- `GET /api/v1/settings/general` autenticado -> organizacion `Dentalwarner Corporate`

## Pruebas manuales recomendadas

1. `npm run dev:api`
2. `npm run dev:web`
3. Abrir `http://localhost:3000/login`.
4. Entrar con:
   - Email: `admin@dentalwarner.local`
   - Password: `Admin123!`
5. Validar CRUD de usuarios, roles, permisos y sucursales.
6. Validar `/profile` y `/settings`.
