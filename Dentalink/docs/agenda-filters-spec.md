# Especificación Técnica y Funcional: Panel de Filtros y Workflow de la Agenda

## 1. Introducción al Panel de Filtros Visuales

En un sistema de gestión clínica dental (ERP/HIS), la agenda no es un simple calendario de visualización; es el motor operativo de la clínica. El panel izquierdo de filtros representa visualmente el **Workflow de la Cita**, que rastrea el ciclo de vida completo de un paciente desde que manifiesta intención de consulta hasta que abandona las instalaciones tras recibir atención médica y liquidar sus servicios.

### Representación Estructural del Workflow

El flujo general de transiciones de estado de una cita sigue una secuencia operativa lógica, aunque permite ramificaciones según eventos de comunicación y comportamiento del paciente:

```
                  [ Agendamiento ]
                         │
        ┌────────────────┴────────────────┐
   [ Agendada ]                    [ Agenda Online ]
        │                                 │
        └────────────────┬────────────────┘
                         │
                 [ Comunicación ]
         (WhatsApp / Email / Teléfono)
        ┌────────────────┼────────────────┐
   [ Notificado ]   [ Confirmado ]  [ No Confirmado ]
        │                │                │
        └────────────────┼────────────────┘
                         │
                  [ Recepción ]
                         │
                [ En Sala de Espera ]
                         │
                   [ Atención ]
                         │
                  [ Atendiéndose ]
                         │
                  [ Finalización ]
         ┌───────────────┼───────────────┐
    [ Atendido ]     [ No Asiste ]   [ Cancelado ]
                                         │
                             ┌───────────┴───────────┐
                      [ Reprogramado ]       [ Conflicto ]
```

---

## 2. Análisis Detallado del Catálogo de Estados

A continuación, se presenta la especificación exhaustiva de cada uno de los dieciséis (16) estados del sistema.

---

### Estado 1: Agendada (`SCHEDULED`)

#### 1.1 Definición
Es el estado inicial por defecto de una cita creada manualmente por el personal interno de la clínica a través del módulo de Agenda. Indica una reserva de bloque de tiempo confirmada en el sillón de un odontólogo para un paciente específico, pero sin validaciones de confirmación ni notificaciones previas.

#### 1.2 Objetivo
Bloquear el tiempo del profesional y el sillón dental (recurso físico) en la agenda para evitar colisiones de horario (double-booking) mientras se inicia el proceso de preparación del paciente.

#### 1.3 Cómo llega una cita a ese estado
El recepcionista o el propio odontólogo hace clic sobre un bloque horario libre en la interfaz de calendario, completa el formulario de reserva con los datos del paciente, el motivo de consulta, la sucursal, el profesional, y guarda el registro.

#### 1.4 Qué evento dispara el cambio
- Evento de Backend: `APPOINTMENT_CREATED`
- Hook de persistencia: `beforeInsert` o `afterSave` en la entidad `Appointment`.

#### 1.5 Qué usuario puede cambiarlo
- **Personal de Recepción:** Permisos estándar de escritura en agenda.
- **Doctor:** Si tiene permisos para autogestionar su agenda.
- **Administrador:** Acceso completo.
- *El Sistema* por inserción directa.

#### 1.6 Qué módulo interviene
- Módulo de Agenda (Frontend/Backend).
- Módulo de Catálogos (para obtener pacientes, profesionales y sillones).

#### 1.7 Qué información se registra
- `appointment.id` (UUIDv4)
- `appointment.status` = `'SCHEDULED'`
- `appointment.start_at` / `end_at` (Timestamps UTC)
- `appointment.created_by` (ID del usuario activo)
- `appointment.patient_id`, `professional_id`, `chair_id`
- Historial en la tabla `appointment_status_history` documentando la creación inicial.

#### 1.8 Qué acciones automáticas ejecuta el sistema
1. Cálculo de duración y validación de disponibilidad del bloque de tiempo (evitando colisión de recursos).
2. Generación del ID interno para el Plan de Tratamiento Inicial (si no existe uno activo).
3. Encolamiento de la tarea de notificación automatizada (según reglas del canal predeterminado del paciente).

#### 1.9 Qué módulos consumen ese estado
- **Agenda:** Renderiza la cita en la hora/sillón respectivo con su color asignado.
- **Reportes de Ocupación:** Computa el tiempo reservado vs tiempo disponible.

#### 1.10 Qué ocurre después de ese estado
La cita avanza hacia un estado de comunicación (Notificado, Confirmado) o bien pasa directamente a "En sala de espera" el día de la cita si el paciente acude de forma imprevista.

#### 1.11 Casos prácticos
- Un paciente llama por teléfono para pedir su control semestral de ortodoncia. La recepcionista busca un espacio el martes a las 10:00 y agenda la cita. Esta aparece inmediatamente con el color azul/celeste por defecto de "Agendada".

#### 1.12 Posibles reglas de negocio
- No se permite crear una cita `SCHEDULED` en el pasado.
- Un paciente con deuda morosa de más de 60 días no puede pasar a `SCHEDULED` sin la autorización explícita de un Administrador (solicitud de bypass).

---

### Estado 2: Agenda Online (`ONLINE_BOOKING`)

#### 2.1 Definición
Representa una cita reservada de forma autónoma por el paciente a través de un canal externo de autoservicio (Portal de Pacientes, Widget de Reserva Web o CRM integrado).

#### 2.2 Objetivo
Diferenciar las citas autogestionadas por el paciente de aquellas creadas por el personal clínico, lo que permite auditar la efectividad de los canales digitales y aplicar flujos especiales de validación (por ejemplo, evitar reservas fantasmas).

#### 2.3 Cómo llega una cita a ese estado
El paciente accede al sitio web de la clínica, selecciona especialidad, profesional, horario disponible, completa su información de contacto y confirma la cita.

#### 2.4 Qué evento dispara el cambio
- Evento de API: `PUBLIC_APPOINTMENT_SUBMITTED`
- Origen de red: Endpoint público `/api/v1/public/booking` sin sesión administrativa.

#### 2.5 Qué usuario puede cambiarlo
- **Sistema:** Registra la cita a través del webhook/API pública.
- **CRM Integrado:** Si se deriva desde una campaña de conversión de leads.

#### 2.6 Qué módulo interviene
- Módulo de Portal Público / Widget Web.
- Motor de Disponibilidad Horaria (para validar slots en tiempo real).

#### 2.7 Qué información se registra
- IP del paciente reservante.
- Canal de origen (ej. `facebook_ad`, `website`, `google_maps`).
- Estado de validación de identidad (ej. RUT/DNI verificado por SMS OTP).
- `appointment.status` = `'ONLINE_BOOKING'`

