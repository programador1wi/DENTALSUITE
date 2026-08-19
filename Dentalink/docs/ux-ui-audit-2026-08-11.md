# AUDITORÍA GENERAL UX/UI Y RESPONSIVE

Fecha: 2026-08-11  
Alcance: frontend completo de Warner Suite/Dentalink  
Estado: foundation y pilotos verificables implementados; cobertura autenticada representativa completada; barrido monolítico de las 141 rutas aún no certificado.

## 1. Problemas críticos

- **P0 — Navegación móvil:** el header activo mostraba navegación horizontal con `overflow-x-auto`; tablet y móvil dependían de desplazamiento invisible para descubrir módulos.
- **P0 — Tablas comunes:** el primitivo `Table` permitía scroll horizontal y `DataTable` solo ofrecía adaptación móvil si cada consumidor activaba una prop; gran parte de las tablas quedaba como desktop comprimido.
- **P0 — Deriva de shell:** `Desing_system.md` prescribía sidebar fija mientras `PrivateLayout` usa exclusivamente `Header`; la sidebar marcada como obsoleta seguía dentro del repositorio.
- **P0 — QA insuficiente:** existían Vitest/jsdom, typecheck y build, pero no matriz automática de viewports, overflow del documento ni accesibilidad runtime.
- **P0 — Worktree compartido:** el repositorio contiene cambios locales extensos; cualquier limpieza o refactor masivo podría sobrescribir trabajo no relacionado.

## 2. Problemas importantes

- **P1 — Tokens:** runtime cargaba Inter aunque el Design System define DM Sans.
- **P1 — Componentes base:** `PageHeader`, `Modal`, `Drawer` y estados de feedback no expresaban acciones responsive, presentación móvil, retry o skeleton.
- **P1 — Filtros:** muchas páginas implementan barras propias; en móvil se apilan sin una estrategia consistente ni contador de filtros.
- **P1 — Acciones:** varias tablas presentan acciones completas horizontalmente o botones táctiles menores a 44 px.
- **P1 — Formularios densos:** se localizaron formularios de hasta seis columnas que necesitan revisión semántica por dominio, no una sustitución mecánica de clases.

## 3. Diseño genérico detectado

Baseline inicial sobre 333 archivos fuente:

| Patrón | Inicial | Tras foundation/pilotos |
| --- | ---: | ---: |
| Colores hex hardcodeados | 406 | 396 |
| Anchos arbitrarios en px | 230 | 223 |
| `overflow-x-auto/scroll` | 67 | 66 |
| Radios `xl/2xl/3xl` | 160 | 144 |
| Sombras `lg/xl/2xl` | 44 | 43 |
| Gradientes decorativos | 14 | 11 |

Los archivos con mayor concentración pendiente son `patient-treatments-page.tsx`, `cash-register-page.tsx`, `odontogram-view.tsx`, `organization-logo-settings-page.tsx` y `patient-balance-view.tsx`. Los colores clínicos necesarios en símbolos dentales deben migrarse a tokens de dominio, no eliminarse.

## 4. Problemas responsive

### Móvil

- Navegación principal desplazable y sin jerarquía de módulos.
- Tablas desktop completas o conversión universal a cards pesadas.
- Filtros duplicados por página sin drawer/bottom sheet común.
- Acciones clínicas y financieras con targets inferiores a 44 px.

### Tablet

- El rango 768–1024 mezclaba header de escritorio, dropdowns de 500 px y tablas completas.
- Columnas complementarias no tenían prioridad P1/P2/P3.

### Desktop

- Menús anchos podían salir del viewport en resoluciones intermedias.
- Algunas páginas mezclan contenedores de 1280/1536 px con anchos internos fijos.

### Ultra-wide

- El shell limita a 1536 px correctamente, pero formularios y páginas de lectura aún requieren límites propios.

## 5. Tablas problemáticas

| Dominio/componente | Problema actual | Desktop | Tablet | Móvil |
| --- | --- | --- | --- | --- |
| `DataTable` compartida | Adaptación opt-in y card universal | Tabla densa | Ocultar P3 | Lista/definition rows |
| Pacientes | Tabla custom sin variante móvil | Tabla + preview | Tabla simplificada | Registro compacto + menú |
| Pagos | 9 columnas y acciones destructivas | P1/P2/P3 | Ocultar P3 | Lista con monto/estado/acción |
| Caja y saldos | Anchos fijos y múltiples scrolls | Tabla operativa | Combinar columnas | Registros compactos |
| Agenda | Superficie bidimensional | Grid contenido | Grid contenido | Vista diaria/lista prioritaria |
| Odontograma/periodontograma | Información espacial no reducible a lista | Canvas clínico | Pan contenido | Pan contenido documentado |

