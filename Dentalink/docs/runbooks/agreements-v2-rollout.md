# Convenios v2: despliegue, E2E y rollback

1. Mantener `AGREEMENTS_V2_ENABLED=false` y `VITE_AGREEMENTS_V2_ENABLED=false`; aplicar la migración y ejecutar `npm run db:generate`.
2. Ejecutar `npm --workspace=@dentalwarner/api run test -- --testPathPatterns=agreements` y `npm --workspace=@dentalwarner/web run typecheck`.
3. En staging, habilitar ambos flags. Crear convenio BORRADOR con una sucursal y una prestación; usar **Calcular**, publicar y comprobar estado ACTIVO.
4. Asignarlo a un paciente y a un plan DRAFT. Agregar la prestación: comprobar en la fila `agreementSnapshot`, `agreementVersionNumber`, `agreementNormalPrice`, `agreementAppliedPrice` y `agreementDiscountAmount`.
5. Aceptar el presupuesto, crear una nueva versión y publicarla. Confirmar que el plan aceptado mantiene los snapshots anteriores y que la reasignación responde 409.
6. Rollback operativo: apagar ambos flags primero. Si es necesario revertir esquema antes de usar datos nuevos, exportar las cuatro tablas nuevas y ejecutar `packages/database/prisma/migrations/20260716210000_agreement_lifecycle_versioning/rollback.sql` en una ventana controlada.