#### 2.8 Qué acciones automáticas ejecuta el sistema
1. Envío inmediato de correo electrónico con la confirmación de la solicitud y link de cancelación.
2. Envío de alerta interna a Recepción indicando: *"Nueva cita online pendiente de revisión"*.
3. Bloqueo temporal del sillón en la base de datos distribuida para evitar race conditions.

#### 2.9 Qué módulos consumen ese estado
- **Módulo de CRM / Marketing:** Registra la conversión de la campaña publicitaria.
- **Bandeja de Entrada de Recepción:** Panel de validación de reservas web para autorizar o reasignar sillón.

#### 2.10 Qué ocurre después de ese estado
El personal de la clínica revisa la cita y la cambia a `CONFIRMED` o `SCHEDULED`, o el motor automático de WhatsApp la procesa.

#### 2.11 Casos prácticos
- Un paciente nuevo busca en Google a las 11:00 PM una clínica. Entra al widget, agenda cita para profilaxis el viernes. La cita aparece en la agenda de color morado ("Agenda Online") alertando a la recepcionista el día siguiente para validar el caso.

#### 2.12 Posibles reglas de negocio
- Las citas en estado `ONLINE_BOOKING` se liberan automáticamente (borrado lógico) si el paciente no realiza el pago del copago en línea dentro de los 15 minutos posteriores a la selección del horario.

---

### Estado 3: Notificado por WhatsApp (`NOTIFIED_BY_WHATSAPP`)

#### 3.1 Definición
Estado en el cual la cita ha sido procesada por el motor de mensajería y se ha enviado con éxito una plantilla (template HSM de Meta) al teléfono celular del paciente solicitando confirmación.

#### 3.2 Objetivo
Reducir la tasa de inasistencia (no-show) automatizando la comunicación previa a la cita sin requerir tiempo del personal de recepción.

#### 3.3 Cómo llega una cita a ese estado
El servicio en segundo plano (Cron job o cola de mensajería) detecta citas próximas (ej. 24 horas antes) en estado `SCHEDULED` u `ONLINE_BOOKING` y dispara el mensaje.

#### 3.4 Qué evento dispara el cambio
- Evento de CRM/Bot: `WHATSAPP_MESSAGE_SENT`
- Disparado por el webhook del proveedor de mensajería (ej. Twilio, Meta Cloud API) retornando código `sent` o `delivered`.

#### 3.5 Qué usuario puede cambiarlo
- **Sistema / Bot de WhatsApp:** De forma automatizada.
- **Recepcionista:** Si reenvía manualmente la plantilla desde la ficha de la cita.

#### 3.6 Qué módulo interviene
- Módulo de Integración de Mensajería (WhatsApp Gateway).
- Motor de Eventos en Cola (Redis / BullMQ).

#### 3.7 Qué información se registra
- ID de mensaje de WhatsApp (`message_sid`).
- Teléfono destino.
- Fecha y hora exacta de la notificación.
- Template ID utilizado.

#### 3.8 Qué acciones automáticas ejecuta el sistema
1. Marcado visual de la cita con el color naranja/celeste correspondiente.
2. Registro en la bitácora de auditoría de comunicaciones del paciente.

#### 3.9 Qué módulos consumen ese estado
- **Agenda:** Cambia el color/ícono de la cita en pantalla.
- **CRM:** Actualiza el estado de las interacciones del lead/paciente.

#### 3.10 Qué ocurre después de ese estado
El paciente responde al mensaje (Sí/No) a través del chat, gatillando el paso a `CONFIRMED_BY_WHATSAPP` o `CANCELLED_BY_PATIENT` (o similar). Si no hay respuesta dentro de un periodo de tiempo, pasa a "No confirmado".

#### 3.11 Casos prácticos
- El bot ejecuta su tarea programada a las 9:00 AM. Detecta que Carolina Catzin tiene cita mañana a las 10:00. Le envía el mensaje. La cita en la pantalla del ERP cambia automáticamente a color naranja/celeste de "Notificado por WhatsApp".

#### 3.12 Posibles reglas de negocio
- Solo se notifica si el número de teléfono cumple con el formato internacional E.164 y el paciente no tiene activa la exclusión voluntaria de notificaciones (opt-out).

---

### Estado 4: Confirmado por WhatsApp (`CONFIRMED_BY_WHATSAPP`)

#### 4.1 Definición
Estado que indica que el paciente ha interactuado directamente con el mensaje de WhatsApp recibido, seleccionando la opción afirmativa de asistencia a su cita.

#### 4.2 Objetivo
Garantizar al 95% de confianza que el paciente asistirá a la cita, permitiendo a la clínica optimizar los tiempos de preparación del material y los sillones.

#### 4.3 Cómo llega una cita a ese estado
El paciente pulsa el botón "Confirmar" o responde con un texto afirmativo (ej. "Sí", "Asistiré") al mensaje de WhatsApp del bot.

#### 4.4 Qué evento dispara el cambio
- Evento de API de Webhook: `WHATSAPP_USER_CONFIRMED`
- Procesamiento del NLP o análisis sintáctico de la respuesta de Meta.

#### 4.5 Qué usuario puede cambiarlo
- **Sistema / Bot:** Al recibir el webhook de la plataforma de mensajería.
- **Recepcionista:** Puede forzar manualmente el estado a petición verbal del paciente.

#### 4.6 Qué módulo interviene
- Webhook Parser de WhatsApp.
- Motor de Reglas Clínicas.

#### 4.7 Qué información se registra
- Texto exacto de la respuesta del usuario (payload de respuesta).
- Timestamp de confirmación.

#### 4.8 Qué acciones automáticas ejecuta el sistema
1. Envío de un mensaje de agradecimiento e instrucciones de llegada (ej. mapa de ubicación de la sucursal).
2. Actualización en tiempo real del dashboard de Recepción (WebSockets).

#### 4.9 Qué módulos consumen ese estado
- **Agenda:** Color de borde verde agua brillante en la cita.
- **Módulo de Abastecimiento:** En clínicas grandes, asocia insumos clínicos al sillón al estar la cita asegurada.

#### 4.10 Qué ocurre después de ese estado
La cita queda en espera del día de atención. Al llegar el paciente a la sucursal, la recepcionista cambia el estado a "En sala de espera".

#### 4.11 Casos prácticos
- Maria Eugenia recibe a las 10:00 AM un mensaje preguntando por su cita del día siguiente. Ella pulsa el botón "Confirmar Asistencia". Inmediatamente, en la pantalla de la recepcionista, la cita de María cambia al color verde de confirmación automática.

#### 4.12 Posibles reglas de negocio
- Al confirmarse la cita por WhatsApp, se bloquea la posibilidad de que otros pacientes soliciten ese bloque de tiempo en caso de sobreventa.

---

### Estado 5: No confirmado (`PENDING_CONFIRMATION`)

