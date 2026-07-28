# Analítica de pacientes

## Alcance

`Pacientes > Análisis` consolida indicadores operativos, demográficos y
financieros de una o varias sucursales autorizadas. El tablero es de solo
lectura: no altera citas, planes, prestaciones, pagos ni pacientes.

La implementación usa las tablas transaccionales existentes. No agrega
migraciones ni duplica estados clínicos o financieros. La versión pública de
las fórmulas es `1.0.0`.

## Seguridad y aislamiento

- Toda consulta parte de `organizationId` del usuario autenticado.
- Una sucursal individual debe pertenecer a `actor.branchIds`.
- La consolidación de varias sucursales requiere
  `patient_analytics.view_all_branches`.
- Los bloques de deuda, presupuestos pendientes y medios de pago requieren
  `patient_analytics.read_financial`.
- Exportar requiere `patient_analytics.export`; recalcular requiere
  `patient_analytics.refresh`.
- Consulta, actualización y exportación generan un registro de auditoría con
  rango, sucursales, zona horaria y versión de métrica.

Los alias del guard mantienen compatibilidad con roles existentes que ya
poseen permisos equivalentes de pacientes o reportes.

## Contrato temporal

- `from` es inclusivo y `to` es exclusivo.
- La zona horaria predeterminada es `America/Mexico_City`.
- Los límites locales se convierten a UTC antes de consultar.
- La granularidad puede ser `day`, `month`, `year` o `auto`.
- `auto` elige día para rangos de hasta 45 días, mes para rangos de hasta 730
  días y año para rangos mayores.
- La respuesta expone `cutoffAt`, `timezone`, `metricVersion`, `source` y las
  sucursales aplicadas.

## Fórmulas

### Conversión

1. `citasAgendadas`: citas creadas dentro del rango y alcance.
2. `citasConfirmadas`: cita con evidencia histórica de un estado de
   confirmación, aunque después cambie de estado. Una cita completada también
   cuenta como confirmada por evidencia operacional.
3. `presupuestosAceptados`: citas con `treatmentPlanId` directo y al menos una
   prestación del plan completada al 100 %.
4. `% confirmadas = confirmadas / agendadas * 100`.
5. `% aceptadas = aceptadas / agendadas * 100`.

Cada cita se cuenta una sola vez por etapa. El total del denominador se muestra
explícitamente y los porcentajes se redondean a dos decimales.

### Demografía

El universo es el conjunto de pacientes que participan en la selección. Cada
distribución devuelve:

- `universe`: registros evaluados;
- `omitted`: registros sin dato válido;
- `items`: valor, porcentaje y conteo por categoría.

Los porcentajes de cada gráfico usan como denominador los registros con dato
válido, no el total bruto.

### Asistencia

`asistencia = COMPLETED / (COMPLETED + NO_SHOW) * 100`.

Estados cancelados, reagendados o todavía abiertos no forman parte de ese
denominador.

### Deuda y presupuestos pendientes

La deuda reutiliza el resumen financiero canónico de planes de tratamiento,
incluyendo asignaciones de pagos y devoluciones. Los presupuestos pendientes se
separan en:

- pendientes de aceptación;
- aceptados con ejecución pendiente.

Los importes se devuelven separados por moneda; no existe suma implícita entre
monedas distintas.

## API

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/patient-analytics/overview` | Resumen completo del tablero |
| `GET` | `/patient-analytics/details/:metric` | Drill-down paginado y filtrable |
| `GET` | `/patient-analytics/export/:metric` | CSV de una métrica |
| `POST` | `/patient-analytics/refresh` | Recalcular con corte actual |
| `GET` | `/patients/analysis` | Alias compatible del resumen |

El detalle admite `page`, `pageSize`, `search`, `sortBy` y `order`. La
exportación está limitada a 5,000 filas por solicitud.

## Operación, despliegue y reversión

1. Ejecutar typecheck, pruebas unitarias y build de API y web.
2. Desplegar API antes o junto con web. La ruta anterior permanece disponible,
   por lo que no hay ventana de incompatibilidad.
3. Observar latencia, errores `403`, errores de exportación y crecimiento de
   auditoría.
4. Para revertir, restaurar el frontend anterior y retirar el controlador
   `PatientAnalyticsController`; no hay migración de base de datos que revertir.

## Decisiones deliberadas

- No se introdujo caché persistente ni snapshots: el tablero informa `source:
  live` y el corte exacto. Esto evita servir datos silenciosamente obsoletos.
- No se inventó una regla de atribución temporal: existe relación directa entre
  cita y plan de tratamiento.
- No se exponen datos financieros cuando el permiso falta; el backend omite los
  bloques aunque el cliente intente solicitarlos.
