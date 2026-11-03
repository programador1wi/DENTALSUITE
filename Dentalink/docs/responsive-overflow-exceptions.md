# Excepciones responsive de desplazamiento contenido

Regla global: `document.documentElement.scrollWidth` no puede superar `clientWidth`. Una excepción solo permite desplazamiento dentro de su propio contenedor y debe declarar `data-responsive-overflow="contained"`.

| Superficie | Motivo | Alternativa móvil | Requisito |
| --- | --- | --- | --- |
| Agenda semanal/profesionales | Tiempo y profesionales forman dos ejes relacionados | Vista diaria/lista cuando el usuario no necesita comparar columnas | Pan contenido, sin ensanchar documento |
| Odontograma | Posición dental es parte del dato clínico | Zoom/pan del diagrama | No convertir dientes en tabla administrativa |
| Periodontograma/comparación | Medidas dependen de posición y secuencia dental | Pan contenido | Etiqueta accesible y overscroll contenido |
| Visor radiográfico | Imagen puede exceder el área disponible por zoom | Pan dentro del visor | Controles permanecen dentro del viewport |

No son excepciones válidas: tablas de pacientes, pagos, usuarios, inventario, reportes o configuración. Esas superficies deben priorizar columnas y transformarse en registros compactos en móvil.
