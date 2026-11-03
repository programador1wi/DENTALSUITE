# Plan de Implementacion: Configuracion de Campos de Pacientes Funcional

> Fecha: 2026-08-05
> Basado en: `docs/analisis-configuracion-pacientes.md`
> Objetivo: Hacer que la pestana de Configuracion del modulo de Pacientes controle realmente la visibilidad y obligatoriedad de campos en los 4 flujos.

---

## 1. Diagnostico Raiz

La pestana de Configuracion tiene una UI funcional pero su efecto real es minimo:
- **Solo 1 de 4 flujos** consume la configuracion (Nuevo Paciente)
- **3 formularios** (agendamiento, agenda online, check-in) tienen campos hardcodeados que ignoran la config
- La persistencia es **localStorage** del navegador (no servidor), por lo que la config se pierde al cambiar de dispositivo, no se comparte entre usuarios y no existe en el backend
- El backend usa **DTOs estaticos** con `class-validator` y no valida dinamicamente segun la config

---

## 2. Resumen Ejecutivo

**Que vamos a lograr:**
- Persistencia en base de datos por organizacion (no por navegador)
- Los 4 flujos respetaran la configuracion de visibilidad y campos requeridos
- Validacion dinamica en el backend segun flujo

**Que NO vamos a hacer (fuera de alcance):**
- Agregar nuevas columnas al modelo Patient de Prisma
- Cambiar la UI de la pestana de configuracion (ya funciona bien)
- Reescribir los formularios desde cero; solo envolver campos con logica condicional

---

## 3. Cambios Clave

### Fase 1: Backend — Modelo y Persistencia

#### [NEW] Modelo Prisma en `packages/database/prisma/schema.prisma`

Agregar al schema (seguir patron de `PatientIdentityConfig` que usa `organizationId`):

```prisma
model PatientFieldConfig {
  id        Int    @id @default(autoincrement())
  organizationId Int
  fieldKey  String

  newPatientPresent     Boolean @default(false)
  newPatientRequired    Boolean @default(false)
  appointmentPresent    Boolean @default(false)
  appointmentRequired   Boolean @default(false)
  onlineAgendaPresent   Boolean @default(false)
  onlineAgendaRequired  Boolean @default(false)
  checkInPresent        Boolean @default(false)
  checkInRequired       Boolean @default(false)

  isSystemRequired Boolean @default(false)
  sortOrder        Int     @default(0)

  organization Organization @relation(fields: [organizationId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, fieldKey])
  @@index([organizationId])
  @@map("patient_field_configs")
}
```

Agregar relacion inversa en modelo `Organization`:
```prisma
  patientFieldConfigs PatientFieldConfig[]
```

Los `fieldKey` deben coincidir con los `id` de `PATIENT_FIELD_DEFINITIONS` del frontend:
```
legalName, socialName, lastName, curp, email, agreement, internalNumber,
sex, gender, birthDate, city, delegation, address, fixedPhone, mobilePhone,
profession, employer, observations, guardian, reference, type,
guardianCurp, socialNameSecondary, genderSecondary
```

**Migracion:**
```bash
cd packages/database
npx prisma migrate dev --name add_patient_field_config
```

#### Defaults de los campos

| fieldKey | newPatient P/R | appointment P/R | onlineAgenda P/R | checkIn P/R | isSystemRequired |
|----------|:---:|:---:|:---:|:---:|:---:|
| legalName | T/T | T/T | T/T | T/T | SI |
| lastName | T/T | T/T | T/T | T/T | SI |
| email | F/F | T/T | T/T | T/T | NO |
| mobilePhone | T/T | T/T | T/T | T/T | NO |
| curp | F/F | F/F | F/F | T/T | NO |
| birthDate | F/F | F/F | F/F | T/T | NO |
| type | T/F | T/F | F/F | F/F | NO |
| *todos los demas* | F/F | F/F | F/F | F/F | NO |

---

### Fase 2: Backend — Modulo CRUD

Seguir el mismo patron que `patient-identity/` (singleton por organizacion, endpoints protegidos por auth).

