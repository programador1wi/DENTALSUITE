# Analisis: Pestana de Configuracion del Modulo de Pacientes

> Fecha: 2026-08-05
> Autor: Antigravity (analisis automatizado)
> Objetivo: Determinar si los toggles de la pestana de Configuracion en Pacientes realmente controlan los 4 flujos que declara la UI.

---

## Veredicto

La pestana de configuracion **es mayormente decorativa**. De los 4 flujos que promete controlar, **solo 1 funciona**. Los otros 3 ignoran completamente la configuracion. Ademas, los datos se guardan en `localStorage` del navegador, no en el servidor.

---

## 1. Diagnostico Raiz

El problema no es de UI sino de **arquitectura incompleta**. Se construyo un sistema de configuracion sofisticado en `apps/web/src/features/patients/config/patient-field-settings.ts` con tipos, defaults por contexto, normalizacion y hooks reactivos. Pero solo se consumio en un formulario. Los otros 3 formularios fueron desarrollados de forma independiente con campos hardcodeados, y nadie conecto la configuracion con ellos. El backend no participa en absoluto de esta feature.

---

## 2. Estado Real por Flujo

| Flujo | Columna en la tabla | Funciona | Archivo responsable | Evidencia |
|-------|:---:|:---:|---|---|
| **En Seccion de Nuevo Paciente** | 1ra columna | **SI** | `apps/web/src/features/patients/pages/patient-new-page.tsx` (L58-60) | Usa `usePatientFieldContext("newPatient")`, `getVisibleFormFields`, `getRequiredFormFields` |
| **Al Crear Paciente Agendando** | 2da columna | **NO** | `apps/web/src/features/agenda/components/appointment-modal.tsx` (L76-84) | Define `NewPatientState` hardcodeado. No importa la config |
| **En Seccion de Agenda Online** | 3ra columna | **NO** | `apps/web/src/features/public-booking/pages/public-booking-page.tsx` | Campos con `required` estatico en JSX. No consulta la config |
| **Al Enviar Check In** | 4ta columna | **NO** | `apps/web/src/features/public-booking/pages/complete-patient-profile-page.tsx` | Schema Zod estatico sin dinamismo |

---

## 3. Como Funciona el Unico Flujo Que Si Conecta

En `apps/web/src/features/patients/pages/patient-new-page.tsx`, la integracion es correcta y completa:

```typescript
// L58-60: Lee la configuracion del contexto "newPatient"
const patientFieldConfig = usePatientFieldContext("newPatient");
const visibleFields = useMemo(() => getVisibleFormFields(patientFieldConfig), [patientFieldConfig]);
const requiredFields = useMemo(() => getRequiredFormFields(patientFieldConfig), [patientFieldConfig]);

// L61-67: Genera schema de validacion dinamico
const formSchema = useMemo(() => {
  const messages: Partial<Record<keyof PatientFormValues, string>> = {};
  requiredFields.forEach((field) => {
    messages[field] = `${fieldLabel(field)} requerido`;
  });
  return createPatientFormSchema(messages);
}, [requiredFields]);
```

Y en el renderizado, cada campo respeta la config:

```tsx
// L203-207: Campo condicionalmente visible
{visibleFields.has("birthDate") ? (
  <Field label="Fecha nacimiento" required={requiredFields.has("birthDate")}>
    <Input type="date" {...form.register("birthDate")} />
  </Field>
) : null}
```

Tambien resetea los valores de campos ocultos (L89-97) para evitar enviar datos de campos que el usuario no puede ver.

---

## 4. Problema Critico de Persistencia

**La configuracion se guarda en `localStorage`, NO en el servidor.**

```typescript
// patient-field-settings.ts L268-272
export function writePatientFieldSettings(settings: PatientFieldSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PATIENT_FIELD_SETTINGS_KEY,
    JSON.stringify(normalizePatientFieldSettings(settings))
  );
  window.dispatchEvent(new Event("patient-field-settings-change"));
}
```

### Consecuencias:

- Si el admin configura desde su computadora, **nadie mas ve esos cambios**
- Si cambia de navegador o limpia cache, **la configuracion se pierde**
- No hay modelo `PatientFieldConfig` en el schema Prisma
- No hay endpoints en el API para guardar/leer esta configuracion
- No hay seed data en el backend
- El boton "Guardar" solo persiste en `localStorage` del navegador actual

