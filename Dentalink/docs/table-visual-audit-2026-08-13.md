# Auditoría visual de tablas y listados

Fecha: 2026-08-13

## Alcance y método

Se revisaron las rutas reales de `router.tsx`, el menú de `navigation.ts`, las primitivas compartidas y todas las vistas TSX que renderizan `DataTable`, `Table`, `SimpleCrudPage` o una etiqueta HTML `table`.

La auditoría es estrictamente visual. No propone cambios de columnas, consultas, permisos, rutas, formularios, estados ni acciones.

## Diagnóstico transversal

El sistema tiene una base reutilizable, pero no una única presentación:

- 85 archivos TSX renderizan al menos una tabla o listado tabular.
- 61 tablas usan HTML local y repiten encabezados, celdas, overflow y breakpoints.
- 49 instancias usan `DataTable`, 9 usan `Table` y 9 usan `SimpleCrudPage`.
- Hay tres estrategias responsive: scroll horizontal, tarjetas/listas móviles y ocultación de columnas por breakpoint.
- Los controles no comparten siempre altura: `Input` y `Select` usan 40 px, mientras el botón estándar usa 38 px.
- Se mezclan contenedores con y sin hover, bordes verticales, encabezados de distinta altura, mayúsculas y pesos tipográficos.
- Los estados ya tienen un componente `Badge`, pero algunas vistas siguen construyendo estados con clases locales.
- Las acciones relevantes con texto son parte del contrato de cada pantalla y deben conservarse. En especial: Prescripciones, Evoluciones, Configurar, Editar, Deshabilitar y Habilitar.

## Administración: vistas con tablas que requieren unificación

| Área / ruta                                       | Implementación actual                   | Brecha principal                                                         | Prioridad |
| ------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ | --------- |
| Convenios `/settings/agreements`                  | `DataTable`                             | Alinear toolbar, acciones y vista móvil con la capa común                | P1        |
| Reporte de deudas de convenios                    | 3 `DataTable`                           | Unificar filtros, densidad y pie de resultados                           | P1        |
| Gastos `/settings/expenses`                       | 2 `DataTable`                           | Toolbar y acciones con distribución distinta                             | P1        |
| Gestión de especialidades `/settings/specialties` | 2 tablas HTML y tarjetas móviles        | Migrar a tabla compartida sin convertir acciones con texto en iconos     | P1        |
| Inventario `/inventory`                           | 3 `DataTable` y 5 `SimpleCrudPage`      | Unificar toolbars de productos, movimientos, reportes y catálogos        | P1        |
| Laboratorios `/labs`                              | Tabla HTML y tarjetas móviles           | Migrar proveedores a tabla compartida                                    | P1        |
| Prestaciones de laboratorio `/labs/procedures`    | Tabla HTML y tarjetas móviles           | Migrar sin alterar Editar/Deshabilitar                                   | P1        |
| Órdenes de laboratorio `/labs/orders`             | Tabla HTML                              | Aplicar contenedor, encabezado, filas y responsive comunes               | P1        |
| Nóminas `/settings/payroll`                       | 3 tablas con primitivas `Table`         | Hereda estilos comunes; normalizar toolbar y grupos de acciones          | P1        |
| Planificación de cubículos `/settings/chairs`     | Matriz especializada y `SimpleCrudPage` | Unificar sólo el catálogo; conservar matriz como visualización operativa | P1        |
| Usuarios `/settings/users`                        | `DataTable`                             | Alinear filtros y acciones; conservar navegación y permisos              | P1        |
| Bloqueos de usuarios                              | Tabla HTML                              | Migrar tabla secundaria manteniendo controles actuales                   | P2        |
| Contratos masivos de usuarios                     | Tabla HTML                              | Unificar tabla de selección y acciones masivas                           | P2        |
| Roles y perfiles                                  | `DataTable`                             | Hereda tabla común; normalizar toolbar                                   | P2        |
| Identidad de pacientes `/patients/data-quality`   | Sin tabla tabular principal             | Sin cambio en esta fase                                                  | —         |
| Fusión de fichas `/patients/merge`                | Sin tabla tabular principal             | Sin cambio en esta fase                                                  | —         |
| Pagos TPV `/payments/tpv`                         | Listado no tabular                      | Mantener patrón propio; no forzar tabla                                  | —         |
| Planes y servicios `/settings/plans`              | Tarjetas                                | Mantener patrón propio; no forzar tabla                                  | —         |

