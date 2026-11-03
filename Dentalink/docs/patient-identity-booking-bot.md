# Contrato de identidad para el bot de agendamiento

## Invariante de seguridad

El teléfono identifica un `contact_point`, nunca un paciente. Una cita solo puede crearse cuando la sesión conserva `status=SELECTED` y `selectedPatientId` sigue vigente. Durante una conversación activa no se vuelve a resolver el paciente por teléfono.

Cada integrante familiar conserva su propio `patientId` y expediente. El actor que agenda, el paciente seleccionado y el canal se registran de forma independiente en `AppointmentBookingActor`:

```text
appointment.patientId                 = paciente seleccionado
appointment.bookingActor.actorPatientId = responsable que agendó
appointment.bookingActor.familyGroupId  = grupo familiar
appointment.bookingActor.contactPointId = teléfono verificado
appointment.bookingActor.bookingSource  = WHATSAPP u otro canal
```

El backend deriva estos campos desde la sesión. No acepta un actor enviado por el cliente al reservar.

## Autenticación e idempotencia

Todas las llamadas del bot usan:

```http
x-booking-bot-key: <BOOKING_BOT_API_KEY>
x-organization-id: <organization-id>
correlation-id: <uuid>
```

La creación de sesión también envía `organizationId` en el cuerpo. La reserva exige un `idempotency-key` estable por intento lógico; el mismo webhook no debe crear dos citas.

## Flujo WhatsApp `FAMILY_SHARED`

1. Crear o recuperar sesión con `POST /api/v1/integrations/booking-identity/sessions`.
2. Confirmar el control del canal con una sesión de WhatsApp validada por el proveedor u OTP.
3. Si la verificación no se incluyó en el webhook firmado, llamar `POST /sessions/:id/verify-contact`.
4. Cuando `resolution=FAMILY_SHARED`, usar exclusivamente `candidates` devueltos por la API.
5. Preguntar exactamente: **“¿Para quién deseas agendar?”**
6. Mostrar solo `displayName`, `relationship` y `ageReference`.
7. Seleccionar con `POST /sessions/:id/select-patient`.
8. Conservar el mismo `sessionId`; toda disponibilidad, confirmación y reserva usa su `selectedPatientId`.
9. Reservar con `POST /sessions/:id/appointments`.

## Crear o recuperar sesión

```json
{
  "organizationId": "org-id",
  "source": "WHATSAPP",
  "phone": "+529612222222",
  "country": "MX",
  "conversationId": "wa-conversation-id",
  "channelMessageId": "wamid",
  "channelVerified": true,
  "verificationMethod": "WHATSAPP_SESSION",
  "providerEventId": "wamid"
}
```

`channelVerified=true` solo se usa después de validar la firma/sesión del proveedor. Si no existe esa evidencia, omitirlo; la API responderá `CONTACT_VERIFICATION_REQUIRED` sin consultar ni exponer candidatos.

Resoluciones relevantes:

- `CONTACT_VERIFICATION_REQUIRED`: no hay candidatos visibles.
- `NO_MATCH`: no hay ficha vinculada.
- `SINGLE_CONTACT_MATCH`: requiere verificación inequívoca de identidad.
- `SINGLE_VERIFIED_MATCH`: candidato individual verificado; aun requiere selección explícita.
- `FAMILY_SHARED`: grupo activo y candidatos autorizados.
- `AMBIGUOUS`: duplicados sin grupo familiar común o resolución no inequívoca; flujo bloqueado.
- `MANUAL_REVIEW_REQUIRED`: verificación individual fallida o insuficiente.

Repetir `source + conversationId` devuelve la sesión existente. Si el teléfono cambia, la API rechaza la solicitud. No se reordena ni se selecciona el primer resultado.

## Crear una familia nueva desde WhatsApp

Este flujo se usa cuando el usuario dice que la cita es para varias personas, para sus hijos o para su familia. No reemplaza el flujo individual: solo se activa por intención familiar explícita.

1. Crear o recuperar sesión.
2. Verificar el teléfono de WhatsApp.
3. Capturar responsable adulto: nombre, apellidos y fecha de nacimiento.
4. Buscar coincidencias del responsable; reutilizar ficha solo con selección explícita.
5. Capturar integrantes: nombre, apellidos, nacimiento, relación y si son menores.
6. Crear grupo, responsable e integrantes con `POST /sessions/:id/create-family`.
7. Mostrar candidatos y preguntar: **"¿Para quién deseas agendar?"**
8. Seleccionar integrante y crear una cita individual por cada persona.

```http
POST /api/v1/integrations/booking-identity/sessions/:id/create-family
idempotency-key: <clave-estable-del-webhook>
```

```json
{
  "branchId": "branch-id",
  "groupName": "Familia Lopez",
  "responsible": {
    "firstName": "Maria",
    "lastName": "Lopez",
    "birthDate": "1992-04-10"
  },
  "members": [
    {
      "firstName": "Mateo",
      "lastName": "Lopez",
      "birthDate": "2017-01-20",
      "relationship": "Hijo"
    },
    {
      "firstName": "Sofia",
      "lastName": "Lopez",
      "birthDate": "2019-09-08",
      "relationship": "Hija"
    }
  ]
}
```