#### [NEW] `apps/api/src/modules/patient-field-config/`

Estructura:
```
patient-field-config/
  patient-field-config.module.ts
  patient-field-config.controller.ts
  patient-field-config.service.ts
  dto/
    update-patient-field-config.dto.ts
```

#### [NEW] DTO: `dto/update-patient-field-config.dto.ts`

```typescript
import { IsString, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PatientFieldConfigItemDto {
  @IsString() fieldKey: string;
  @IsBoolean() newPatientPresent: boolean;
  @IsBoolean() newPatientRequired: boolean;
  @IsBoolean() appointmentPresent: boolean;
  @IsBoolean() appointmentRequired: boolean;
  @IsBoolean() onlineAgendaPresent: boolean;
  @IsBoolean() onlineAgendaRequired: boolean;
  @IsBoolean() checkInPresent: boolean;
  @IsBoolean() checkInRequired: boolean;
}

export class UpdatePatientFieldConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientFieldConfigItemDto)
  fields: PatientFieldConfigItemDto[];
}
```

#### [NEW] Controller: `patient-field-config.controller.ts`

Dos endpoints:
- `GET /patient-field-config` — Retorna config de la organizacion del usuario
- `PUT /patient-field-config` — Upsert masivo (requiere permiso admin)

Guards: `JwtAuthGuard`, `PermissionsGuard`
Permiso sugerido: `patients.config.update`

**Logica del service:**
- `getByOrganization(orgId)`: Busca configs, si no existen las crea con defaults (auto-seed)
- `update(orgId, dto)`: `$transaction` con upsert por `organizationId_fieldKey`; forzar `present=true, required=true` en campos con `isSystemRequired=true` sin importar lo que envie el frontend

#### [NEW] Endpoint publico para agenda online y check-in

Dado que los flujos de agenda online y check-in son paginas publicas sin auth, necesitamos un endpoint publico:

```typescript
// En public-booking.controller.ts o nuevo controller publico
@Get('patient-field-config/:organizationSlug')
// Sin guards de auth
async getPublicFieldConfig(@Param('organizationSlug') slug: string) {
  const org = await this.findOrgBySlug(slug);
  return this.patientFieldConfigService.getByOrganization(org.id);
}
```

Alternativa: incluir la config en el payload existente de `GET /public-booking/config/:slug` que ya se carga en la pagina de booking.

#### [MODIFY] `apps/api/src/app.module.ts`

Importar `PatientFieldConfigModule`.

---

### Fase 3: Frontend — Migrar de localStorage a API

#### [NEW] `apps/web/src/features/patients/hooks/use-patient-field-config-api.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Para contextos autenticados (admin, nuevo paciente, agendamiento)
export function usePatientFieldConfigQuery(organizationId: string | number) {
  return useQuery({
    queryKey: ['patient-field-config', organizationId],
    queryFn: () => api.get('/patient-field-config'),
    staleTime: 5 * 60 * 1000
  });
}

// Para contextos publicos (agenda online, check-in)
export function usePublicPatientFieldConfigQuery(orgSlug: string) {
  return useQuery({
    queryKey: ['patient-field-config-public', orgSlug],
    queryFn: () => api.get(`/public-booking/patient-field-config/${orgSlug}`),
    staleTime: 5 * 60 * 1000
  });
}

