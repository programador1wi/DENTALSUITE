# Regla Estándar de Diseño de Tablas (Data Tables)

Todas las tablas del sistema deben seguir estrictamente el patrón visual premium establecido en `agreements-settings-page.tsx` y documentado en `Desing_system.md`:

1. **Sin bordes verticales (`border-r-0`)**:
   - NUNCA agregar líneas de cuadrícula verticales entre columnas.
   - Solo usar divisores horizontales sutiles (`border-b border-slate-100` o `divide-y divide-slate-100`).

2. **Encabezados Minimalistas (`TableHead` / `TableHeader`)**:
   - `bg-slate-50/80`
   - `text-[11px] font-semibold text-slate-500 uppercase tracking-wider`
   - `border-b border-slate-200`

3. **Columna de Identidad Visual (Avatar + Título + Subtítulo)**:
   - Avatar redondeado de 36x36px (`bg-blue-50 text-blue-600 border border-blue-100/80`) con el icono representativo de la entidad (`Building2`, `User`, `Receipt`, `ShieldCheck`).
   - Título principal en `font-semibold text-slate-900 text-sm`.
   - Tag/Badge secundario de categoría (`bg-blue-50 text-blue-700 border border-blue-100`).

4. **Chips de Vigencia y Fechas**:
   - Chip horizontal con icono `Calendar` (`bg-slate-100/80 px-2.5 py-1 text-xs text-slate-700 font-medium border border-slate-200/60 tabular-nums`).

5. **Badges de Condiciones / Métricas**:
   - Pill redondeado destacado (`bg-emerald-50 text-emerald-700 border border-emerald-200/50`) con icono contextual (`Tag`, `DollarSign`).

6. **Indicadores de Estado (Dot Status)**:
   - Badge con indicador circular de luz (`h-1.5 w-1.5 rounded-full`) y bordes translúcidos (`emerald`, `amber`, `rose`).

7. **Acciones Directas en Fila (`flex items-center justify-end gap-1`)**:
   - TODOS los botones de acción deben estar visibles en una sola fila horizontal con tooltips (`title`) y microinteracciones de color.
   - NUNCA ocultar acciones en menús desplegables de tres puntos (`...`).