#### 5.1 Definición
Representa una cita cuyo plazo de confirmación automática ha expirado o que el paciente explícitamente dejó en suspenso al ser contactado.

#### 5.2 Objetivo
Alertar al equipo de admisiones o recepción de que esta cita tiene un alto riesgo de inasistencia (no-show) y requiere gestión manual directa (llamada telefónica).

#### 5.3 Cómo llega una cita a ese estado
El sistema detecta que faltan 12 horas para la cita y el paciente no ha respondido al WhatsApp o correo de notificación enviado previamente.

#### 5.4 Qué evento dispara el cambio
- Evento temporal: `CONFIRMATION_TIMEOUT_EXPIRED`
- Ejecutado por un proceso cron por lotes.

#### 5.5 Qué usuario puede cambiarlo
- **Sistema:** Por temporizador vencido.
- **Recepcionista:** Si intenta contactar al paciente y este le indica que "aún no está seguro de poder ir".

#### 5.6 Qué módulo interviene
- Motor de Tareas en Segundo Plano.
- Control de Estados de la Agenda.

#### 5.7 Qué información se registra
- Timestamp del cambio de estado.
- Contador de intentos de contacto fallidos.

#### 5.8 Qué acciones automáticas ejecuta el sistema
1. Inserción de la cita en la "Lista de Llamadas Pendientes" del módulo de Recepción para contacto manual.

#### 5.9 Qué módulos consumen ese estado
- **Consola de Telemarketing / Recepción:** Filtra todas las citas en `PENDING_CONFIRMATION` para iniciar el barrido telefónico.

#### 5.10 Qué ocurre después de ese estado
Se realiza llamada telefónica. O bien se confirma (pasa a "Confirmado por teléfono"), o bien se cancela (pasa a "Anulado por reprogramación" o "Cancelado").

#### 5.11 Casos prácticos
- Ignacio Ramos tenía cita a las 10:30 AM del martes. Se le envió notificación el lunes a las 10:30 AM. Pasaron las horas y a las 10:30 PM el bot detecta que no hay respuesta; cambia el estado a "Por confirmar" (amarillo). El martes a primera hora, la recepcionista ve el estado y lo llama por teléfono.

#### 5.12 Posibles reglas de negocio
- Si una cita permanece en `PENDING_CONFIRMATION` hasta 4 horas antes del bloque y la clínica tiene lista de espera activa, el sistema puede liberar el espacio previa alerta al paciente.

---

### Estado 6: Notificado vía Email (`NOTIFIED_BY_EMAIL`)

#### 6.1 Definición
Cita para la cual se ha enviado un correo electrónico informativo/recordatorio de forma automática con los detalles de la agenda.

#### 6.2 Objetivo
Complementar las notificaciones móviles por un canal formal y no intrusivo, útil para enviar instrucciones detalladas prependientes (como ayunos o firmas de consentimientos informados).

#### 6.3 Cómo llega una cita a ese estado
Al crearse una cita o al activarse el cron de recordatorios, si el paciente tiene el correo electrónico configurado como canal prioritario, se despacha el mail.

#### 6.4 Qué evento dispara el cambio
- Evento del servicio de correo: `EMAIL_SENT_SUCCESSFULLY`
- Originado desde el microservicio de correos (ej. SendGrid, AWS SES).

#### 6.5 Qué usuario puede cambiarlo
- **Sistema:** Envío automático programado.
- **Recepcionista / Doctor:** Haciendo clic en "Reenviar correo de cita" en el modal de acciones de la cita.

#### 6.6 Qué módulo interviene
- Microservicio de Envío de Email.
- Gestor de Plantillas HTML dinámicas.

#### 6.7 Qué información se registra
- Correo destino.
- ID del mensaje del servidor SMTP (`SMTP_Message_ID`).
- Plantilla HTML y variables inyectadas.

#### 6.8 Qué acciones automáticas ejecuta el sistema
1. Registro en la bitácora de correos enviados al paciente.
2. Cambio visual en la agenda al color asociado.

#### 6.9 Qué módulos consumen ese estado
- **Módulo de Consentimiento Informado:** Verifica si el paciente ya fue notificado y si leyó los anexos adjuntos al correo.

#### 6.10 Qué ocurre después de ese estado
El paciente abre el correo y hace clic en el enlace de confirmación (pasa a "Confirmado por email" o equivalente) o la recepcionista llama por teléfono.

#### 6.11 Casos prácticos
- Un paciente de rehabilitación oral extensa requiere instrucciones prequirúrgicas por escrito. El sistema le envía un correo electrónico. La cita cambia a "Notificado vía Email" de color azul cielo.

#### 6.12 Posibles reglas de negocio
- El sistema no enviará el correo electrónico si la dirección registrada no supera la expresión regular de validación RFC 5322 o si rebotó (hard bounce) en envíos anteriores.

---

### Estado 7: Confirmado por teléfono (`CONFIRMED_BY_PHONE`)

#### 7.1 Definición
Cita cuya asistencia ha sido confirmada verbalmente por el paciente mediante una llamada telefónica manual realizada por el personal de la clínica.

#### 7.2 Objetivo
Asegurar la agenda diaria utilizando el canal directo tradicional (muy común en pacientes de la tercera edad o tratamientos de alta complejidad).

#### 7.3 Cómo llega una cita a ese estado
La recepcionista llama al paciente que estaba en estado "Por confirmar", este le asegura verbalmente que asistirá, y la recepcionista actualiza manualmente el estado en la interfaz del ERP.

#### 7.4 Qué evento dispara el cambio
- Acción manual en frontend: `APPOINTMENT_STATUS_UPDATE_MANUAL` con payload `status: 'CONFIRMED_BY_PHONE'`.

#### 7.5 Qué usuario puede cambiarlo
- **Recepcionista / Admisionista:** Rol estándar.
- **Administrador.**

#### 7.6 Qué módulo interviene
- Módulo de Agenda (Interfaz de usuario).
- Integración de Telefonía IP (opcional, si se registra la llamada desde el marcador integrado).

#### 7.7 Qué información se registra
- ID del usuario que realizó el cambio.
- Comentarios opcionales ingresados en la llamada (ej. *"Asistirá con su acompañante"*).
- Duración de la llamada de confirmación (si hay integración de telefonía).

#### 7.8 Qué acciones automáticas ejecuta el sistema
1. Registro en la bitácora de auditoría.
2. Generación del reporte de efectividad del equipo de llamadas.

#### 7.9 Qué módulos consumen ese estado
- **Agenda:** Color azul marino brillante de confirmación manual en la grilla.

#### 7.10 Qué ocurre después de ese estado
Queda en espera hasta el día de la cita, donde pasará a "En sala de espera" al ingresar el paciente a la sucursal.