export function useUpdatePatientFieldConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields) => api.put('/patient-field-config', { fields }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-field-config'] })
  });
}
```

#### [MODIFY] `apps/web/src/features/patients/config/patient-field-settings.ts`

Cambios:
1. **Eliminar** funciones de localStorage: `readPatientFieldSettings()`, `writePatientFieldSettings()`
2. **Eliminar** constante `PATIENT_FIELD_SETTINGS_KEY`
3. **Reescribir** `usePatientFieldSettings()`:

```typescript
export function usePatientFieldSettings() {
  const orgId = useOrganizationId(); // o como se obtenga en el proyecto
  const query = usePatientFieldConfigQuery(orgId);
  const mutation = useUpdatePatientFieldConfigMutation();

  const settings = useMemo(() => {
    if (!query.data) return createDefaultPatientFieldSettings();
    return apiResponseToSettings(query.data);
  }, [query.data]);

  const updateSettings = (next: PatientFieldSettings) => {
    const normalized = normalizePatientFieldSettings(next);
    mutation.mutate(settingsToApiPayload(normalized));
  };

  return [settings, updateSettings, { isLoading: query.isLoading, error: query.error }] as const;
}
```

4. **Agregar** funciones de transformacion `apiResponseToSettings()` y `settingsToApiPayload()`
5. **Mantener sin cambios**: `usePatientFieldContext()`, `getVisibleFormFields()`, `getRequiredFormFields()`, `PATIENT_FIELD_DEFINITIONS`, `PATIENT_FIELD_CONTEXTS`, `normalizePatientFieldSettings()`

#### [MODIFY] `apps/web/src/features/patients/pages/patients-configuration-page.tsx`

Cambios minimos:
- Boton "Guardar" ahora llama a la mutacion API (automatico via el hook actualizado)
- Agregar indicadores de loading/error del query
- Reemplazar el feedback de timeout local por estado real de la mutacion

#### Sin cambios: `apps/web/src/features/patients/pages/patient-new-page.tsx`

Ya consume `usePatientFieldContext("newPatient")` correctamente. Solo cambia la fuente de datos interna del hook (de localStorage a API), transparente para este componente.

---

### Fase 4: Frontend — Conectar los 3 Formularios Faltantes

Cada formulario necesita:
1. Importar los hooks de configuracion
2. Obtener `visibleFields` y `requiredFields` para su contexto
3. Envolver cada campo con `{visibleFields.has("...") && (...)}`
4. Pasar `required={requiredFields.has("...")}` a cada campo
5. Adaptar la validacion de envio

---

#### 4.1 [MODIFY] Flujo 2: `apps/web/src/features/agenda/components/appointment-modal.tsx`

**Estado actual:** `NewPatientState` hardcodeado (L76-84) con 7 campos fijos. Formulario en L1624-1700.

**Cambios:**

a) Importar hooks:
```typescript
import {
  usePatientFieldContext,
  getVisibleFormFields,
  getRequiredFormFields,
} from "@/features/patients/config/patient-field-settings";
```

b) Dentro del componente, agregar:
```typescript
const appointmentFieldConfig = usePatientFieldContext("appointment");
const visibleAppointmentFields = useMemo(
  () => getVisibleFormFields(appointmentFieldConfig),
  [appointmentFieldConfig]
);
const requiredAppointmentFields = useMemo(
  () => getRequiredFormFields(appointmentFieldConfig),
  [appointmentFieldConfig]
);
```

c) Expandir `NewPatientState` para soportar mas campos:
```typescript
// Agregar campos que puedan habilitarse desde config
type NewPatientState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentNumber: string;
  type: string;
  comment: string;
  // Nuevos opcionales
  birthDate: string;
  gender: string;
  alternatePhone: string;
  occupation: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  emergencyName: string;
  emergencyPhone: string;
  referredBy: string;
};
```

d) Envolver cada campo del formulario (L1624-1700):
```tsx
// Antes:
<FieldLabel label="E-mail">
  <Input type="email" value={newPatient.email} onChange={...} />
</FieldLabel>

// Despues:
{visibleAppointmentFields.has("email") && (
  <FieldLabel label="E-mail" required={requiredAppointmentFields.has("email")}>
    <Input type="email" value={newPatient.email} onChange={...} />
  </FieldLabel>
)}
```

e) Actualizar validacion `canSave` (L523-528):
```typescript
// Antes:
newPatient.firstName.trim().length >= 2 && newPatient.lastName.trim().length >= 2

