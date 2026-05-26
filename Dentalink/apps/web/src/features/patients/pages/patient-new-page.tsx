import { type ReactNode, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/error-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { patientFormSchema, type PatientFormValues } from "@/lib/validations/patient";
import { useCreatePatient } from "../hooks/use-patients";
import { getPatientStatusLabel } from "../components/patient-status";
import type { PatientPayload, PatientStatus } from "../services/patients.service";

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
  const createPatient = useCreatePatient();
  const branchQuery = useBranches(undefined, "ACTIVE");
  const [apiError, setApiError] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: defaults
  });

  const submitDisabled = createPatient.isPending || !branchQuery.data?.length;
  const branchOptions = useMemo(() => branchQuery.data ?? [], [branchQuery.data]);

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    setDuplicateMessage(null);

    const payload: PatientPayload = {
      branchId: values.branchId,
      firstName: values.firstName,
      lastName: values.lastName,
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
      const response = await createPatient.mutateAsync(payload);
      if (response.potentialDuplicates.length) {
        setDuplicateMessage("Se detectaron posibles duplicados con datos similares.");
      }
      navigate(`/patients/${response.patient.id}/profile`);
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
            <Field label="Sucursal" error={form.formState.errors.branchId?.message}>
              <Select {...form.register("branchId")}>
                <option value="">Selecciona sucursal</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nombre" error={form.formState.errors.firstName?.message}>
              <Input {...form.register("firstName")} />
            </Field>
            <Field label="Apellidos" error={form.formState.errors.lastName?.message}>
              <Input {...form.register("lastName")} />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Fecha nacimiento"><Input type="date" {...form.register("birthDate")} /></Field>
            <Field label="Genero"><Input {...form.register("gender")} /></Field>
            <Field label="Tipo documento"><Input {...form.register("documentType")} /></Field>
            <Field label="Numero documento"><Input {...form.register("documentNumber")} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Telefono"><Input {...form.register("phone")} /></Field>
            <Field label="Telefono alterno"><Input {...form.register("alternatePhone")} /></Field>
            <Field label="Email" error={form.formState.errors.email?.message}><Input {...form.register("email")} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Ocupacion"><Input {...form.register("occupation")} /></Field>
            <Field label="Referido por"><Input {...form.register("referredBy")} /></Field>
            <Field label="Fuente"><Input {...form.register("source")} /></Field>
            <Field label="Estado">
              <Select {...form.register("status")}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getPatientStatusLabel(status)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Calle"><Input {...form.register("addressStreet")} /></Field>
            <Field label="Ciudad"><Input {...form.register("addressCity")} /></Field>
            <Field label="Estado"><Input {...form.register("addressState")} /></Field>
            <Field label="Pais"><Input {...form.register("addressCountry")} /></Field>
            <Field label="Codigo postal"><Input {...form.register("addressZipCode")} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Contacto emergencia"><Input {...form.register("emergencyName")} /></Field>
            <Field label="Relacion"><Input {...form.register("emergencyRelationship")} /></Field>
            <Field label="Telefono emergencia"><Input {...form.register("emergencyPhone")} /></Field>
            <Field label="Email emergencia" error={form.formState.errors.emergencyEmail?.message}>
              <Input {...form.register("emergencyEmail")} />
            </Field>
          </div>

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
    </div>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm text-slate-700">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