---

## 5. Por Que Los Otros 3 Flujos No Funcionan

### Flujo 2: Al Crear Paciente Agendando

`apps/web/src/features/agenda/components/appointment-modal.tsx` define su propio tipo con campos fijos:

```typescript
// L76-84: Tipo estatico, sin conexion a la config
type NewPatientState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentNumber: string;
  type: string;
  comment: string;
};
```

No importa `usePatientFieldContext`, `getVisibleFormFields`, ni nada de `patient-field-settings`.

### Flujo 3: Agenda Online

`apps/web/src/features/public-booking/pages/public-booking-page.tsx` renderiza campos con `required` estatico directamente en JSX. No consulta la configuracion.

### Flujo 4: Check In

`apps/web/src/features/public-booking/pages/complete-patient-profile-page.tsx` usa un schema Zod hardcodeado:

```typescript
const formSchema = z.object({
  firstName: z.string().min(2, "El nombre es requerido"),
  lastName: z.string().min(2, "El apellido es requerido"),
  email: z.string().email("Correo invalido").or(z.literal("").or(z.undefined())),
  phone: z.string().optional(),
  // ... demas campos estaticos
});
```

---

## 6. Archivos Clave del Sistema de Configuracion

| Archivo | Rol |
|---------|-----|
| `apps/web/src/features/patients/config/patient-field-settings.ts` | Tipos, defaults, read/write localStorage, hooks `usePatientFieldSettings`, `usePatientFieldContext`, funciones `getVisibleFormFields`, `getRequiredFormFields` |
| `apps/web/src/features/patients/pages/patients-configuration-page.tsx` | UI de la tabla de checkboxes (la pestana que ves) |
| `apps/web/src/features/patients/pages/patient-new-page.tsx` | UNICO formulario que consume la config |
| `apps/web/src/features/agenda/components/appointment-modal.tsx` | Formulario de paciente rapido al agendar (NO consume config) |
| `apps/web/src/features/public-booking/pages/public-booking-page.tsx` | Formulario de agenda online (NO consume config) |
| `apps/web/src/features/public-booking/pages/complete-patient-profile-page.tsx` | Formulario de check-in (NO consume config) |
| `apps/web/src/lib/validations/patient.ts` | Schema Zod `createPatientFormSchema` usado por el flujo de nuevo paciente |

---

## 7. Modelo de Datos Actual

```typescript
// patient-field-settings.ts

// Los 4 contextos (columnas de la tabla)
type PatientFieldContext = "newPatient" | "appointment" | "onlineAgenda" | "checkIn";

// Cada celda de la tabla
type PatientFieldPermission = {
  present: boolean;   // Columna "PRESENTE"
  required: boolean;  // Columna "REQUERIDO"
};

// Estructura completa: contexto -> fieldId -> permisos
type PatientFieldSettings = Record<PatientFieldContext, Record<string, PatientFieldPermission>>;
```

### Field IDs definidos (21 campos):

| Field ID | Label | formFields mapeados | isSystemRequired |
|----------|-------|---------------------|:---:|
| `legalName` | Nombre legal | `firstName` | SI |
| `socialName` | Nombre social | — | NO |
| `lastName` | Apellidos | `lastName` | SI |
| `curp` | CURP/RFC | `documentType`, `documentNumber` | NO |
| `email` | Email | `email` | NO |
| `agreement` | Convenio | — | NO |
| `internalNumber` | Numero interno | — | NO |
| `sex` | Sexo | — | NO |
| `gender` | Genero | `gender` | NO |
| `birthDate` | Fecha nacimiento | `birthDate` | NO |
| `city` | Ciudad | `addressCity` | NO |
| `delegation` | Delegacion | `addressState` | NO |
| `address` | Direccion | `addressStreet` | NO |
| `fixedPhone` | Telefono fijo | `alternatePhone` | NO |
| `mobilePhone` | Telefono movil | `phone` | NO |
| `profession` | Actividad o profesion | `occupation` | NO |
| `employer` | Empleador | — | NO |
| `observations` | Observaciones | — | NO |
| `guardian` | Apoderado | `emergencyName`, `emergencyRelationship`, `emergencyPhone`, `emergencyEmail` | NO |
| `reference` | Referencia | `referredBy` | NO |
| `type` | Tipo | `status` | NO |
| `guardianCurp` | CURP/RFC Tutor legal | — | NO |
| `socialNameSecondary` | Nombre social tutor | — | NO |
| `genderSecondary` | Genero tutor | — | NO |