#### 7.11 Casos prácticos
- El recepcionista ve la lista de pacientes sin confirmar del día de hoy. Llama a Don Carlos, quien le dice: *"Sí, voy en camino"*. El recepcionista cuelga y marca la cita como "Confirmado por teléfono".

#### 7.12 Posibles reglas de negocio
- Marcar una cita como `CONFIRMED_BY_PHONE` requiere obligatoriamente que el registro del paciente contenga un número telefónico válido.

---

### Estado 8: En sala de espera (`WAITING_ROOM`)

#### 8.1 Definición
Indica que el paciente ha ingresado físicamente a la clínica, ha pasado el proceso de registro (check-in) en recepción y se encuentra físicamente esperando a ser llamado al box por el odontólogo.

#### 8.2 Objetivo
Alertar al odontólogo en tiempo real de que su paciente ya está listo en las instalaciones y registrar los tiempos de espera del paciente para control de calidad del servicio (SLA).

#### 8.3 Cómo llega una cita a ese estado
El paciente se presenta en el mostrador. La recepcionista valida sus datos de afiliación/pago y presiona el botón "Llegó" o "Mover a Sala de Espera" en su monitor.

#### 8.4 Qué evento dispara el cambio
- Evento de check-in: `PATIENT_CHECKED_IN`
- Endpoint: `/api/v1/appointments/:id/waiting-room`

#### 8.5 Qué usuario puede cambiarlo
- **Recepcionista:** Usuario principal de recepción de pacientes.
- **Totem de Autoatención:** Si la clínica cuenta con una pantalla de registro con código QR o RUT.

#### 8.6 Qué módulo interviene
- Módulo de Admisión y Recepción.
- Módulo de Fila de Espera / Pantalla de sala de espera (Triage/TV).

#### 8.7 Qué información se registra
- Timestamp exacto de entrada a sala de espera (`checked_in_at`).
- Estado de cuentas del paciente en el momento de llegada (ej. saldo pendiente).
- Confirmación de datos personales validados.

#### 8.8 Qué acciones automáticas ejecuta el sistema
1. Emisión de una notificación tipo *Toast* o sonido de alerta en la interfaz del odontólogo asignado indicando: *"Su paciente [Nombre] se encuentra en sala de espera"*.
2. Envío del nombre del paciente a la pantalla digital de llamadas de la sala de espera.

#### 8.9 Qué módulos consumen ese estado
- **Dashboard del Odontólogo:** Muestra la lista priorizada de pacientes esperando en su box.
- **Módulo de Calidad:** Mide el desfase entre la hora agendada y la hora real de llegada.

#### 8.10 Qué ocurre después de ese estado
El odontólogo sale al pasillo o llama al paciente mediante el sistema, moviendo la cita a "Atendiéndose".

#### 8.11 Casos prácticos
- Claudia Susana llega a la clínica a las 11:50 AM para su cita de las 12:00. Saluda a la recepcionista, quien presiona "Llegó". La cita cambia a color azul rey ("En sala de espera") y al Dr. Prieto le suena una campana en su laptop indicando que el paciente está listo.

#### 8.12 Posibles reglas de negocio
- El cambio a `WAITING_ROOM` no está permitido si la fecha de la cita no corresponde al día actual de la operación de la clínica.

---

### Estado 9: Atendiéndose (`IN_PROGRESS`)

#### 9.1 Definición
Estado que indica que el paciente ha ingresado al box clínico y el odontólogo ha iniciado formalmente la consulta, procedimiento o intervención diagnóstica.

#### 9.2 Objetivo
Rastrear en tiempo real el uso efectivo del sillón dental y la actividad productiva del odontólogo, además de bloquear la ficha clínica para edición exclusiva del doctor activo.

#### 9.3 Cómo llega una cita a ese estado
El odontólogo abre la ficha clínica del paciente desde la grilla de la agenda o presiona "Iniciar Atención".

#### 9.4 Qué evento dispara el cambio
- Evento Clínico: `CLINICAL_SESSION_STARTED`
- Endpoint: `/api/v1/appointments/:id/start`

#### 9.5 Qué usuario puede cambiarlo
- **Odontólogo / Auxiliar Dental:** Único personal autorizado para iniciar la atención clínica.

#### 9.6 Qué módulo interviene
- Módulo de Ficha Clínica / Odontograma.
- Módulo de Agenda Clínica.

#### 9.7 Qué información se registra
- Timestamp de inicio real de atención (`started_at`).
- ID del Box/Sillón físico donde se ejecuta el procedimiento.

#### 9.8 Qué acciones automáticas ejecuta el sistema
1. Apertura automática de la plantilla de evolución clínica y odontograma del paciente.
2. Bloqueo de concurrencia: ningún otro odontólogo puede abrir la ficha clínica de este paciente en modo edición simultáneamente para prevenir sobreescritura de notas médicas.
3. Cálculo en segundo plano del tiempo de espera total del paciente (`started_at - checked_in_at`).

#### 9.9 Qué módulos consumen ese estado
- **Agenda:** La cita se tiñe de color azul brillante e ícono de "En tratamiento".
- **Admisión:** Informa a recepción que el Box X está actualmente ocupado.

#### 9.10 Qué ocurre después de ese estado
La cita avanza invariablemente al estado "Atendido" tras el cierre de la evolución clínica, o en casos excepcionales de emergencia médica, puede suspenderse.

#### 9.11 Casos prácticos
- El Dr. Hilario Cruz ve a María Valencia en su lista de sala de espera. Le pide que pase a su box, abre su ficha en Dentalink y hace clic en "Iniciar Evolución". El color de la cita cambia a "Atendiéndose" en todo el sistema.

#### 9.12 Posibles reglas de negocio
- No se puede cambiar al estado `IN_PROGRESS` si la cita no ha pasado previamente por `WAITING_ROOM` (o requiere confirmación de bypass por parte del odontólogo).

---

### Estado 10: Atendido (`COMPLETED`)

#### 10.1 Definición
Es el estado final del flujo clínico. Indica que el tratamiento programado para la sesión ha concluido con éxito, se han registrado las prestaciones realizadas y el paciente puede retirarse del box.

#### 10.2 Objetivo
Cerrar el ciclo clínico de la sesión para dar paso al proceso administrativo de facturación, cobro de copagos, entrega de recetas y agendamiento de próximas citas.

#### 10.3 Cómo llega una cita a ese estado
El odontólogo finaliza el registro de la evolución clínica, firma digitalmente la sesión y presiona "Guardar y Finalizar Atención".

#### 10.4 Qué evento dispara el cambio
- Evento de Cierre Clínico: `CLINICAL_SESSION_COMPLETED`
- Endpoint: `/api/v1/appointments/:id/complete`