## Configuración dentro de Administración

| Área / ruta                    | Implementación actual                                   | Brecha principal                                    | Prioridad |
| ------------------------------ | ------------------------------------------------------- | --------------------------------------------------- | --------- |
| Agenda Online                  | Tablas HTML en configuración, campañas y panel          | Centralizar encabezados, overflow y estados         | P2        |
| Listado de precios             | 6 tablas HTML entre vista actual e historial versionado | Alta variación de densidad, acciones y responsive   | P2        |
| Bancos y entidades financieras | `SimpleCrudPage`                                        | Hereda capa común                                   | P1        |
| Documentos clínicos            | `DataTable`                                             | Hereda capa común; revisar toolbar                  | P2        |
| Consentimientos informados     | Listado no tabular                                      | Mantener patrón actual                              | —         |
| Sucursales                     | Primitiva `Table`                                       | Hereda capa común                                   | P1        |
| Logotipo                       | Sin tabla                                               | Sin cambio                                          | —         |
| Opciones de pago               | 3 tablas HTML contando descuentos y límites             | Migrar progresivamente sin alterar flags o acciones | P2        |
| Pagos anulados y pendientes    | 2 `DataTable`                                           | Hereda tabla común; unificar filtros                | P1        |
| Procedimientos                 | 2 `SimpleCrudPage`                                      | Hereda capa común                                   | P1        |
| Horarios especiales y bloqueos | 3 tablas HTML                                           | Centralizar estilo sin cambiar reglas de agenda     | P2        |

## Resto del sistema: inventario de vistas tabulares

- Agenda: lista diaria, impresión, historial de estado, detalle de cita y reprogramación.
- Pacientes: listado general, ortodoncia, citas, tratamientos, pagos, perfil, configuración y vistas de facturación (pagos, documentos, coberturas, devoluciones, anulados y saldo).
- Pagos y caja: pagos, cuotas, cuentas por cobrar, liquidaciones, caja y pagos anulados/pendientes.
- Clínica: historia médica, periodontograma, odontograma, evoluciones y comparaciones clínicas.
- Reportes: citas, pacientes, profesionales, tratamientos, finanzas, desempeño, gráficos y reportes Excel.
- Cobranza: gestión de morosidad.
- CRM: email marketing, reportes de campañas y tareas de gestión.
- Encuestas: gestión de encuestas.
- Integraciones: catálogo de integraciones.
- Tratamientos: presupuestos y planes de tratamiento.

## Criterio de unificación

La capa común debe resolver contenedor blanco, borde suave, radio, encabezado compacto, altura de fila, hover, overflow, vista móvil, toolbar, estado, acciones y paginación. Cada vista conserva íntegramente su contenido y contrato funcional.

Las acciones importantes existentes permanecen como botones con texto. Los iconos compactos sólo se conservan o introducen cuando la acción ya era secundaria y su significado sigue siendo inequívoco y accesible.

## Implementación progresiva

### Fase 1 aplicada

- Se normalizaron `Table`, `DataTable`, botones secundarios y alturas de controles.
- Se añadieron `TableToolbar`, `TableActionGroup` y `TablePagination` reutilizables.
- Gestión de especialidades migró su listado principal a `DataTable`, manteniendo Prescripciones, Evoluciones, Configurar, Editar, Deshabilitar y Habilitar como botones visibles.
- Laboratorios, prestaciones de laboratorio y órdenes de laboratorio migraron sus listados principales a `DataTable` y `TableToolbar`.
- Convenios, gastos, inventario, nóminas, usuarios, sucursales, bancos, roles, procedimientos y pagos anulados/pendientes reciben la nueva base visual por utilizar primitivas compartidas.
- Reportes Excel adoptó `TablePagination` como primera integración de la paginación común.

### Fase siguiente

- Migrar las tablas HTML locales de Agenda Online, listas de precios, opciones de pago, horarios y subflujos de usuarios.
- Unificar paginaciones locales sobre `TablePagination` sin cambiar sus consultas ni límites.
- Ejecutar comparación visual autenticada en desktop y móvil para cada ruta P2.
