# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DENTAL DESIGN SYSTEM — REDESIGN BRIEF
# Fuente de verdad para agentes, CI y componentes
# Versión 2.1.0 — Paleta Azul Clínico Zafiro & Slate Neutro
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ROL Y CONTEXTO

Eres un diseñador/desarrollador senior especializado en sistemas de
diseño minimalistas para SaaS dental B2B. Tu tarea es rediseñar
completamente el sitio/sistema usando el design system definido
en este documento como ÚNICA fuente de verdad.

REGLA ABSOLUTA: ningún valor de color, espacio, tipografía, radio
o sombra puede existir fuera de los tokens aquí definidos. Cero
excepciones. Cero valores hardcodeados.

────────────────────────────────────────────────────────────
## FILOSOFÍA DE DISEÑO

Estética:       Minimalismo detallista — "less, but better"
Principio:      Cada elemento debe justificar su existencia
Densidad:       Alta información, bajo ruido visual
Movimiento:     Funcional, nunca decorativo
Tipografía:     Estructura clara, jerarquía evidente, nunca decorativa
Iconografía:    Outline only, 16px inline / 20px standalone

────────────────────────────────────────────────────────────
## TOKENS PRIMITIVOS — COLOR

# Definición base. Los tokens semánticos SIEMPRE referencian estos.

color-base-white:          #FFFFFF
color-base-gray-50:        #F8FAFC   ← base de fondo
color-base-gray-100:       #F1F5F9
color-base-gray-200:       #E2E8F0
color-base-gray-300:       #CBD5E1
color-base-slate-500:      #64748B
color-base-slate-700:      #334155   ← texto principal

# ── NUEVO: Ramp azul marino — identidad y navegación ──
color-base-navy-600:       #185FA5   ← acentos sobre fondo claro
color-base-navy-700:       #0C447C   ← hover / títulos de página
color-base-navy-900:       #042C53   ← sidebar / topbar (antes negro)

# ── NUEVO: Ramp azul medio — brand / interactivo ──
color-base-blue-400:       #378ADD   ← ítem activo sidebar, badge brand
color-base-blue-500:       #185FA5   ← links, acentos, foco
color-base-blue-600:       #0C447C   ← hover de blue-500
color-base-blue-50:        #E6F1FB   ← fondo claro de brand (chips, badges)
color-base-blue-100:       #B5D4F4   ← borde claro brand

# ── NUEVO: Ramp page background ──
color-base-page-bg:        #F8FAFD   ← canvas principal (levemente más frío)

color-base-emerald-500:    #10B981   ← CTA / acción principal
color-base-emerald-600:    #059669   ← hover de emerald
color-base-red-500:        #EF4444   ← error / destructivo
color-base-amber-400:      #FBBF24   ← warning / alerta

────────────────────────────────────────────────────────────
## TOKENS SEMÁNTICOS — MAPEO UI

# Estos son los únicos tokens que el código debe usar.
# Jamás usar los primitivos directamente en componentes.

[ FONDOS ]
--bg-page:              color-base-page-bg       /* #F8FAFD — canvas principal */
--bg-surface:           color-base-white         /* #FFFFFF — cards, modales */
--bg-subtle:            color-base-gray-100      /* #F1F5F9 — hover rows, inputs */
--bg-nav:               color-base-navy-900      /* #042C53 — sidebar, topbar */
--bg-nav-item-active:   rgba(55,138,221,0.20)    /* teal activo sobre navy-900 */
--bg-brand-light:       color-base-blue-50       /* #E6F1FB — chips, badges brand */

[ TEXTO ]
--text-primary:         color-base-slate-700     /* #334155 — body, labels */
--text-secondary:       color-base-slate-500     /* #64748B — captions, hints */
--text-inverse:         color-base-gray-50       /* #F8FAFC — sobre nav oscuro */
--text-brand:           color-base-blue-500      /* #185FA5 — links, accents */
--text-brand-strong:    color-base-navy-700      /* #0C447C — títulos de página */
--text-success:         color-base-emerald-500   /* #10B981 */
--text-danger:          color-base-red-500       /* #EF4444 */
--text-warning:         color-base-amber-400     /* #FBBF24 */

[ BORDES ]
--border-default:       color-base-gray-200      /* #E2E8F0 — 0.5px en cards */
--border-strong:        color-base-gray-300      /* #CBD5E1 — separadores */
--border-brand:         color-base-blue-500      /* #185FA5 — input focus */
--border-brand-light:   color-base-blue-100      /* #B5D4F4 — chips, filtros */