## 6. Problemas de navegación

- Header era la navegación real y sidebar era código obsoleto.
- Se implementó objetivo acordado: header horizontal desde `lg` y drawer izquierdo debajo de `lg`.
- Drawer conserva permisos, estado activo, búsqueda de pacientes, sucursal, perfil y logout.

## 7. Problemas de formularios

- Inputs y labels no siempre están asociados; Login fue corregido como piloto.
- Formularios clínicos/financieros con más de tres columnas deben migrarse por flujo para conservar agrupación y validación.
- No se alterarán DTO, hooks ni reglas de validación durante la migración visual.

## 8. Problemas de modales

- Modal solo tenía un patrón centrado.
- Contrato ampliado con `mobilePresentation="dialog|fullscreen|sheet"`, descripción y footer persistente.
- Se preservaron focus trap, Escape, `inert` y restauración de foco.

## 9. Problemas de jerarquía visual

- Uso simultáneo de verdes/cyan hardcodeados competía con navy/blue/emerald semántico.
- Exceso de radios grandes, sombras y cards separaba artificialmente datos relacionados.
- Login fue reemplazado por composición clínica sobria sin antigravity, glassmorphism ni gradientes.

## 10. Componentes duplicados

- Barras de filtros, menús de acciones y representaciones móviles de tablas se repetían por dominio.
- Se añadieron `ResponsiveFilterBar` y `ActionMenu` y se extendieron `DataTable`, `PageHeader`, `Drawer` y `Modal`.
- La eliminación definitiva de sidebar queda condicionada a verificación de cero imports y revisión de diff del usuario.

## 11. Design System actual

- Paleta navy/blue/emerald y tokens semánticos están presentes en `styles.css`.
- Tipografía fue reconciliada a DM Sans + DM Mono.
- Lucide continúa como única librería de iconos.
- `ui:audit` impide aumentar deuda visual por encima del baseline aceptado.

## 12. Design System propuesto

- No se crea una identidad nueva: se formaliza el sistema clínico 2.0 existente.
- Navegación documentada como header desktop + drawer tablet/móvil.
- Contratos responsive explícitos para columnas, filtros, acciones, overlays y estados.
- Excepciones bidimensionales usan `data-responsive-overflow="contained"`.

## 13. Arquitectura frontend

- React 19 + Vite 8 + Tailwind 3 + React Router 7 permiten migración incremental sin cambiar API.
- Los componentes compartidos mantienen compatibilidad con props actuales.
- Playwright extrae rutas estáticas directamente de `router.tsx`; evita una lista manual que se vuelva obsoleta.
- Descubrimientos de backend se separarán como incidencias con causa raíz y pruebas; no se ocultarán en UI.

## 14. Prioridades

- **P0 completado:** foundation, header/drawer, contrato DataTable móvil, Modal responsive, Playwright/axe, auditor estático y Login.
- **P1 implementado como piloto:** Pacientes, Pagos y agenda; migración exhaustiva de caja, tratamientos y saldos sigue pendiente.
- **P2 implementado parcialmente:** Inventario, movimientos de inventario, laboratorios y reportes representativos ya pasan el contrato responsive; configuración y CRM requieren migración exhaustiva.
- **P3 pendiente:** refinamiento visual, snapshots autenticados completos y optimización de bundle por páginas de mayor tamaño.

## Evidencia técnica

- Baseline: typecheck y build pasaban; lint tenía 4 errores/209 warnings; suite completa excedía 120 s y mostraba una prueba ambigua en agenda.
- Resultado actual: typecheck y build pasan; lint queda en 0 errores/206 warnings; Vitest pasa 48 archivos y 188 pruebas.
- Playwright: Login, Agenda, Pacientes, Pagos, Reportes, Laboratorios e Inventario fueron comprobados en 15 anchos; axe no detecta violaciones serias o críticas en Login y Agenda.
- Límite de evidencia: el router contiene 141 rutas estáticas. El barrido monolítico excedió diez minutos, por lo que no se declara certificación total ni producción-ready de todas las rutas.
- Reparación: prueba de agenda valida las dos variantes responsive sin borrar cobertura.
- Comandos de aceptación se documentan en `apps/web/package.json`: `typecheck`, `test`, `lint`, `build`, `ui:audit`, `test:responsive` y `test:a11y`.