Los hijos nuevos se crean como pacientes independientes con `patientId` propio. El teléfono no se copia como `Patient.phone` del menor; queda vinculado mediante `patient_contact_links` con `role=SHARED_FAMILY`. El responsable puede conservar el teléfono como dato personal porque es el actor real del canal.

## Verificar contacto

```http
POST /api/v1/integrations/booking-identity/sessions/:id/verify-contact
```

```json
{
  "verified": true,
  "method": "OTP",
  "provider": "whatsapp-provider",
  "providerEventId": "verification-event-id"
}
```

Los métodos admitidos son `WHATSAPP_SESSION`, `OTP` y `PROVIDER_CALLBACK`. `providerEventId` hace idempotente el registro de verificación.

## Selección y cambio de paciente

```http
POST /api/v1/integrations/booking-identity/sessions/:id/select-patient
```

```json
{
  "patientId": "MATEO_ID",
  "resolutionMethod": "EXPLICIT_SELECTION"
}
```

La API vuelve a comprobar membresía, consentimiento y `canBook`. Cambiar de integrante actualiza `selectedPatientId` y genera auditoría `change_selected_patient`; no ejecuta una nueva búsqueda por teléfono. La selección expira a los 15 minutos o al expirar la sesión, lo que ocurra primero.

## Opción “Otro familiar”

Antes de crear una ficha, buscar coincidencia exacta:

```http
POST /api/v1/integrations/booking-identity/sessions/:id/family-members/lookup
```

```json
{
  "branchId": "branch-id",
  "firstName": "Mateo",
  "lastName": "Chanona",
  "birthDate": "2015-01-01"
}
```

Si `MATCHES_FOUND`, el bot debe pedir selección; incluso dos personas con el mismo nombre se distinguen por `patientId` y referencia de edad. Solo cuando la respuesta sea `NO_MATCH` se llama:

```http
POST /api/v1/integrations/booking-identity/sessions/:id/family-members
```

```json
{
  "branchId": "branch-id",
  "firstName": "Mateo",
  "lastName": "Chanona",
  "birthDate": "2015-01-01",
  "relationship": "Hijo"
}
```

Un menor queda vinculado al tutor autorizado. Un adulto nuevo queda `CONSENT_REQUIRED` y no puede seleccionarse ni agendarse hasta registrar consentimiento explícito y conceder `canBook`. Aceptar el consentimiento no reactiva por sí solo permisos previamente deshabilitados. Solo responsables con rol `GROUP_OWNER`, `GROUP_MANAGER` o `GUARDIAN` pueden usar este flujo.

El mismo endpoint acepta `idempotency-key`. En un reintento del mismo webhook, la API devuelve la respuesta persistida en vez de crear otro hijo.

## Permisos familiares

La API persiste permisos separados por grupo, teléfono actor y paciente:

| Regla de negocio                 | Campo persistido              |
| -------------------------------- | ----------------------------- |
| `can_book_appointments`          | `canBook`                     |
| `can_reschedule_appointments`    | `canReschedule`               |
| `can_cancel_appointments`        | `canCancel`                   |
| `can_receive_reminders`          | `canReceiveReminders`         |
| `can_view_appointment_summary`   | `canViewAppointmentSummary`   |
| `can_view_financial_information` | `canViewFinancialInformation` |
| `can_view_clinical_information`  | `canViewClinicalInformation`  |
| `can_sign_consents`              | `canSignConsents`             |

Compartir teléfono no activa permisos clínicos, financieros ni de firma. El resolver del bot solo devuelve integrantes con consentimiento aceptado y `canBook=true`.

## Ambigüedad y privacidad

Si hay varios pacientes con el mismo contacto pero sin un único grupo familiar común:

- la sesión queda `status=AMBIGUOUS` y `resolution=AMBIGUOUS`;
- `candidates=[]` y no se muestran nombres, historial ni existencia de otras fichas;
- selección, alta familiar y reserva quedan bloqueadas;
- se crea una `BookingIdentityIncident` abierta con `privacyMode=true`;
- recepción debe verificar y resolver manualmente.

La posesión del teléfono no concede acceso a diagnósticos, tratamientos, documentos, saldos ni citas previas. Los contactos de emergencia no participan en la resolución.

## Alta administrativa de pacientes

Crear o editar una ficha ordinaria con un teléfono ya activo devuelve conflicto `PHONE_REQUIRES_FAMILY_GROUP`. La reutilización solo se permite mediante un grupo familiar activo y enlaces `SHARED_FAMILY`; no mediante el formulario general.

## Reserva

```http
POST /api/v1/integrations/booking-identity/sessions/:id/appointments
idempotency-key: <clave-estable>
```

El cuerpo solo contiene datos de agenda. No contiene `patientId`, `bookingActorPatientId`, `familyGroupId` ni `contactPointId`; el backend los obtiene de la sesión seleccionada y verificada.