#### 10.5 Qué usuario puede cambiarlo
- **Odontólogo:** Responsable de la firma clínica.
- **Asistente Dental:** Si el odontólogo le delega la facultad por configuración interna.

#### 10.6 Qué módulo interviene
- Módulo de Evolución y Ficha Clínica.
- Módulo de Cuentas Corrientes / Presupuestos.

#### 10.7 Qué información se registra
- Timestamp de finalización de atención (`completed_at`).
- Código de diagnóstico (CIE-10 dental).
- Listado de prestaciones ejecutadas (Códigos de arancel/tratamiento).
- Evolución escrita en texto enriquecido.
- Firma digital del profesional (Hash SHA-256).

#### 10.8 Qué acciones automáticas ejecuta el sistema
1. Generación inmediata de cargos financieros en la cuenta corriente del paciente basados en las prestaciones evolucionadas.
2. Actualización del Odontograma interactivo (se marcan las piezas restauradas o extraídas).
3. Envío automático por email de la receta digitalizada y las indicaciones post-tratamiento.
4. Desbloqueo de la ficha clínica del paciente.

#### 10.9 Qué módulos consumen ese estado
- **Módulo Financiero / Caja:** Habilita el cobro de la sesión en el módulo de caja de Recepción.
- **Módulo de Comisiones:** Calcula el porcentaje de pago que le corresponde al odontólogo por el tratamiento realizado.

#### 10.10 Qué ocurre después de ese estado
El paciente pasa a la caja de recepción a pagar la sesión, y opcionalmente se le agenda su siguiente cita de control.

#### 10.11 Casos prácticos
- La Dra. Judy Prieto termina de colocar una resina a Claudia Susana. Guarda la evolución. La cita en la agenda se vuelve verde oliva brillante con la leyenda "Atendido" y un botón "Cobrar" se activa automáticamente en la pantalla de la cajera.

#### 10.12 Posibles reglas de negocio
- Una cita marcada como `COMPLETED` no puede ser modificada en cuanto a prestaciones cargadas sin una auditoría de un supervisor y la anulación de la transacción de caja asociada.

---

### Estado 11: No asistió (`NO_SHOW`)

#### 11.1 Definición
Estado asignado a una cita cuando el paciente agendado no se presenta a la clínica dentro del margen de tolerancia establecido para su horario programado, sin haber dado aviso de cancelación previa.

#### 11.2 Objetivo
Penalizar operativamente el espacio desperdiciado en la agenda para efectos de analítica de ausentismo y, si aplica, disparar políticas de cobro por inasistencia o restricciones de agendamiento futuro.

#### 11.3 Cómo llega una cita a ese estado
O bien de forma manual por la recepcionista al finalizar el día, o bien de forma automática por el sistema cuando expira el tiempo de tolerancia (ej. 30 minutos después de la hora de inicio).

#### 11.4 Qué evento dispara el cambio
- Evento de ausentismo: `APPOINTMENT_NO_SHOW_DETECTED`
- Desencadenado por Job programado nocturno o temporizador reactivo.

#### 11.5 Qué usuario puede cambiarlo
- **Sistema:** Por expiración de tolerancia.
- **Recepcionista:** Al declarar manualmente la ausencia del paciente.

#### 11.6 Qué módulo interviene
- Módulo de Control Operativo de Agenda.
- Motor de Reglas de Negocio.

#### 11.7 Qué información se registra
- Timestamp de la declaración del No-Show.
- Nota del sistema: *"Declarado ausente por tiempo de tolerancia expirado"*.

#### 11.8 Qué acciones automáticas ejecuta el sistema
1. Incremento del contador histórico de inasistencias en la ficha del paciente.
2. Envío de un WhatsApp/Email automatizado: *"Lamentamos que no hayas podido asistir a tu cita. ¿Deseas reagendar aquí? [Link]"*.

#### 11.9 Qué módulos consumen ese estado
- **Módulo de Reputación de Paciente:** Bloquea o restringe el agendamiento online a pacientes con más de 3 no-shows consecutivos.
- **Reportes de Productividad:** Deduce el tiempo de no-show del cálculo de eficiencia clínica.

#### 11.10 Qué ocurre después de ese estado
La cita queda guardada en el historial histórico de ausencias del paciente para auditoría.

#### 11.11 Casos prácticos
- Ignacio Ramos tenía cita a las 10:30 AM. Dan las 11:00 AM y no llega ni responde al teléfono. La recepcionista presiona "No Asistió". La cita cambia a color rojo oscuro y se envía un mensaje de re-agendamiento automático.

#### 11.12 Posibles reglas de negocio
- El sistema no permitirá marcar una cita como `NO_SHOW` antes de que hayan transcurrido al menos 15 minutos de la hora pactada de inicio de la cita.

---

### Estado 12: Cancelado (`CANCELLED`)

#### 12.1 Definición
Cita anulada formalmente antes del día/hora de la atención, ya sea por solicitud del paciente (Cancelada por Paciente) o por decisión de la clínica (Cancelada por Clínica) debido a imprevistos operativos.

#### 12.2 Objetivo
Liberar inmediatamente el bloque horario del profesional y el sillón dental para que pueda ser reservado por otro paciente (disponibilización del inventario de horas).

#### 12.3 Cómo llega una cita a ese estado
El paciente cancela desde el enlace provisto en su correo/WhatsApp, o llama para cancelar la cita sin solicitar reprogramación inmediata.

#### 12.4 Qué evento dispara el cambio
- Evento: `APPOINTMENT_CANCELLED`
- Endpoint: `/api/v1/appointments/:id/cancel` con payload descriptivo del motivo.

#### 12.5 Qué usuario puede cambiarlo
- **Paciente:** Vía portal de autoservicio.
- **Recepcionista / Administrador:** Vía ERP.
- **Doctor:** Si cancela su jornada por fuerza mayor.

#### 12.6 Qué módulo interviene
- Módulo de Gestión de Cancelaciones.
- Portal de Pacientes / API Pública.

#### 12.7 Qué información se registra
- Usuario que solicita la cancelación.
- Motivo de cancelación (catálogo obligatorio: ej. *Enfermedad, Problema laboral, Clima, etc.*).
- Timestamp de la cancelación.

#### 12.8 Qué acciones automáticas ejecuta el sistema
1. Envío de confirmación de cancelación al paciente.
2. Liberación inmediata del bloque en la base de datos (eliminación lógica de la reserva de horario).
3. Notificación a los pacientes en la "Lista de Espera Activa" que tengan preferencia por ese horario liberado.

#### 12.9 Qué módulos consumen ese estado
- **Módulo de Lista de Espera:** Dispara alertas de disponibilidad horaria.
- **Reportes de Cancelaciones:** Analiza motivos recurrentes para toma de decisiones.

