# Fase 0 — Clasificación del worktree

Fecha: 2026-08-26  
Checkout: `C:\Users\X\Documents\GitHub\DENTALSUITE\Dentalink`  
Baseline externo: `C:\Users\X\.codex\backups\Dentalink-20260826-F0-01a03f14`

## Regla de conservación

No limpiar, restaurar, mover ni sobrescribir cambios existentes. El baseline externo contiene patch binario,
ZIP de archivos sin seguimiento, inventarios de estado, rama, HEAD y checksums.

## Clasificación

### Programa de profesionalización en curso

- Autenticación, cookies, caché de usuario, rate limiting, logging, health y métricas.
- Permisos, roles, reconciliación de base de datos y CI.
- Constraints financieras, pagos e idempotencia.
- Documentos, aislamiento de archivos, agenda, pacientes, integraciones, reportes, backup y restore.
- Configuración TypeScript, scripts de calidad y runbook productivo.

Estos archivos se pueden modificar únicamente cuando el cambio pertenezca a la fase activa y conserve el
comportamiento ya implementado.

### Trabajo funcional previo que debe preservarse

- Refactor y componentes nuevos de planes de tratamiento, presupuestos, ortodoncia, convenios, descuentos,
  financiamiento, firmas, devoluciones y citas futuras.
- Cambios de dashboard y configuración administrativa.
- Ajustes de pruebas web, sesión bootstrap y cliente HTTP que no sean necesarios para el gate activo.

No mezclar este trabajo con remediaciones P0 salvo que una prueba demuestre una dependencia directa.

### Artefactos eliminados o temporales

- Scripts temporales de diagnóstico y extracción de documentos ya marcados como eliminados.
- Resultados locales ignorados: `dist`, coverage, reportes Playwright, logs, storage y backups.

No restaurarlos ni incluirlos en producción sin una necesidad demostrada.

## Orden de intervención

1. Aislamiento de archivos.
2. Sesiones y refresh cookie-only.
3. Backup/restore y configuración productiva.
4. Gate F1 completo.
5. Seguridad e integridad P1.

El estado de Git seguirá sucio durante el programa porque contiene trabajo previo. La validación se hará por
diffs focalizados, contratos y pruebas; no mediante la falsa condición de un worktree limpio.