// Despues:
validateDynamicRequired(newPatient, requiredAppointmentFields)
```

Donde `validateDynamicRequired` es una funcion helper que verifica que todos los campos marcados como requeridos tengan valor.

f) Actualizar el payload de creacion (L643-658) para incluir los campos nuevos.

**PRECAUCION:** Este archivo tiene ~1800 lineas. Solo tocar las secciones indicadas. No refactorizar el modal completo.

---

#### 4.2 [MODIFY] Flujo 3: `apps/web/src/features/public-booking/pages/public-booking-page.tsx`

**Estado actual:** 6 campos hardcodeados en Step 4 (L362-407), con `required` en atributos HTML nativos. Usa `useState` simple para el patient state.

**Cambios:**

a) Importar hooks (version publica, sin auth):
```typescript
import {
  getVisibleFormFields,
  getRequiredFormFields,
  PATIENT_FIELD_DEFINITIONS,
} from "@/features/patients/config/patient-field-settings";
import { usePublicPatientFieldConfigQuery } from "@/features/patients/hooks/use-patient-field-config-api";
```

b) Obtener config desde endpoint publico:
```typescript
// orgSlug ya disponible en el contexto de la pagina de booking
const { data: fieldConfigData } = usePublicPatientFieldConfigQuery(orgSlug);
const onlineAgendaConfig = useMemo(
  () => extractContextFromApiResponse(fieldConfigData, "onlineAgenda"),
  [fieldConfigData]
);
const visibleFields = useMemo(() => getVisibleFormFields(onlineAgendaConfig), [onlineAgendaConfig]);
const requiredFields = useMemo(() => getRequiredFormFields(onlineAgendaConfig), [onlineAgendaConfig]);
```

c) Expandir el patient state para soportar todos los campos posibles:
```typescript
const [patient, setPatient] = useState({
  firstName: "", lastName: "", email: "", phone: "",
  birthDate: "", documentNumber: "",
  // Nuevos
  gender: "", alternatePhone: "", occupation: "",
  addressStreet: "", addressCity: "", addressState: "",
  emergencyName: "", emergencyPhone: "", referredBy: ""
});
```

d) Reemplazar campos hardcodeados (L362-407) por renderizado dinamico:
```tsx
// Antes:
<label>Nombre *</label>
<Input required value={patient.firstName} onChange={...} />

// Despues:
{visibleFields.has("firstName") && (
  <>
    <label>Nombre {requiredFields.has("firstName") ? "*" : ""}</label>
    <Input required={requiredFields.has("firstName")} value={patient.firstName} onChange={...} />
  </>
)}
```

e) Actualizar validacion de `canConfirm` / `handleSubmit`:
```typescript
// Validar dinamicamente que todos los required estan llenos
const missingRequired = Array.from(requiredFields).find(
  field => !patient[field]?.trim()
);
if (missingRequired) {
  setIdentityError(`Campo requerido: ${missingRequired}`);
  return;
}
```

**NOTA:** La validacion actual de `birthDate` obligatoria (L106-109) debe integrarse con la config; si `birthDate` no esta marcada como requerida en la config, no debe bloquear.

---

#### 4.3 [MODIFY] Flujo 4: `apps/web/src/features/public-booking/pages/complete-patient-profile-page.tsx`

**Estado actual:** Schema Zod estatico (L14-30) con 11 campos + `privacyNoticeAccepted`. Formulario con `react-hook-form` + Zod resolver (L195-277).

**Cambios:**

a) Importar hooks (version publica):
```typescript
import {
  getVisibleFormFields,
  getRequiredFormFields,
} from "@/features/patients/config/patient-field-settings";
import { usePublicPatientFieldConfigQuery } from "@/features/patients/hooks/use-patient-field-config-api";
```

b) Obtener config:
```typescript
const { data: fieldConfigData } = usePublicPatientFieldConfigQuery(orgSlug);
const checkInConfig = useMemo(
  () => extractContextFromApiResponse(fieldConfigData, "checkIn"),
  [fieldConfigData]
);
const visibleFields = useMemo(() => getVisibleFormFields(checkInConfig), [checkInConfig]);
const requiredFields = useMemo(() => getRequiredFormFields(checkInConfig), [checkInConfig]);
```

c) Reemplazar schema Zod estatico por dinamico usando `createPatientFormSchema`:
```typescript
import { createPatientFormSchema } from "@/lib/validations/patient";