#### 12.10 Qué ocurre después de ese estado
El bloque de la agenda queda en blanco (o la cita se difumina visualmente según la vista). La cita archivada sirve para analíticas de churn.

#### 12.11 Casos prácticos
- Ariadna llama con 2 días de anticipación e indica que no podrá asistir por viaje de negocios. La recepcionista selecciona la cita, hace clic en "Cancelar Cita", selecciona el motivo "Viaje" y guarda. La cita desaparece de la vista activa de la agenda y el espacio queda libre.

#### 12.12 Posibles reglas de negocio
- Las cancelaciones realizadas con menos de 24 horas de anticipación pueden generar cobros automáticos de penalización según la política contractual de la clínica.

---

### Estado 13: Cancelado por sesiones en conflicto (`CANCELLED_CONFLICT`)

#### 13.1 Definición
Estado de anulación automática aplicado a una cita cuando el sistema detecta que existe una superposición insalvable de horarios (conflicto) provocada por un cambio estructural de la agenda o una doble reserva accidental (race condition).

#### 13.2 Objetivo
Resolver de forma automatizada y auditable las inconsistencias lógicas de solapamiento en la agenda clínica, asegurando que un recurso físico (sillón) o humano (doctor) no tenga dos pacientes al mismo tiempo.

#### 13.3 Cómo llega una cita a ese estado
Ocurre habitualmente cuando se modifica la jornada laboral de un doctor (por ejemplo, el doctor pide el día libre) y existen citas previas agendadas en ese rango, o si dos secretarias agendan en el mismo microsegundo el mismo bloque debido a falta de bloqueos optimistas.

#### 13.4 Qué evento dispara el cambio
- Evento de colisión: `APPOINTMENT_COLLISION_DETECTED` o `SCHEDULE_BLOCK_OVERLAP`

#### 13.5 Qué usuario puede cambiarlo
- **Sistema:** Disparado de forma autónoma por el motor de base de datos o el orquestador de colas al validar consistencia de fechas.

#### 13.6 Qué módulo interviene
- Validador Lógico de Horarios (Scheduler Core).
- Gestor de Conflictos de Agenda.

#### 13.7 Qué información se registra
- ID de la cita en conflicto concurrente.
- Causa raíz de la colisión.
- Timestamp del proceso de anulación.

#### 13.8 Qué acciones automáticas ejecuta el sistema
1. Envío de alerta crítica a la recepcionista: *"Cita de Carlos Yahir anulada por conflicto de jornada. Requiere reubicación urgente"*.
2. Registro del incidente en el log de auditoría del sistema.

#### 13.9 Qué módulos consumen ese estado
- **Bandeja de Reprogramación Prioritaria:** Añade la cita a una cola especial de pacientes que deben ser reubicados con prioridad máxima.

#### 13.10 Qué ocurre después de ese estado
La cita pasa a la cola de reprogramaciones prioritarias y se mantiene difuminada con un color distintivo hasta que la recepcionista le asigna un nuevo bloque válido.

#### 13.11 Casos prácticos
- El Dr. Jiménez avisa que debe asistir a un congreso de ortodoncia de imprevisto el martes de 12:00 a 14:00. Al ingresar el administrador este bloqueo de jornada en el panel, el sistema cancela automáticamente la cita de Daniel Hidalgo que estaba a las 12:00, marcándola como "Cancelado por sesiones en conflicto".

#### 13.12 Posibles reglas de negocio
- El sistema debe bloquear inmediatamente la confirmación automática por WhatsApp de cualquier cita en estado `CANCELLED_CONFLICT` para evitar malos entendidos con el paciente.

---

### Estado 14: Cambio de fecha (`RESCHEDULED`)

#### 14.1 Definición
Estado transitorio de una cita que ha sido movida de su bloque horario original a uno nuevo (reagendada), manteniendo el histórico de la cita primigenia para análisis de trazabilidad.

#### 14.2 Objetivo
Mantener el hilo conductor del paciente y medir la volatilidad de la agenda (cuántas veces se mueve una cita antes de concretarse).

#### 14.3 Cómo llega una cita a ese estado
El paciente solicita mover su cita del martes para el jueves. La recepcionista utiliza la función "Reagendar" (arrastrar y soltar en la interfaz o a través de la herramienta de reprogramación).

#### 14.4 Qué evento dispara el cambio
- Acción en frontend: `APPOINTMENT_RESCHEDULED`
- Endpoint: `/api/v1/appointments/:id/reschedule`

#### 14.5 Qué usuario puede cambiarlo
- **Recepcionista / Administrador:** A petición del paciente.
- **Paciente:** Vía link de autogestión de cita si la clínica lo tiene configurado.

#### 14.6 Qué módulo interviene
- Módulo de Agenda Clínica.
- Motor de Historial Clínico.

#### 14.7 Qué información se registra
- Fecha y hora originales.
- Nuevas coordenadas de agenda (sucursal, sillón, profesional, hora).
- Motivo del cambio.
- Contador incremental de reagendamientos (`reschedule_count`).

#### 14.8 Qué acciones automáticas ejecuta el sistema
1. Creación de una nueva cita con estado `SCHEDULED` en las coordenadas de destino.
2. Cambio de estado de la cita original a `RESCHEDULED`.
3. Copia de notas y diagnósticos previos a la nueva cita.
4. Envío de la confirmación horaria por email con el nuevo bloque de tiempo.

#### 14.9 Qué módulos consumen ese estado
- **Módulo de Reportes de Retención:** Monitorea la tasa de reprogramación.

#### 14.10 Qué ocurre después de ese estado
La cita de origen queda archivada en estado `RESCHEDULED` (inactiva), y la nueva cita activa sigue el ciclo de vida ordinario en su nuevo horario.

#### 14.11 Casos prácticos
- Ariadna Elizabeth tiene cita a las 12:20 pero llama para decir que llegará tarde y pide que la muevan a las 15:00 del mismo día. La recepcionista arrastra la cita a las 15:00. La cita de las 12:20 queda en el registro como "Cambio de fecha" y la de las 15:00 aparece como activa.

#### 14.12 Posibles reglas de negocio
- No se permite reagendar una cita más de 3 veces sin cobro de un recargo administrativo o requerir la aprobación del Gerente de la sucursal.

---

### Estado 15: Paciente deshabilitado (`DISABLED_PATIENT`)

#### 15.1 Definición
Estado administrativo y de consistencia lógica. Se aplica a citas vigentes en la agenda cuando el paciente asociado es dado de baja, suspendido o deshabilitado del sistema ERP por motivos administrativos (ej. fraude, mal comportamiento, mora severa o fallecimiento).

#### 15.2 Objetivo
Prevenir la prestación de servicios médicos a personas no autorizadas y alertar de inmediato al personal clínico y administrativo si un paciente bloqueado intenta ingresar a consulta.

