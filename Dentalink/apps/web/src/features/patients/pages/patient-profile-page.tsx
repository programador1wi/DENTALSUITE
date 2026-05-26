import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { patientFormSchema, type PatientFormValues } from "@/lib/validations/patient";
import { PatientSubnav } from "../components/patient-subnav";
import { getPatientStatusLabel, getPatientStatusTone } from "../components/patient-status";
import {
  useAddPatientAlert,
  useAddPatientNote,
  usePatient,
  usePatientTimeline,
  useUpdatePatient
} from "../hooks/use-patients";
import type { PatientPayload, PatientStatus } from "../services/patients.service";
import { PatientHeader } from "../components/patient-header";

const statuses: PatientStatus[] = ["NEW", "ACTIVE", "IN_TREATMENT", "INACTIVE", "DEBTOR", "COMPLETED"];

export function PatientProfilePage() {
  const { id = "" } = useParams();
  const patientQuery = usePatient(id);
  const timelineQuery = usePatientTimeline(id);
  const branchQuery = useBranches(undefined, "ACTIVE");
  const updatePatient = useUpdatePatient();
  const addPatientNote = useAddPatientNote();
  const addPatientAlert = useAddPatientAlert();
  const [newNote, setNewNote] = useState("");
  const [alertType, setAlertType] = useState("");
  const [alertDescription, setAlertDescription] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("MEDIUM");

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
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
    }
  });

  useEffect(() => {
    if (!patientQuery.data) return;
    const emergency = patientQuery.data.contacts.find((contact) => contact.isEmergencyContact);
    form.reset({
      branchId: patientQuery.data.branchId,
      firstName: patientQuery.data.firstName,
      lastName: patientQuery.data.lastName,
      birthDate: patientQuery.data.birthDate?.slice(0, 10) ?? "",
      gender: patientQuery.data.gender ?? "",
      documentType: patientQuery.data.documentType ?? "",
      documentNumber: patientQuery.data.documentNumber ?? "",
      email: patientQuery.data.email ?? "",
      phone: patientQuery.data.phone ?? "",
      alternatePhone: patientQuery.data.alternatePhone ?? "",
      occupation: patientQuery.data.occupation ?? "",
      referredBy: patientQuery.data.referredBy ?? "",
      source: patientQuery.data.source ?? "",
      status: patientQuery.data.status,
      addressStreet: patientQuery.data.address?.street ?? "",
      addressCity: patientQuery.data.address?.city ?? "",
      addressState: patientQuery.data.address?.state ?? "",
      addressCountry: patientQuery.data.address?.country ?? "",
      addressZipCode: patientQuery.data.address?.zipCode ?? "",
      emergencyName: emergency?.name ?? "",
      emergencyRelationship: emergency?.relationship ?? "",
      emergencyPhone: emergency?.phone ?? "",
      emergencyEmail: emergency?.email ?? "",
      alertType: "",
      alertDescription: "",
      alertSeverity: ""
    });
  }, [form, patientQuery.data]);

  const lastAppointmentLabel = patientQuery.data?.summary.lastAppointment ?? "Sin dato";
  const nextAppointmentLabel = patientQuery.data?.summary.nextAppointment ?? "Sin dato";

  const activeAlerts = useMemo(
    () => patientQuery.data?.medicalAlerts.filter((alert) => alert.isActive) ?? [],
    [patientQuery.data?.medicalAlerts]
  );

  if (patientQuery.isLoading) return <LoadingState message="Cargando paciente..." />;
  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;
  if (!patientQuery.data) return <EmptyState title="Paciente no encontrado" description="El registro no existe o fue desactivado." />;

  const patient = patientQuery.data;

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: Partial<PatientPayload> = {
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

    payload.address =
      values.addressStreet || values.addressCity || values.addressState || values.addressCountry || values.addressZipCode
        ? {
            street: values.addressStreet || undefined,
            city: values.addressCity || undefined,
            state: values.addressState || undefined,
            country: values.addressCountry || undefined,
            zipCode: values.addressZipCode || undefined
          }
        : undefined;

    payload.contacts = values.emergencyName
      ? [
          {
            name: values.emergencyName,
            relationship: values.emergencyRelationship || undefined,
            phone: values.emergencyPhone || undefined,
            email: values.emergencyEmail || undefined,
            isEmergencyContact: true
          }
        ]
      : [];

    await updatePatient.mutateAsync({ id, payload });
  });

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Datos del paciente</h3>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Sucursal">
                <Select {...form.register("branchId")}>
                  <option value="">Selecciona</option>
                  {branchQuery.data?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nombre"><Input {...form.register("firstName")} /></Field>
              <Field label="Apellidos"><Input {...form.register("lastName")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Nacimiento"><Input type="date" {...form.register("birthDate")} /></Field>
              <Field label="Genero"><Input {...form.register("gender")} /></Field>
              <Field label="Documento"><Input {...form.register("documentNumber")} /></Field>
              <Field label="Estado">
                <Select {...form.register("status")}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {getPatientStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Telefono"><Input {...form.register("phone")} /></Field>
              <Field label="Telefono alterno"><Input {...form.register("alternatePhone")} /></Field>
              <Field label="Email"><Input {...form.register("email")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Calle"><Input {...form.register("addressStreet")} /></Field>
              <Field label="Ciudad"><Input {...form.register("addressCity")} /></Field>
              <Field label="Estado"><Input {...form.register("addressState")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Contacto emergencia"><Input {...form.register("emergencyName")} /></Field>
              <Field label="Relacion"><Input {...form.register("emergencyRelationship")} /></Field>
              <Field label="Telefono emergencia"><Input {...form.register("emergencyPhone")} /></Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={updatePatient.isPending}>
                {updatePatient.isPending ? "Guardando..." : "Actualizar paciente"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <h3 className="mb-3 text-base font-semibold text-slate-900">Resumen</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Estado</span>
                <Badge value={getPatientStatusLabel(patient.status)} tone={getPatientStatusTone(patient.status)} />
              </div>
              <div className="flex items-center justify-between">
                <span>Proxima cita</span>
                <span>{nextAppointmentLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Ultima cita</span>
                <span>{lastAppointmentLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Saldo</span>
                <span>${patient.summary.balance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tratamientos activos</span>
                <span>{patient.summary.activeTreatments}</span>
              </div>
            </div>
          </Card>

          <Card className={patient.summary.hasCriticalAlert ? "border-red-400" : undefined}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Alertas medicas</h3>
              <Badge
                value={patient.summary.hasCriticalAlert ? "Critica" : "Sin riesgo"}
                tone={patient.summary.hasCriticalAlert ? "danger" : "success"}
              />
            </div>
            {!activeAlerts.length ? (
              <p className="text-sm text-slate-600">Sin alertas activas.</p>
            ) : (
              <ul className="space-y-2">
                {activeAlerts.map((alert) => (
                  <li key={alert.id} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-sm font-medium text-slate-900">{alert.type}</p>
                    <p className="text-xs text-slate-600">{alert.description}</p>
                    <p className="text-xs text-slate-500">{alert.severity}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-base font-semibold text-slate-900">Agregar nota interna</h3>
          <Textarea rows={3} value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Nota interna del paciente" />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={() =>
                void addPatientNote.mutateAsync({ id, note: newNote, isPrivate: true }).then(() => setNewNote(""))
              }
              disabled={!newNote.trim() || addPatientNote.isPending}
            >
              Guardar nota
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 text-base font-semibold text-slate-900">Agregar alerta medica</h3>
          <div className="grid gap-2">
            <Input value={alertType} onChange={(event) => setAlertType(event.target.value)} placeholder="Tipo de alerta" />
            <Textarea
              rows={2}
              value={alertDescription}
              onChange={(event) => setAlertDescription(event.target.value)}
              placeholder="Descripcion de alerta"
            />
            <Select value={alertSeverity} onChange={(event) => setAlertSeverity(event.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </Select>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              onClick={() =>
                void addPatientAlert
                  .mutateAsync({
                    id,
                    payload: {
                      type: alertType,
                      description: alertDescription,
                      severity: alertSeverity,
                      isActive: true
                    }
                  })
                  .then(() => {
                    setAlertType("");
                    setAlertDescription("");
                    setAlertSeverity("MEDIUM");
                  })
              }
              disabled={!alertType.trim() || !alertDescription.trim() || addPatientAlert.isPending}
            >
              Agregar alerta
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
          <Link to={`/patients/${id}/clinical`} className="text-sm text-brand-700 hover:underline">
            Ir a clinico
          </Link>
        </div>
        {timelineQuery.isLoading ? <LoadingState message="Cargando timeline..." /> : null}
        {timelineQuery.isError ? <ErrorState message={timelineQuery.error.message} /> : null}
        {!timelineQuery.isLoading && !timelineQuery.data?.length ? (
          <EmptyState title="Sin eventos" description="No hay eventos para este paciente." />
        ) : (
          <ul className="space-y-2">
            {timelineQuery.data?.map((event, index) => (
              <li key={`${event.type}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{event.type}</span>
                  <span className="text-xs text-slate-500">{new Date(event.date).toLocaleString()}</span>
                </div>
                {"note" in event.payload ? <p className="mt-1 text-slate-700">{String(event.payload.note)}</p> : null}
                {"description" in event.payload ? <p className="mt-1 text-slate-700">{String(event.payload.description)}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