const formSchema = useMemo(() => {
  const requiredMessages: Record<string, string> = {};
  requiredFields.forEach(field => {
    requiredMessages[field] = "Campo requerido";
  });
  // createPatientFormSchema usa superRefine, asi que funciona con required dinamico
  return createPatientFormSchema(requiredMessages)
    .and(z.object({
      privacyNoticeAccepted: z.boolean().refine(v => v === true, {
        message: "Debes aceptar el aviso de privacidad"
      })
    }));
}, [requiredFields]);
```

d) Envolver cada campo (L195-277):
```tsx
{visibleFields.has("phone") && (
  <Field label="Telefono movil" required={requiredFields.has("phone")}
         error={form.formState.errors.phone?.message}>
    <Input placeholder="10 digitos" {...form.register("phone")} />
  </Field>
)}
```

e) Mantener `privacyNoticeAccepted` siempre visible (no es un campo de paciente, es legal).

---

### Fase 5: Backend — Validacion Dinamica (Recomendada)

Para que el backend no acepte datos incompletos segun la config.

#### [NEW] `apps/api/src/modules/patient-field-config/guards/validate-patient-fields.guard.ts`

Un interceptor o pipe que:
1. Recibe el contexto de flujo (`_flowContext: 'newPatient' | 'appointment' | 'onlineAgenda' | 'checkIn'`)
2. Consulta la config de la organizacion
3. Verifica que todos los campos marcados como requeridos en ese flujo esten presentes en el body
4. Si falta alguno, lanza `BadRequestException`

```typescript
// Mapeo de fieldKey a propiedad del DTO
const FIELD_KEY_TO_DTO_MAP: Record<string, string> = {
  legalName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  mobilePhone: 'phone',
  curp: 'documentNumber',
  birthDate: 'birthDate',
  gender: 'gender',
  fixedPhone: 'alternatePhone',
  profession: 'occupation',
  reference: 'referredBy',
  // campos de direccion requieren logica especial (sub-objeto)
};
```

#### [MODIFY] `apps/api/src/modules/patients/dto/create-patient.dto.ts`

Agregar campo opcional de contexto:
```typescript
@IsOptional()
@IsString()
_flowContext?: 'newPatient' | 'appointment' | 'onlineAgenda' | 'checkIn';
```

#### [MODIFY] Aplicar en controllers:
- `apps/api/src/modules/patients/patients.controller.ts` — POST /patients
- `apps/api/src/modules/public-booking/public-booking.controller.ts` — flujos publicos
- `apps/api/src/modules/online-scheduling/` — si aplica

---

## 4. Orden de Ejecucion

```
Fase 1: Modelo Prisma + migracion
  └─> Fase 2: Modulo CRUD backend
       └─> Fase 3: Migrar frontend de localStorage a API
            └─> Fase 4: Conectar los 3 formularios (paralelizable)
                 ├─> 4.1 appointment-modal.tsx
                 ├─> 4.2 public-booking-page.tsx
                 └─> 4.3 complete-patient-profile-page.tsx
                      └─> Fase 5: Validacion dinamica backend