#### 15.3 Cómo llega una cita a ese estado
Un administrador desactiva o marca como "Inactivo" a un paciente en el módulo de pacientes. Automáticamente, el sistema recorre todas sus citas futuras y les asigna este estado especial.

#### 15.4 Qué evento dispara el cambio
- Evento de Entidad: `PATIENT_DISABLED`
- Trigger de Base de Datos / Evento de Dominio.

#### 15.5 Qué usuario puede cambiarlo
- **Administrador del Sistema:** Único rol con capacidad de deshabilitar/habilitar perfiles de pacientes globales.

#### 15.6 Qué módulo interviene
- Módulo de Gestión de Pacientes.
- Módulo de Seguridad y Auditoría.

#### 15.7 Qué información se registra
- ID del administrador que deshabilita al paciente.
- Justificación administrativa de la baja del paciente (información altamente confidencial).
- Timestamp de la inhabilitación.

#### 15.8 Qué acciones automáticas ejecuta el sistema
1. Cancelación inmediata de todos los envíos de notificaciones por WhatsApp/Email pendientes para este paciente.
2. Marcado visual especial en la agenda clínica con el color hexadecimal correspondiente.
3. Bloqueo de la ficha clínica electrónica para nuevas entradas.

#### 15.9 Qué módulos consumen ese estado
- **Punto de Admisión / Recepción:** Muestra alerta roja en pantalla: *"Paciente Bloqueado. No se puede admitir"*.
- **Módulo de Facturación:** Bloquea la emisión de presupuestos.

#### 15.10 Qué ocurre después de ese estado
La cita no puede ser procesada clínicamente. Debe ser eliminada formalmente o el paciente debe ser regularizado administrativamente.

#### 15.11 Casos prácticos
- La gerencia de la clínica marca a un paciente como "Moroso Crónico Incobrable" y lo deshabilita. Automáticamente, su cita programada para el próximo jueves cambia de estado a "Paciente deshabilitado". Cuando la recepcionista abre su agenda, visualiza la alerta y procede a cancelar la cita para reasignar el bloque a la lista de espera.

#### 15.12 Posibles reglas de negocio
- Es estrictamente prohibido mover una cita en estado `DISABLED_PATIENT` a `WAITING_ROOM` or `IN_PROGRESS` sin revertir primero el estado de inhabilitación del paciente en su ficha maestra.

---

### Estado 16: Anulado por reprogramación (`CANCELLED_RESCHEDULED`)

#### 16.1 Definición
Es la confirmación formal del descarte del bloque de tiempo original tras haberse completado la reprogramación física de la cita a un nuevo bloque de tiempo.

#### 16.2 Objetivo
Diferenciar las citas canceladas definitivamente (donde la clínica pierde la venta/atención) de aquellas que simplemente se movieron de fecha (donde se conserva la intención de compra pero varía la distribución temporal).

#### 16.3 Cómo llega una cita a ese estado
Se asigna de forma automatizada por el sistema inmediatamente después de que una cita en estado `RESCHEDULED` es confirmada en su nueva fecha y hora de destino.

#### 16.4 Qué evento dispara el cambio
- Evento de transacción: `RESCHEDULE_TRANSACTION_COMMITTED`

#### 16.5 Qué usuario puede cambiarlo
- **Sistema:** Proceso transaccional automático.

#### 16.6 Qué módulo interviene
- Motor transaccional de la agenda.

#### 16.7 Qué información se registra
- ID de la nueva cita creada de destino (`target_appointment_id`).
- Timestamp del cierre de la reprogramación.

#### 16.8 Qué acciones automáticas ejecuta el sistema
1. Liberación total del inventario de horas del bloque de origen.
2. Consolidación de reportes de eficiencia operativa mensual.

#### 16.9 Qué módulos consumen ese estado
- **Módulo de Finanzas:** Calcula el flujo prpyectado de caja según citas efectivas programadas vs anuladas.

#### 16.10 Qué ocurre después de ese estado
La cita de origen queda archivada con este estado de forma permanente para auditoría transaccional.

#### 16.11 Casos prácticos
- Una recepcionista mueve la cita de Don Juan del lunes al viernes. En el momento en que hace clic en "Confirmar cambio de fecha", la cita del lunes se marca como "Anulado por reprogramación" de forma automática.

#### 16.12 Posibles reglas de negocio
- Las citas en estado `CANCELLED_RESCHEDULED` no pueden ser reactivadas directamente; si se desea volver al horario anterior, se debe crear un nuevo registro de cita en la base de datos.

---

## 4. Arquitectura y Lógica del Panel de Filtros Visuales

### 4.1 Principio de No Alteración del Estado
El panel lateral de colores funciona estrictamente como una capa de **proyección y filtrado en el cliente (Frontend-Only Filter)**. 
- Marcar o desmarcar un checkbox de color **bajo ninguna circunstancia** modifica el atributo `status` de una cita en la base de datos.
- Las citas cuyo color se desmarca **no se eliminan ni sufren borrado lógico (soft delete)**; únicamente se les aplica una regla CSS de visibilidad (`display: none` o exclusión del array de renderizado en React) en la interfaz gráfica del usuario activo.

### 4.2 Comportamiento de los Filtros y Casos de Uso

#### Caso 1: Checkbox Marcado (Checked)
- La cita con el estado correspondiente se renderiza en la grilla horaria.
- Si el usuario tiene todas las citas visualizándose y desmarca un estado, la grilla se actualiza reactivamente ocultando el elemento.

#### Caso 2: Checkbox Desmarcado (Unchecked)
- La cita se excluye del árbol de renderizado del DOM.
- El espacio ocupado por la cita en la vista de calendario se muestra como "libre de forma visual" (pero bloqueado para inserción de nuevas citas en ese mismo rango, manteniendo la restricción de doble agenda activa).

#### Caso 3: "Marcar Todos" (Select All)
- Setea recursivamente todos los estados a `true` en el array de filtros del cliente.
- Vuelve a mostrar la agenda en su totalidad.

#### Caso 4: Ningún Filtro Seleccionado
- La grilla de la agenda se muestra vacía de citas. El sistema despliega un banner informativo: *"No se muestran citas. Selecciona al menos un filtro de estado en el panel izquierdo para comenzar"*. No produce errores de carga.

### 4.3 Flujo Operativo en la Clínica

- **Perspectiva de la Recepcionista:** Utiliza el panel para limpiar el ruido visual. Si es un día congestionado, desmarca los estados "Atendido", "Cancelado" y "No asistió" para concentrarse exclusivamente en los pacientes que están "En sala de espera", "Atendiéndose" o "Por confirmar".
- **Perspectiva del Administrador / Gerente:** Desmarca todos los estados clínicos y deja únicamente activos los estados "Cancelado", "Cancelado por sesiones en conflicto" y "No asistió" para auditar las fugas de ingresos y la productividad de los doctores en el día.