> **Nota**: Los campos con `formFields` vacio (—) no tienen mapeo a campos del formulario, lo que significa que activar/desactivar su visibilidad en la config no tiene efecto en ninguna parte del frontend, incluso en el flujo de Nuevo Paciente.

---

## 8. Resumen Ejecutivo

| Aspecto | Estado |
|---------|--------|
| UI de configuracion | Bien construida, con tooltips y candados en campos de sistema |
| Guardado en DB/API | NO existe. Solo `localStorage` |
| Flujo Nuevo Paciente | Funcional (visibilidad + requerido + validacion dinamica) |
| Flujo Agendando | NO conectado (hardcoded) |
| Flujo Agenda Online | NO conectado (hardcoded) |
| Flujo Check In | NO conectado (hardcoded) |
| Validacion backend | NO existe. DTOs estaticos con `class-validator` |
| Config compartida entre usuarios | NO. Cada navegador tiene su propia copia |
| Campos sin formFields mapeados | 7 de 21 campos no afectan ningun formulario |

---

## 9. Plan de Implementacion Requerido

Para que la configuracion sea funcional en los 4 flujos:

### Fase 1: Backend (Persistencia)

1. Crear modelo Prisma `PatientFieldConfig` con campos por contexto y clinica
2. Crear endpoints CRUD: `GET /patient-field-config/clinic/:id` y `PUT /patient-field-config/clinic/:id`
3. Crear seed con defaults por clinica
4. Implementar validacion dinamica en los DTOs de creacion de paciente segun el flujo

### Fase 2: Frontend — Migrar persistencia

5. Reemplazar `localStorage` por llamadas API en `usePatientFieldSettings`
6. Invalidar cache con React Query al guardar

### Fase 3: Frontend — Conectar flujos faltantes

7. **Flujo 2 (Agendando)**: Refactorizar `appointment-modal.tsx` para consumir `usePatientFieldContext("appointment")`
8. **Flujo 3 (Agenda Online)**: Refactorizar `public-booking-page.tsx` para consumir `usePatientFieldContext("onlineAgenda")`
9. **Flujo 4 (Check In)**: Refactorizar `complete-patient-profile-page.tsx` para consumir `usePatientFieldContext("checkIn")`

### Fase 4: Campos sin mapeo

10. Mapear los 7 campos sin `formFields` a campos reales de los formularios, o eliminarlos de la tabla de configuracion si no aplican

### Verificacion

- Test E2E: Activar/desactivar cada campo en cada flujo y verificar que el formulario refleja el cambio
- Test de persistencia: Guardar config, abrir en otro navegador, verificar que se carga igual
- Test de backend: Enviar POST sin campo requerido segun la config y verificar que el API rechaza

---

## 10. Archivos a Modificar (Mapa de Impacto)

```
BACKEND:
  packages/database/prisma/schema.prisma          → Agregar modelo PatientFieldConfig
  packages/database/prisma/seeds/                  → Agregar seed de configuracion por clinica
  apps/api/src/modules/patient-field-config/       → Nuevo modulo: controller, service, DTOs
  apps/api/src/modules/patients/dto/               → Validacion dinamica en CreatePatientDto

FRONTEND:
  apps/web/src/features/patients/config/patient-field-settings.ts
    → Migrar de localStorage a API calls

  apps/web/src/features/agenda/components/appointment-modal.tsx
    → Consumir usePatientFieldContext("appointment")

  apps/web/src/features/public-booking/pages/public-booking-page.tsx
    → Consumir usePatientFieldContext("onlineAgenda")

  apps/web/src/features/public-booking/pages/complete-patient-profile-page.tsx
    → Consumir usePatientFieldContext("checkIn")
```
