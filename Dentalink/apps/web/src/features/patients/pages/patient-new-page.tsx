import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/error-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { createPatientFormSchema, type PatientFormValues } from "@/lib/validations/patient";
import { useBranchStore } from "@/stores/branch.store";
import { useCreatePatient } from "../hooks/use-patients";
import { getPatientStatusLabel } from "../components/patient-status";
import { getRequiredFormFields, getVisibleFormFields, usePatientFieldContext } from "../config/patient-field-settings";
import type { PatientPayload, PatientStatus } from "../services/patients.service";
import { duplicateCheck, type DuplicateCheckResult } from "../services/patient-identity.service";

const statusOptions: PatientStatus[] = ["NEW", "ACTIVE", "IN_TREATMENT", "INACTIVE", "DEBTOR", "COMPLETED"];

const defaults: PatientFormValues = {
  branchId: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "",
  documentType: "",
  documentNumber: "",
  email: "",
  phone: "",
  alternatePhone: "",
  occupation: "",
  referredBy: "",
  source: "",
  status: "ACTIVE",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressCountry: "",
  addressZipCode: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyEmail: "",
  alertType: "",
  alertDescription: "",
  alertSeverity: ""
};

export function PatientNewPage() {
  const navigate = useNavigate();
  const { activeBranchId } = useBranchStore();
  const createPatient = useCreatePatient();
  const branchQuery = useBranches(undefined, "ACTIVE");
  const patientFieldConfig = usePatientFieldContext("newPatient");
  const visibleFields = useMemo(() => getVisibleFormFields(patientFieldConfig), [patientFieldConfig]);
  const requiredFields = useMemo(() => getRequiredFormFields(patientFieldConfig), [patientFieldConfig]);
  const formSchema = useMemo(() => {
    const messages: Partial<Record<keyof PatientFormValues, string>> = {};
    requiredFields.forEach((field) => {
      messages[field] = `${fieldLabel(field)} requerido`;
    });
    return createPatientFormSchema(messages);
  }, [requiredFields]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateCheckResult | null>(null);
  const [pendingPayload, setPendingPayload] = useState<PatientPayload | null>(null);

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...defaults,
      branchId: activeBranchId || ""
    }
  });

  const submitDisabled = createPatient.isPending || !branchQuery.data?.length;
  const branchOptions = useMemo(() => branchQuery.data ?? [], [branchQuery.data]);

  const persistPatient = async (payload: PatientPayload) => {
    const response = await createPatient.mutateAsync(payload);
    navigate(`/patients/${response.patient.id}/profile`);
  };

  useEffect(() => {
    for (const field of Object.keys(defaults) as Array<keyof PatientFormValues>) {
      if (field === "branchId" || field === "firstName" || field === "lastName") continue;
      if (visibleFields.has(field)) continue;

      form.setValue(field, defaults[field], { shouldDirty: false, shouldValidate: false });
      form.clearErrors(field);
    }
  }, [form, visibleFields]);

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    setDuplicateMessage(null);

    const payload: PatientPayload = {
      branchId: values.branchId,
      firstName: values.firstName ?? "",
      lastName: values.lastName ?? "",
      birthDate: values.birthDate || undefined,
      gender: values.gender || undefined,
      documentType: values.documentType || undefined,
      documentNumber: values.documentNumber || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      alternatePhone: values.alternatePhone || undefined,
      occupation: values.occupation || undefined,
      referredBy: values.referredBy || undefined,
      source: values.source || undefined,
      status: values.status
    };

    if (values.emergencyName) {
      payload.contacts = [
        {
          name: values.emergencyName,
          relationship: values.emergencyRelationship || undefined,
          phone: values.emergencyPhone || undefined,
          email: values.emergencyEmail || undefined,
          isEmergencyContact: true
        }
      ];
    }

    if (values.addressStreet || values.addressCity || values.addressState || values.addressCountry || values.addressZipCode) {
      payload.address = {
        street: values.addressStreet || undefined,
        city: values.addressCity || undefined,
        state: values.addressState || undefined,
        country: values.addressCountry || undefined,
        zipCode: values.addressZipCode || undefined
      };
    }

    if (values.alertType && values.alertDescription && values.alertSeverity) {
      payload.medicalAlerts = [
        {
          type: values.alertType,
          description: values.alertDescription,
          severity: values.alertSeverity
        }
      ];
    }

    try {
      const review = await duplicateCheck({
        branchId: payload.branchId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        birthDate: payload.birthDate,
        documentType: payload.documentType,
        documentNumber: payload.documentNumber,
        email: payload.email,
        phone: payload.phone
      });
      if (review.matches.length) {
        setPendingPayload(payload);
        setDuplicateReview(review);
        return;
      }
      await persistPatient(payload);
    } catch (error) {
      setApiError((error as Error).message);
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Nuevo paciente" description="Registro inicial del paciente con expediente basico." />
      {apiError ? <ErrorState message={apiError} /> : null}
      {duplicateMessage ? <ErrorState message={duplicateMessage} /> : null}

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Sucursal" required error={form.formState.errors.branchId?.message}>
              <Select {...form.register("branchId")}>
                <option value="">Selecciona sucursal</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nombre" required={requiredFields.has("firstName")} error={form.formState.errors.firstName?.message}>
              <Input {...form.register("firstName")} />
            </Field>
            <Field label="Apellidos" required={requiredFields.has("lastName")} error={form.formState.errors.lastName?.message}>
              <Input {...form.register("lastName")} />
            </Field>
          </div>

          {hasAnyVisible(visibleFields, ["birthDate", "gender", "documentType", "documentNumber"]) ? (
            <div className="grid gap-3 md:grid-cols-4">
              {visibleFields.has("birthDate") ? (
                <Field label="Fecha nacimiento" required={requiredFields.has("birthDate")} error={form.formState.errors.birthDate?.message}>
                  <Input type="date" {...form.register("birthDate")} />
                </Field>
              ) : null}
              {visibleFields.has("gender") ? (
                <Field label="Genero" required={requiredFields.has("gender")} error={form.formState.errors.gender?.message}>
                  <Input {...form.register("gender")} />
                </Field>
              ) : null}
              {visibleFields.has("documentType") ? (
                <Field label="Tipo documento" required={requiredFields.has("documentType")} error={form.formState.errors.documentType?.message}>
                  <Input {...form.register("documentType")} />
                </Field>
              ) : null}
              {visibleFields.has("documentNumber") ? (
                <Field label="Numero documento" required={requiredFields.has("documentNumber")} error={form.formState.errors.documentNumber?.message}>
                  <Input {...form.register("documentNumber")} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {hasAnyVisible(visibleFields, ["phone", "alternatePhone", "email"]) ? (
            <div className="grid gap-3 md:grid-cols-3">
              {visibleFields.has("phone") ? (
                <Field label="Telefono" required={requiredFields.has("phone")} error={form.formState.errors.phone?.message}>
                  <Input {...form.register("phone")} />
                </Field>
              ) : null}
              {visibleFields.has("alternatePhone") ? (
                <Field label="Telefono alterno" required={requiredFields.has("alternatePhone")} error={form.formState.errors.alternatePhone?.message}>
                  <Input {...form.register("alternatePhone")} />
                </Field>
              ) : null}
              {visibleFields.has("email") ? (
                <Field label="Email" required={requiredFields.has("email")} error={form.formState.errors.email?.message}>
                  <Input {...form.register("email")} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {hasAnyVisible(visibleFields, ["occupation", "referredBy", "source", "status"]) ? (
            <div className="grid gap-3 md:grid-cols-4">
              {visibleFields.has("occupation") ? (
                <Field label="Ocupacion" required={requiredFields.has("occupation")} error={form.formState.errors.occupation?.message}>
                  <Input {...form.register("occupation")} />
                </Field>
              ) : null}
              {visibleFields.has("referredBy") ? (
                <Field label="Referido por" required={requiredFields.has("referredBy")} error={form.formState.errors.referredBy?.message}>
                  <Input {...form.register("referredBy")} />
                </Field>
              ) : null}
              {visibleFields.has("source") ? (
                <Field label="Fuente" required={requiredFields.has("source")} error={form.formState.errors.source?.message}>
                  <Input {...form.register("source")} />
                </Field>
              ) : null}
              {visibleFields.has("status") ? (
                <Field label="Estado" required={requiredFields.has("status")} error={form.formState.errors.status?.message}>
                  <Select {...form.register("status")}>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getPatientStatusLabel(status)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}

          {hasAnyVisible(visibleFields, ["addressStreet", "addressCity", "addressState", "addressCountry", "addressZipCode"]) ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleFields.has("addressStreet") ? (
                <Field label="Calle" required={requiredFields.has("addressStreet")} error={form.formState.errors.addressStreet?.message}>
                  <Input {...form.register("addressStreet")} />
                </Field>
              ) : null}
              {visibleFields.has("addressCity") ? (
                <Field label="Ciudad" required={requiredFields.has("addressCity")} error={form.formState.errors.addressCity?.message}>
                  <Input {...form.register("addressCity")} />
                </Field>
              ) : null}
              {visibleFields.has("addressState") ? (
                <Field label="Estado" required={requiredFields.has("addressState")} error={form.formState.errors.addressState?.message}>
                  <Input {...form.register("addressState")} />
                </Field>
              ) : null}
              {visibleFields.has("addressCountry") ? (
                <Field label="Pais" required={requiredFields.has("addressCountry")} error={form.formState.errors.addressCountry?.message}>
                  <Input {...form.register("addressCountry")} />
                </Field>
              ) : null}
              {visibleFields.has("addressZipCode") ? (
                <Field label="Codigo postal" required={requiredFields.has("addressZipCode")} error={form.formState.errors.addressZipCode?.message}>
                  <Input {...form.register("addressZipCode")} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {hasAnyVisible(visibleFields, ["emergencyName", "emergencyRelationship", "emergencyPhone", "emergencyEmail"]) ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleFields.has("emergencyName") ? (
                <Field label="Contacto emergencia" required={requiredFields.has("emergencyName")} error={form.formState.errors.emergencyName?.message}>
                  <Input {...form.register("emergencyName")} />
                </Field>
              ) : null}
              {visibleFields.has("emergencyRelationship") ? (
                <Field label="Relacion" required={requiredFields.has("emergencyRelationship")} error={form.formState.errors.emergencyRelationship?.message}>
                  <Input {...form.register("emergencyRelationship")} />
                </Field>
              ) : null}
              {visibleFields.has("emergencyPhone") ? (
                <Field label="Telefono emergencia" required={requiredFields.has("emergencyPhone")} error={form.formState.errors.emergencyPhone?.message}>
                  <Input {...form.register("emergencyPhone")} />
                </Field>
              ) : null}
              {visibleFields.has("emergencyEmail") ? (
                <Field label="Email emergencia" required={requiredFields.has("emergencyEmail")} error={form.formState.errors.emergencyEmail?.message}>
                  <Input {...form.register("emergencyEmail")} />
                </Field>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Alerta tipo"><Input {...form.register("alertType")} /></Field>
            <Field label="Severidad"><Input placeholder="LOW | MEDIUM | HIGH | CRITICAL" {...form.register("alertSeverity")} /></Field>
            <Field label="Descripcion alerta">
              <Textarea rows={1} {...form.register("alertDescription")} />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Link to="/patients">
              <Button variant="secondary" type="button">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={submitDisabled}>
              {createPatient.isPending ? "Guardando..." : "Crear paciente"}
            </Button>
          </div>
        </form>
      </Card>

      <Modal
        open={Boolean(duplicateReview)}
        title="Revisar identidad antes de crear"
        onClose={() => {
          setDuplicateReview(null);
          setPendingPayload(null);
        }}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="font-semibold text-amber-950">Encontramos fichas con datos coincidentes.</p>
            <p className="mt-1 text-sm text-amber-800">Teléfono o correo compartido no bloquean por sí solos. Documento y datos personales coincidentes requieren usar ficha existente.</p>
          </div>
          <div className="space-y-2">
            {duplicateReview?.matches.map((match) => (
              <div key={match.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{match.firstName} {match.lastName}</p>
                  <p className="mt-1 text-xs text-slate-500">Coincidencia {match.confidence}% · {match.reasons.join(", ")}</p>
                </div>
                <Link to={`/patients/${match.id}/profile`} className="shrink-0 text-sm font-semibold text-[var(--text-brand)] hover:underline">
                  Abrir ficha
                </Link>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="secondary" onClick={() => setDuplicateReview(null)}>Volver a editar</Button>
            <Button
              onClick={() => pendingPayload && void persistPatient(pendingPayload)}
              disabled={
                !pendingPayload ||
                createPatient.isPending ||
                duplicateReview?.decision === "BLOCK_VERIFIED_IDENTITY" ||
                duplicateReview?.decision === "PHONE_REQUIRES_FAMILY_FLOW"
              }
            >
              Crear ficha distinta
            </Button>
          </div>
          {duplicateReview?.decision === "BLOCK_VERIFIED_IDENTITY" ? (
            <p className="text-right text-xs font-medium text-red-700">Documento e identidad coinciden. Creación bloqueada.</p>
          ) : null}
          {duplicateReview?.decision === "PHONE_REQUIRES_FAMILY_FLOW" ? (
            <p className="text-right text-xs font-medium text-red-700">
              Teléfono ya vinculado. Agrega paciente desde grupo familiar o utiliza otro número.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-[var(--text-danger)]">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function hasAnyVisible(visibleFields: Set<keyof PatientFormValues>, fields: Array<keyof PatientFormValues>) {
  return fields.some((field) => visibleFields.has(field));
}

function fieldLabel(field: keyof PatientFormValues) {
  const labels: Record<keyof PatientFormValues, string> = {
    branchId: "Sucursal",
    firstName: "Nombre",
    lastName: "Apellido",
    birthDate: "Fecha nacimiento",
    gender: "Genero",
    documentType: "Tipo documento",
    documentNumber: "Numero documento",
    email: "Email",
    phone: "Telefono",
    alternatePhone: "Telefono alterno",
    occupation: "Ocupacion",
    referredBy: "Referido por",
    source: "Fuente",
    status: "Estado",
    addressStreet: "Calle",
    addressCity: "Ciudad",
    addressState: "Estado",
    addressCountry: "Pais",
    addressZipCode: "Codigo postal",
    emergencyName: "Contacto emergencia",
    emergencyRelationship: "Relacion",
    emergencyPhone: "Telefono emergencia",
    emergencyEmail: "Email emergencia",
    alertType: "Alerta tipo",
    alertDescription: "Descripcion alerta",
    alertSeverity: "Severidad"
  };

  return labels[field];
}