[ ACCIONES ]
--action-primary:       color-base-navy-600      /* #185FA5 — btn Agendar/Pagar/Guardar */
--action-primary-hover: color-base-navy-700      /* #0C447C */
--action-brand:         color-base-blue-500      /* #185FA5 — acento interactivo */
--action-brand-hover:   color-base-blue-600      /* #0C447C */

[ SIDEBAR — nav items ]
--nav-item-default-text:   rgba(248,250,252,0.65)   /* blanco suave */
--nav-item-default-icon:   rgba(248,250,252,0.50)
--nav-item-hover-bg:       rgba(255,255,255,0.07)
--nav-item-active-bg:      rgba(55,138,221,0.20)    /* azul translúcido */
--nav-item-active-text:    #378ADD                  /* color-base-blue-400 */
--nav-item-active-border:  #378ADD                  /* borde izquierdo 3px */
--nav-section-label:       rgba(248,250,252,0.35)

────────────────────────────────────────────────────────────
## TOKENS DE ESPACIADO

# Escala base 4px. Solo estos valores son válidos.

--space-1:  4px    --space-2:  8px    --space-3:  12px
--space-4:  16px   --space-5:  20px   --space-6:  24px
--space-8:  32px   --space-10: 40px   --space-12: 48px
--space-16: 64px   --space-20: 80px   --space-24: 96px

────────────────────────────────────────────────────────────
## TOKENS DE RADIO (BORDER-RADIUS)

--radius-sm:   4px    ← badges, tags pequeños
--radius-md:   6px    ← inputs, botones
--radius-lg:   10px   ← cards, modales
--radius-xl:   16px   ← panels grandes
--radius-full: 9999px ← avatares, pills

────────────────────────────────────────────────────────────
## TOKENS DE TIPOGRAFÍA

--font-sans:    "DM Sans", system-ui, sans-serif
--font-mono:    "DM Mono", monospace

# Escala de tamaños
--text-xs:     11px / 1.4   ← micro labels, timestamps
--text-sm:     13px / 1.5   ← captions, hints
--text-base:   15px / 1.6   ← body copy
--text-lg:     17px / 1.5   ← subtítulos de sección
--text-xl:     20px / 1.3   ← títulos de página
--text-2xl:    24px / 1.2   ← h1 de dashboard
--text-3xl:    30px / 1.1   ← métricas KPI grandes

# Pesos
--weight-regular: 400
--weight-medium:  500
--weight-bold:    600   ← máximo permitido

────────────────────────────────────────────────────────────
## TOKENS DE MOVIMIENTO (ANIMACIÓN)

--duration-instant: 80ms
--duration-fast:    150ms   ← hover, focus
--duration-normal:  250ms   ← modales, drawers
--duration-slow:    400ms   ← page transitions

--ease-default:     cubic-bezier(0.4, 0, 0.2, 1)      ← estándar
--ease-out:         cubic-bezier(0, 0, 0.2, 1)        ← entrada de elementos
--ease-in:          cubic-bezier(0.4, 0, 1, 1)        ← salida de elementos
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1) ← bouncy CTA

REGLA: jamás animar más de 2 propiedades a la vez.
Propiedades animables: opacity, transform, background-color, border-color.
NUNCA animar: width, height, top, left, padding, margin.

────────────────────────────────────────────────────────────
## CATÁLOGO DE COMPONENTES

### BUTTON