```

Las 3 refactorizaciones de la Fase 4 son independientes entre si y pueden ejecutarse en paralelo.

---

## 5. Mapa de Archivos

### Archivos Nuevos (6)

| # | Archivo | Descripcion |
|---|---------|-------------|
| 1 | `apps/api/src/modules/patient-field-config/patient-field-config.module.ts` | Modulo NestJS |
| 2 | `apps/api/src/modules/patient-field-config/patient-field-config.controller.ts` | GET/PUT endpoints |
| 3 | `apps/api/src/modules/patient-field-config/patient-field-config.service.ts` | Logica: getByOrg, update, seedDefaults |
| 4 | `apps/api/src/modules/patient-field-config/dto/update-patient-field-config.dto.ts` | DTO de actualizacion |
| 5 | `apps/api/src/modules/patient-field-config/guards/validate-patient-fields.guard.ts` | Validacion dinamica |
| 6 | `apps/web/src/features/patients/hooks/use-patient-field-config-api.ts` | Hooks React Query |

### Archivos Modificados (9)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `packages/database/prisma/schema.prisma` | Agregar modelo `PatientFieldConfig` + relacion en `Organization` |
| 2 | `apps/api/src/app.module.ts` | Importar `PatientFieldConfigModule` |
| 3 | `apps/api/src/modules/patients/dto/create-patient.dto.ts` | Agregar `_flowContext` opcional |
| 4 | `apps/api/src/modules/patients/patients.controller.ts` | Aplicar pipe de validacion dinamica |
| 5 | `apps/web/src/features/patients/config/patient-field-settings.ts` | Migrar de localStorage a API |
| 6 | `apps/web/src/features/patients/pages/patients-configuration-page.tsx` | Loading/error states, feedback real |
| 7 | `apps/web/src/features/agenda/components/appointment-modal.tsx` | Consumir config en formulario paciente nuevo |
| 8 | `apps/web/src/features/public-booking/pages/public-booking-page.tsx` | Consumir config en agenda online |
| 9 | `apps/web/src/features/public-booking/pages/complete-patient-profile-page.tsx` | Consumir config en check-in |

### Archivos Sin Cambios

| Archivo | Razon |
|---------|-------|
| `apps/web/src/features/patients/pages/patient-new-page.tsx` | Ya consume la config correctamente |
| `apps/web/src/lib/validations/patient.ts` | `createPatientFormSchema` ya soporta required dinamico via `superRefine` |

---

## 6. Plan de Verificacion

### Tests por Fase

| Fase | Verificacion | Comando/Accion |
|------|-------------|----------------|
| 1 | Migracion exitosa | `npx prisma migrate dev` sin errores |
| 2 | Endpoints responden | `curl GET/PUT /patient-field-config` retorna 200 |
| 2 | Auto-seed funciona | GET en org sin config previa retorna defaults |
| 3 | Config page guarda en servidor | Guardar, abrir en otro browser, verificar mismos valores |
| 3 | localStorage eliminado | Verificar que no existe key `dentalwarner-patient-field-settings` en localStorage |
| 4.1 | Agendamiento respeta config | Desactivar "Email" en col 2, abrir modal cita + nuevo paciente, campo no aparece |
| 4.2 | Agenda online respeta config | Marcar "Telefono" requerido en col 3, intentar reservar sin telefono, error |
| 4.3 | Check-in respeta config | Desactivar "Genero" en col 4, abrir check-in, campo no aparece |
| 5 | Backend rechaza | POST /patients con `_flowContext: "newPatient"` sin campo requerido = 400 |
| 5 | Campos sistema forzados | Intentar guardar config con legalName present=false = siempre forzado a true |

### Test de regresion

| Test | Descripcion |
|------|-------------|
| Nuevo Paciente sigue funcionando | Verificar que el flujo que YA funcionaba no se rompio |
| Build exitoso | `cd apps/web && npm run build` sin errores |
| Build API | `cd apps/api && npm run build` sin errores |

---

## 7. Preguntas Abiertas

### Pregunta 1: Endpoint publico para paginas sin auth

Los flujos de Agenda Online y Check-In son paginas publicas. Opciones:
- **A)** Crear endpoint publico separado `GET /public/patient-field-config/:orgSlug`
- **B)** Incluir la config en el payload existente de booking que ya se carga

Recomendacion: **Opcion B** — menos endpoints, menos requests, config llega con los datos que ya se cargan.

### Pregunta 2: Campos sin mapeo a formulario

6 de 21 campos en la tabla de config (`socialName`, `agreement`, `internalNumber`, `sex`, `employer`, `guardianCurp`, `socialNameSecondary`, `genderSecondary`) no tienen `formFields` mapeados. Opciones:
- **A)** Ocultar de la tabla de config hasta que se implementen
- **B)** Dejarlas visibles pero sin efecto

Recomendacion: **Opcion A** — no confundir al admin con toggles que no hacen nada.

### Pregunta 3: Scope organizacion vs sucursal

La config actual esta disenada como per-organizacion (todas las sucursales comparten la misma config de campos). Alternativa: per-sucursal (cada sucursal puede personalizar). Recomendacion: **per-organizacion** por simplicidad, alineado con `PatientIdentityConfig`.