---

## 5. Diseño del Motor Técnico del Panel (Propuesta de Ingeniería)

### 5.1 Estructura de la Base de Datos (PostgreSQL / MySQL)

Para soportar de manera eficiente la trazabilidad y las transiciones del workflow de citas, se propone el siguiente diseño relacional normalizado:

```sql
-- Tabla principal de Citas
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    patient_id UUID REFERENCES patients(id),
    professional_id UUID NOT NULL,
    chair_id UUID NOT NULL,
    title VARCHAR(150) NOT NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT NOT NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Trazabilidad e Historial de Estados (Auditoría)
CREATE TABLE appointment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by_id UUID NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices optimizados para búsquedas rápidas en agenda
CREATE INDEX idx_appointments_date_branch ON appointments (start_at, branch_id);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_status_history_appointment ON appointment_status_history (appointment_id);
```

### 5.2 Lógica SQL de Consulta Multiestado

Cuando el usuario selecciona una combinación de checkboxes en el panel izquierdo, el frontend envía un array de estados al backend. La consulta SQL ejecutada debe estructurarse con la cláusula `IN` sobre el índice de estados:

```sql
SELECT 
    a.id,
    a.title,
    a.status,
    a.start_at,
    a.end_at,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    dr.first_name AS doctor_first_name,
    dr.last_name AS doctor_last_name,
    c.name AS chair_name
FROM appointments a
INNER JOIN patients p ON a.patient_id = p.id
INNER JOIN professionals dr ON a.professional_id = dr.id
INNER JOIN chairs c ON a.chair_id = c.id
WHERE a.branch_id = 'c38a1656-78e2-45e0-b6f2-bf1c19b0b467'
  AND a.start_at >= '2026-06-30 00:00:00+00'
  AND a.start_at <= '2026-06-30 23:59:59+00'
  AND a.status IN ('SCHEDULED', 'CONFIRMED_BY_WHATSAPP', 'WAITING_ROOM', 'IN_PROGRESS')
ORDER BY a.start_at ASC;
```

### 5.3 Persistencia de Filtros de Sesión (Frontend)

Para garantizar la experiencia de usuario (UX), los filtros seleccionados por la recepcionista no deben perderse al recargar la página o al navegar a otros módulos. Se propone el uso de `localStorage` mediante un Hook personalizado en React / TypeScript:

```typescript
import { useState, useEffect } from "react";
import type { AppointmentStatus } from "../services/appointments.service";

const FILTER_STORAGE_KEY = "dentalink_agenda_status_filters";

const DEFAULT_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "CONFIRMED_BY_WHATSAPP",
  "CONFIRMED_BY_PHONE",
  "CONFIRMED_BY_EMAIL",
  "PENDING_CONFIRMATION",
  "NOTIFIED_BY_WHATSAPP",
  "NOTIFIED_BY_EMAIL",
  "ARRIVED",
  "WAITING_ROOM",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "CANCELLED_CONFLICT",
  "CANCELLED_RESCHEDULED",
  "RESCHEDULED",
  "BLOCKED"
];

export function useAgendaStatusFilters() {
  const [selectedStatuses, setSelectedStatuses] = useState<AppointmentStatus[]>(() => {
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_STATUSES;
    } catch {
      return DEFAULT_STATUSES;
    }
  });

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(selectedStatuses));
  }, [selectedStatuses]);

  const toggleStatus = (status: AppointmentStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const selectAll = () => setSelectedStatuses(DEFAULT_STATUSES);
  const selectNone = () => setSelectedStatuses([]);

  return {
    selectedStatuses,
    toggleStatus,
    selectAll,
    selectNone,
    isAllSelected: selectedStatuses.length === DEFAULT_STATUSES.length
  };
}
```

---

## 6. Mapeo de Colores del Panel de Filtros (Aproximación HEX)

A partir del análisis cromático de la interfaz del sistema Dentalink, se ha construido la siguiente paleta de diseño para los estados y bordes visuales:

| Nombre del Estado | Color de Fondo (Aprox) | Borde Izquierdo HEX | Uso Visual |
| :--- | :--- | :--- | :--- |
| **Notificado por WhatsApp** | `#EBF5FB` (Celeste claro) | `#00A2E8` | Informativo (Proceso) |
| **Confirmado por WhatsApp** | `#E8F8F5` (Verde claro) | `#1ABC9C` | Confirmación automática |
| **No confirmado / Por confirmar**| `#FEF9E7` (Amarillo claro)| `#F1C40F` | Alerta moderada |
| **Agenda Online** | `#F5EEF8` (Púrpura claro) | `#8E44AD` | Canal externo |
| **Notificado vía Email** | `#EBF5FB` (Celeste claro) | `#5DADE2` | Informativo (Secundario) |
| **Confirmado por teléfono** | `#EBF5FB` (Azul/Celeste) | `#2980B9` | Confirmación manual |
| **Confirmado por email** | `#EBF5FB` (Celeste oscuro) | `#3498DB` | Confirmación automática |
| **En sala de espera** | `#EAF2F8` (Azul rey claro) | `#2471A3` | Presencial (Operación) |
| **Atendiéndose** | `#E8F8F5` (Verde agua) | `#2ECC71` | Box Ocupado (Clínico) |
| **Atendido** | `#E8F8F5` (Verde fuerte) | `#27AE60` | Operación Concluida |
| **No asistió (No show)** | `#FDEDEC` (Rojo claro) | `#E74C3C` | Ausentismo |
| **Notificado por Bot Cero** | `#EBF5FB` (Celeste) | `#2E86C1` | Bot automatizado |
| **Confirmado por Bot Cero** | `#E8F8F5` (Verde agua) | `#17A589` | Confirmación bot |
| **Anulado por Bot Cero** | `#FDEDEC` (Rojo) | `#CB4335` | Anulación bot |
| **Confirmado por WhatsApp** | `#E8F8F5` (Verde) | `#16A085` | Confirmación canal digital |
| **Cancelado** | `#FADBD8` (Rojo suave) | `#C0392B` | Pérdida de cita |
| **Cancelado por conflicto** | `#FDEDEC` (Rojo/Rosa) | `#CD6155` | Colisión de agenda |
| **Cambio de fecha** | `#E8F8F5` (Turquesa claro) | `#117A65` | Reprogramación |
| **Paciente deshabilitado** | `#F5CBA7` (Naranja suave) | `#E67E22` | Bloqueo administrativo |
| **Anulado por reprogramación** | `#EAEDED` (Gris claro) | `#7F8C8D` | Cierre transaccional |