# Variantes
primary:     bg --action-primary (#185FA5) | text white | hover --action-primary-hover (#0C447C)
secondary:   bg --bg-surface (#FFFFFF) | border --border-strong (#CBD5E1) | text --text-primary (#334155) | hover bg --bg-subtle
ghost:       bg transparent       | no border  | text --text-secondary
destructive: bg #DC2626 (red-600) | text white | hover #B91C1C

# Tamaños
sm:  height 32px | px --space-3 | text-sm   | radius --radius-md
md:  height 38px | px --space-4 | text-base | radius --radius-md
lg:  height 44px | px --space-6 | text-lg   | radius --radius-md

# Reglas
✓ transition: background-color --duration-fast --ease-default
✓ disabled: opacity 0.4, cursor not-allowed, pointer-events none
✓ loading: spinner 16px left, texto "Cargando..." deshabilitado
✓ icon-only: aria-label obligatorio, aspect-ratio 1:1
✗ jamás más de 4 palabras en el label
✗ jamás uppercase en el texto

### INPUT / FORM FIELD

height:        40px
padding:       --space-2 --space-3
border:        1px solid --border-default
border-radius: --radius-md
bg:            white
focus:         border-color --border-brand (#185FA5) | ring 2px rgba(24,95,165,0.20)
error:         border-color --text-danger | message text-xs --text-danger debajo
label:         text-sm --weight-medium --text-primary | margin-bottom --space-1

### CARD

bg:            --bg-surface (#FFFFFF)
border:        0.5px solid --border-default (#E2E8F0)
border-radius: --radius-lg
padding:       --space-6
hover:         border-color --border-strong | transform translateY(-1px)
shadow:        ninguna en reposo. Solo en hover: 0 4px 12px rgba(4,44,83,0.06)

### BADGE / PILL

height:        22px | padding 0 --space-2 | border-radius --radius-full
text:          text-xs --weight-medium
variantes:
  brand:   bg --bg-brand-light (#E6F1FB) | text --text-brand-strong (#0C447C)
  success: bg #EAF3DE | text #27500A
  warning: bg #FAEEDA | text #633806
  danger:  bg #FCEBEB | text #791F1F
  neutral: bg --bg-subtle (#F1F5F9) | text --text-secondary (#64748B)

# Estados de citas — badges específicos
  agendada:    bg #E6F1FB  | text #0C447C   ← azul claro / navy
  confirmada:  bg #EAF3DE  | text #27500A   ← verde claro / verde oscuro
  por-confirmar: bg #FAEEDA | text #633806  ← amber claro / amber oscuro
  llego:       bg #E6F1FB  | text #185FA5   ← azul
  sala-espera: bg #EEEDFE  | text #3C3489   ← púrpura claro / oscuro
  en-atencion: bg #E6F1FB  | text #0C447C   ← azul
  atendida:    bg #F1F5F9  | text #334155   ← gris neutro
  reagendada:  bg #FAEEDA  | text #854F0B   ← amber
  no-asistio:  bg #FCEBEB  | text #A32D2D   ← rojo claro / oscuro
  cancelada:   bg #FCEBEB  | text #791F1F   ← rojo
  bloqueada:   bg #F1F5F9  | text #64748B   ← gris

### APP NAVIGATION

desktop:       header horizontal | navegación principal visible | menús contextuales
tablet:        header compacto | navegación dentro de drawer izquierdo
mobile:        header esencial | navegación dentro de drawer izquierdo
drawer-width:  384px máximo | 100% del viewport en pantallas estrechas
nav-item:      min-height 44px | px --space-3 | radius --radius-md | gap --space-3
item-default:  text --text-primary | icon --text-secondary
item-hover:    bg --bg-subtle
item-active:   bg --bg-brand-light | text --text-brand-strong
               | border-left 3px solid --nav-item-active-border
section-label: text-xs uppercase tracking-widest | color --text-secondary

### DATA TABLE (ESTÁNDAR PREMIUN)

border:          0.5px solid --border-default entre filas (border-b), NUNCA bordes en columnas (border-r-0 obligatorio).
container:       border 0.5px solid --border-default | radius --radius-lg | overflow hidden | shadow 2xs
header:          bg-slate-50/80 | text-[11px] font-semibold tracking-wider text-slate-500 uppercase | border-b --border-default
row-height:      48px - 54px | px --space-4 py --space-3.5 | hover: bg-slate-50/60 transition-colors
cell-padding:    --space-3 --space-4
column-identity: avatar 36x36px rounded-lg bg-blue-50 text-blue-600 border border-blue-100 + título font-semibold + badge categoría
column-date:     chip horizontal px-2.5 py-1 radius-md bg-slate-100/80 font-medium tabular-nums + icono Calendar 14px
column-badge:    chip pill redondeado con icono de contexto (Tag, Shield, etc.) tabular-nums
column-status:   dot status pill con indicador circular h-1.5 w-1.5 (emerald/amber/rose) + borde translúcido
column-actions:  fila horizontal directa gap-1 justify-end (flex items-center gap-1) | jamás menús flotantes de 3 puntos
text:          text-xs --text-brand (#185FA5)
radius:        --radius-sm
padding:       --space-1 --space-2
hover:         bg #B5D4F4 | text --text-brand-strong (#0C447C)

────────────────────────────────────────────────────────────
## SISTEMA DE LAYOUT Y GRID

max-width:     1280px (contenedor) | 1536px (full-wide)
grid:          12 columnas | gap --space-6
navigation:    header horizontal en desktop | drawer en tablet/mobile
topbar:        min-height 56px | bg --bg-surface | border-bottom --border-default
content-area:  padding --space-8 | bg --bg-page (#F8FAFD)
section-gap:   --space-10 entre secciones

# Breakpoints
mobile:        < 640px  → header esencial + drawer
tablet:        640–1024px → header compacto + drawer
desktop:       > 1024px → header y navegación horizontal

────────────────────────────────────────────────────────────
## REGLAS GLOBALES DE COMPOSICIÓN

✓ Un solo CTA primario por vista. Los demás son secondary o ghost.
✓ Alineación de texto: left siempre. Center solo en empty states.
✓ Separación entre secciones: siempre con espacio, nunca con líneas decorativas.
✓ Íconos acompañan texto, nunca reemplazan. Excepción: controles conocidos con tooltip y aria-label.
✓ Los estados vacíos (empty state) tienen: ícono 40px, título, descripción corta, 1 CTA.
✓ Los skeletons de carga usan --bg-subtle con animación pulse de 1.5s.
✓ El color del texto sobre --bg-nav siempre usa --text-inverse o variantes rgba blancas.
✓ Los títulos de página usan --text-brand-strong (#0C447C), no negro puro.
✗ No gradientes en superficies de UI.
✗ No sombras decorativas. Solo sombra funcional en modales: 0 20px 60px rgba(4,44,83,0.15)
✗ No más de 3 niveles de jerarquía tipográfica por sección.
✗ No bordes redondeados en elementos que tengan border solo en un lado.
✗ No colores fuera de la paleta. Ni siquiera para "un caso especial".
✗ No usar el navy-900 (#042C53) fuera de superficies de navegación que requieran contraste inverso.

────────────────────────────────────────────────────────────
## REFERENCIA RÁPIDA — HEXADECIMALES

# Copia y pega directamente en código

SIDEBAR/TOPBAR BG:     #042C53
SIDEBAR ITEM ACTIVO:   rgba(55,138,221,0.20)
SIDEBAR TEXTO ACTIVO:  #378ADD
SIDEBAR BORDE ACTIVO:  #378ADD   (3px left)
SIDEBAR TEXTO DEFAULT: rgba(248,250,252,0.65)

BRAND / LINKS:         #185FA5
BRAND HOVER:           #0C447C
BRAND LIGHT (chips):   #E6F1FB
BRAND BORDER LIGHT:    #B5D4F4
PAGE TITLES:           #0C447C

CTA PRIMARY:           #185FA5
CTA HOVER:             #0C447C

PAGE BG:               #F8FAFD
SURFACE (cards):       #FFFFFF
SUBTLE (hover/header): #F1F5F9

TEXT PRIMARY:          #334155
TEXT SECONDARY:        #64748B
TEXT INVERSE:          #F8FAFC

BORDER DEFAULT:        #E2E8F0
BORDER STRONG:         #CBD5E1
BORDER BRAND:          #185FA5

SUCCESS TEXT:          #27500A   | SUCCESS BG: #EAF3DE
WARNING TEXT:          #633806   | WARNING BG: #FAEEDA
DANGER TEXT:           #791F1F   | DANGER BG:  #FCEBEB
NEUTRAL TEXT:          #64748B   | NEUTRAL BG: #F1F5F9

────────────────────────────────────────────────────────────
## INSTRUCCIONES PARA EL AGENTE

# Lee esto antes de construir cualquier pantalla o componente.

1. ANTES de escribir una sola línea de código, identifica qué
   componentes del catálogo anterior participan en la pantalla.

2. Usa los tokens semánticos (--bg-page, --text-primary, etc.),
   NUNCA los primitivos ni valores hardcodeados.

3. Si un componente ya está definido arriba, úsalo exactamente
   como está especificado. No reinterpretes ni ajustes a gusto.

4. Si necesitas un componente que no existe en el catálogo,
   documéntalo siguiendo el mismo formato antes de implementarlo.

5. Cada pantalla debe tener exactamente UN botón primary visible.
   El resto de acciones son secondary, ghost o links.

6. El orden de prioridad visual en cualquier pantalla es:
   Dato principal → Acción principal → Contexto secundario.

7. Para validar tu output antes de entregarlo, pregúntate:
   — ¿Algún color aquí existe fuera del sistema? → Reemplázalo.
   — ¿Algún espacio es un valor arbitrario? → Usa el token más cercano.
   — ¿Hay más de un CTA primario? → Degrada los demás.
   — ¿Hay animaciones innecesarias? → Elimínalas.
   — ¿El header y drawer respetan los tokens semánticos? → Verifica.
   — ¿Los títulos de página usan #0C447C? → Verifica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIN DEL DESIGN SYSTEM — versión 2.1.0
Cambio principal: CTA primario unificado a Azul Zafiro (#185FA5) y secundario a Slate Neutro.
Navegación: header desktop + drawer responsive | Brand: #185FA5 | CTA: #185FA5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
