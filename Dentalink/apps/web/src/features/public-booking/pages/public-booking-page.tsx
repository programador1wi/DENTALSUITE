import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  getPublicConfig,
  getPublicAvailability,
  createPublicAppointment,
  resolvePublicIdentity,
  selectPublicIdentity,
  trackPublicEvent,
  verifyPublicIdentity,
  type PublicIdentityCandidate,
  type PublicIdentitySession,
  type PublicPatient,
  type PublicCreateAppointmentDto
} from "../services/public-booking.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import {
  recordsToSettings,
  createDefaultPatientFieldSettings,
  getVisibleFormFields,
  getRequiredFormFields
} from "@/features/patients/config/patient-field-settings";
import {
  createEmptyPublicPatient,
  type PublicBookingSearchMode,
  type PublicBookingStep
} from "./public-booking-model";

export function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<PublicBookingStep>(1);
  const [searchMode, setSearchMode] = useState<PublicBookingSearchMode>("");

  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const [patient, setPatient] = useState<PublicPatient>(createEmptyPublicPatient);
  const [motive, setMotive] = useState<string>("");
  const [identitySession, setIdentitySession] = useState<PublicIdentitySession | null>(null);
  const [identityCandidates, setIdentityCandidates] = useState<PublicIdentityCandidate[]>([]);
  const [identityError, setIdentityError] = useState("");
  const [resolvingIdentity, setResolvingIdentity] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const {
    data: config,
    isLoading,
    error
  } = useQuery({
    queryKey: ["public-booking-config", slug],
    queryFn: () => getPublicConfig(slug!),
    enabled: !!slug
  });

  const fieldSettings = useMemo(() => {
    if (!config?.patientFieldConfigs) return createDefaultPatientFieldSettings();
    return recordsToSettings(config.patientFieldConfigs);
  }, [config?.patientFieldConfigs]);

  const visibleFields = useMemo(() => getVisibleFormFields(fieldSettings.onlineAgenda), [fieldSettings]);
  const requiredFields = useMemo(() => getRequiredFormFields(fieldSettings.onlineAgenda), [fieldSettings]);

  useEffect(() => {
    if (slug && config) {
      const campaignParam = searchParams.get("campaign");
      const professionalParam = searchParams.get("professional");

      const sessionCampaign = sessionStorage.getItem(`campaign_${slug}`);
      const activeCampaign = campaignParam || sessionCampaign;

      if (campaignParam) {
        sessionStorage.setItem(`campaign_${slug}`, campaignParam);
      }

      if (professionalParam) {
        setSelectedProfessional(professionalParam);
        setSearchMode("professional");
        setStep(2);
      }

      if (!sessionStorage.getItem(`tracked_visit_${slug}`)) {
        trackPublicEvent(slug, "VISIT", activeCampaign || undefined)
          .then(() => {
            sessionStorage.setItem(`tracked_visit_${slug}`, "true");
          })
          .catch((err) => console.error("Failed to track visit", err));
      }
    }
  }, [slug, config, searchParams]);

  // If there's only 1 branch, auto-select it
  useEffect(() => {
    if (config?.branches?.length === 1 && !selectedBranch) {
      setSelectedBranch(config.branches[0].id);
    }
  }, [config, selectedBranch]);

  const { data: availability, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: ["public-booking-availability", slug, selectedBranch, selectedProfessional, selectedDate],
    queryFn: () =>
      getPublicAvailability(slug!, {
        branchId: selectedBranch,
        professionalId: selectedProfessional,
        date: selectedDate
      }),
    enabled: !!slug && !!selectedBranch && !!selectedProfessional && !!selectedDate && step === 3
  });

  const mutation = useMutation({
    mutationFn: (dto: PublicCreateAppointmentDto) => createPublicAppointment(slug!, dto, idempotencyKey),
    onSuccess: () => {
      setStep(5);
    },
    onError: (error: Error) => setIdentityError(error.message)
  });

  if (isLoading)
    return (
      <div className="p-8 text-center flex items-center justify-center min-h-screen">
        Cargando portal de reservas...
      </div>
    );
  if (error || !config)
    return (
      <div className="p-8 text-center text-red-500 flex items-center justify-center min-h-screen">
        Página de reserva no encontrada o no disponible.
      </div>
    );

  const appointmentPayload = (sessionId: string): PublicCreateAppointmentDto => ({
    branchId: selectedBranch,
    professionalId: selectedProfessional,
    specialtyId: selectedSpecialty || undefined,
    startAt: selectedSlot,
    patient,
    motive,
    campaignCode: sessionStorage.getItem(`campaign_${slug}`) || undefined,
    identitySessionId: sessionId
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityError("");
    if (requiredFields.has("birthDate") && !patient.birthDate) {
      setIdentityError("Fecha de nacimiento es obligatoria para evitar asignar la cita a otra persona.");
      return;
    }
    if (identitySession?.hasSelectedPatient) {
      mutation.mutate(appointmentPayload(identitySession.id));
      return;
    }
    setResolvingIdentity(true);
    try {
      const resolved = identitySession ?? (await resolvePublicIdentity(slug!, patient));
      setIdentitySession(resolved);
      if (resolved.resolution === "NO_MATCH") {
        mutation.mutate(appointmentPayload(resolved.id));
        return;
      }
      if (resolved.resolution === "FAMILY_SHARED") {
        setIdentityCandidates(resolved.candidates ?? []);
        return;
      }
      if (resolved.resolution === "AMBIGUOUS") {
        setIdentityError(
          "Este teléfono requiere verificación manual por recepción. No se creó ninguna cita."
        );
        return;
      }
      const verified = await verifyPublicIdentity(slug!, resolved.id, patient);
      setIdentitySession(verified);
      if (verified.candidates?.length) {
        setIdentityCandidates(verified.candidates);
      } else {
        setIdentityError(
          "No fue posible resolver la identidad de forma segura. Contacta recepción para continuar."
        );
      }
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "No fue posible resolver la identidad.");
    } finally {
      setResolvingIdentity(false);
    }
  };

  const choosePatient = async (candidate: PublicIdentityCandidate) => {
    if (!identitySession) return;
    setResolvingIdentity(true);
    setIdentityError("");
    try {
      const selected = await selectPublicIdentity(slug!, identitySession.id, candidate);
      setIdentitySession(selected);
      setIdentityCandidates([]);
      mutation.mutate(appointmentPayload(selected.id));
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "No fue posible seleccionar al paciente.");
    } finally {
      setResolvingIdentity(false);
    }
  };

  const steps = [
    { num: 1, label: "Búsqueda" },
    { num: 2, label: "Selección" },
    { num: 3, label: "Fecha" },
    { num: 4, label: "Tus Datos" },
    { num: 5, label: "Fin" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {config.brandColor && <div style={{ height: "8px", backgroundColor: config.brandColor }} />}

        <div className="p-8 text-center border-b border-slate-100">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <h1 className="text-2xl font-bold text-slate-800">Agendar Cita</h1>
          )}

          <div className="mt-8 hidden sm:flex items-center justify-center space-x-4">
            {steps.map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={cn(
                    "flex flex-col items-center",
                    step >= s.num ? "text-blue-600" : "text-slate-400"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
                      step >= s.num ? "border-blue-600 bg-blue-50" : "border-slate-300"
                    )}
                  >
                    {s.num}
                  </div>
                  <span className="text-xs font-medium mt-1">{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn("w-12 h-0.5 mx-2 -mt-4", step > s.num ? "bg-blue-600" : "bg-slate-200")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-10">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-xl font-semibold text-slate-800 text-center">
                ¿Cómo deseas buscar tu cita?
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mt-6">
                <button
                  onClick={() => {
                    setSearchMode("professional");
                    setStep(2);
                  }}
                  className="p-6 text-center border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-16 h-16 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg text-slate-800">Por Profesional</h3>
                  <p className="text-sm text-slate-500 mt-1">Si ya sabes con quién atenderte</p>
                </button>

                <button
                  onClick={() => {
                    setSearchMode("specialty");
                    setStep(2);
                  }}
                  className="p-6 text-center border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-16 h-16 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg text-slate-800">Por Especialidad</h3>
                  <p className="text-sm text-slate-500 mt-1">Busca el tratamiento que necesitas</p>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  {searchMode === "professional"
                    ? "Selecciona un Profesional"
                    : searchMode === "specialty" && !selectedSpecialty
                      ? "Selecciona una Especialidad"
                      : "Selecciona un Profesional"}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (searchMode === "specialty" && selectedSpecialty) setSelectedSpecialty("");
                    else setStep(1);
                  }}
                >
                  Volver
                </Button>
              </div>

              {searchMode === "specialty" && !selectedSpecialty && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {config.specialties?.length ? (
                    config.specialties.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSpecialty(s.id)}
                        className="p-4 text-left border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                      >
                        <span className="font-medium text-slate-800">{s.name}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-slate-500 col-span-2 text-center py-4">
                      No hay especialidades configuradas.
                    </p>
                  )}
                </div>
              )}

              {(searchMode === "professional" || (searchMode === "specialty" && selectedSpecialty)) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {config.professionals?.length ? (
                    config.professionals.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProfessional(p.id);
                          setStep(3);
                        }}
                        className="p-4 flex items-center space-x-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                      >
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold uppercase">
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-slate-800">
                            {p.firstName} {p.lastName}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-slate-500 col-span-2 text-center py-4">
                      No hay profesionales configurados.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">Selecciona Fecha y Hora</h2>
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                  Volver
                </Button>
              </div>

              {config.branches && config.branches.length > 1 && (
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Selecciona la sucursal de atención
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:border-blue-500 bg-white"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="">Seleccionar Sucursal</option>
                    {config.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className={cn(
                  "transition-opacity",
                  !selectedBranch && config.branches?.length > 1
                    ? "opacity-50 pointer-events-none"
                    : "opacity-100"
                )}
              >
                <label className="block text-sm font-medium text-slate-700">Fecha de tu cita</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1 max-w-sm"
                />

                <div className="mt-8">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Horarios disponibles
                  </label>
                  {isAvailabilityLoading ? (
                    <div className="flex items-center justify-center p-8 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                      <p className="text-slate-500 text-sm animate-pulse">Buscando horarios...</p>
                    </div>
                  ) : availability?.slots?.length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {availability.slots
                        .filter((s) => s.available)
                        .map((s) => {
                          const timeString = new Date(s.startAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          });
                          return (
                            <Button
                              key={s.startAt}
                              variant={selectedSlot === s.startAt ? "primary" : "secondary"}
                              onClick={() => setSelectedSlot(s.startAt)}
                              className={cn(
                                "font-medium",
                                selectedSlot === s.startAt
                                  ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                  : "text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-700"
                              )}
                            >
                              {timeString}
                            </Button>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-amber-50 border border-amber-100 rounded-lg">
                      <p className="text-amber-800 text-sm">
                        No hay horarios disponibles para esta fecha. Intenta con otro día.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <Button
                    onClick={() => setStep(4)}
                    disabled={!selectedSlot}
                    size="lg"
                    className="w-full sm:w-auto px-10"
                  >
                    Continuar con mis datos
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">Tus Datos Personales</h2>
                <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                  Volver
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {visibleFields.has("firstName") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Nombre {requiredFields.has("firstName") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("firstName")}
                        value={patient.firstName}
                        onChange={(e) => setPatient({ ...patient, firstName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("socialName") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Nombre social {requiredFields.has("socialName") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("socialName")}
                        value={patient.socialName}
                        onChange={(e) => setPatient({ ...patient, socialName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("lastName") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Apellidos {requiredFields.has("lastName") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("lastName")}
                        value={patient.lastName}
                        onChange={(e) => setPatient({ ...patient, lastName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                {visibleFields.has("birthDate") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Fecha de nacimiento {requiredFields.has("birthDate") ? "*" : ""}
                    </label>
                    <Input
                      type="date"
                      required={requiredFields.has("birthDate")}
                      max={new Date().toISOString().split("T")[0]}
                      value={patient.birthDate}
                      onChange={(e) => setPatient({ ...patient, birthDate: e.target.value })}
                      className="mt-1 max-w-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Se usa solo para evitar confundir fichas con teléfonos compartidos.
                    </p>
                  </div>
                )}

                {visibleFields.has("sex") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Sexo {requiredFields.has("sex") ? "*" : ""}
                    </label>
                    <Select
                      required={requiredFields.has("sex")}
                      value={patient.sex}
                      onChange={(e) => setPatient({ ...patient, sex: e.target.value })}
                      className="mt-1"
                    >
                      <option value="">Selecciona...</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="INTERSEXUAL">Intersexual</option>
                      <option value="NO_ESPECIFICADO">No especificado</option>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {visibleFields.has("email") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Email {requiredFields.has("email") ? "*" : ""}
                      </label>
                      <Input
                        type="email"
                        required={requiredFields.has("email")}
                        value={patient.email}
                        onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("phone") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Teléfono {requiredFields.has("phone") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("phone")}
                        value={patient.phone}
                        onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                {(visibleFields.has("documentNumber") || config.identificationMethod === "DOCUMENT") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {visibleFields.has("documentType") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Tipo de documento {requiredFields.has("documentType") ? "*" : ""}
                        </label>
                        <Input
                          required={requiredFields.has("documentType")}
                          value={patient.documentType}
                          onChange={(e) => setPatient({ ...patient, documentType: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Documento de Identidad (CURP/RFC) {requiredFields.has("documentNumber") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("documentNumber")}
                        value={patient.documentNumber}
                        onChange={(e) => setPatient({ ...patient, documentNumber: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {visibleFields.has("gender") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Genero {requiredFields.has("gender") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("gender")}
                        value={patient.gender}
                        onChange={(e) => setPatient({ ...patient, gender: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("alternatePhone") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Telefono fijo {requiredFields.has("alternatePhone") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("alternatePhone")}
                        value={patient.alternatePhone}
                        onChange={(e) => setPatient({ ...patient, alternatePhone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("occupation") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Actividad o profesion {requiredFields.has("occupation") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("occupation")}
                        value={patient.occupation}
                        onChange={(e) => setPatient({ ...patient, occupation: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("agreementId") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Convenio {requiredFields.has("agreementId") ? "*" : ""}
                      </label>
                      <Select
                        required={requiredFields.has("agreementId")}
                        value={patient.agreementId}
                        onChange={(e) => setPatient({ ...patient, agreementId: e.target.value })}
                        className="mt-1"
                      >
                        <option value="">Sin convenio</option>
                        {(config.agreements ?? []).map((agreement) => (
                          <option key={agreement.id} value={agreement.id}>
                            {agreement.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  {visibleFields.has("internalNumber") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Numero interno {requiredFields.has("internalNumber") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("internalNumber")}
                        value={patient.internalNumber}
                        onChange={(e) => setPatient({ ...patient, internalNumber: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("employer") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Empleador {requiredFields.has("employer") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("employer")}
                        value={patient.employer}
                        onChange={(e) => setPatient({ ...patient, employer: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("referredBy") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Referencia {requiredFields.has("referredBy") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("referredBy")}
                        value={patient.referredBy}
                        onChange={(e) => setPatient({ ...patient, referredBy: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("status") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Tipo {requiredFields.has("status") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("status")}
                        value={patient.type}
                        onChange={(e) => setPatient({ ...patient, type: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("emergencyName") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Apoderado {requiredFields.has("emergencyName") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("emergencyName")}
                        value={patient.guardianName}
                        onChange={(e) => setPatient({ ...patient, guardianName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("emergencySocialName") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Nombre social tutor {requiredFields.has("emergencySocialName") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("emergencySocialName")}
                        value={patient.guardianSocialName}
                        onChange={(e) => setPatient({ ...patient, guardianSocialName: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("emergencyDocumentNumber") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        CURP/RFC tutor legal {requiredFields.has("emergencyDocumentNumber") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("emergencyDocumentNumber")}
                        value={patient.guardianDocumentNumber}
                        onChange={(e) => setPatient({ ...patient, guardianDocumentNumber: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {visibleFields.has("emergencyGender") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Genero tutor {requiredFields.has("emergencyGender") ? "*" : ""}
                      </label>
                      <Input
                        required={requiredFields.has("emergencyGender")}
                        value={patient.guardianGender}
                        onChange={(e) => setPatient({ ...patient, guardianGender: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                {visibleFields.has("observations") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Observaciones {requiredFields.has("observations") ? "*" : ""}
                    </label>
                    <textarea
                      required={requiredFields.has("observations")}
                      value={patient.observations}
                      onChange={(e) => setPatient({ ...patient, observations: e.target.value })}
                      className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {(visibleFields.has("addressStreet") ||
                  visibleFields.has("addressCity") ||
                  visibleFields.has("addressState")) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 rounded-lg border border-slate-200 p-4">
                    {visibleFields.has("addressStreet") && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Direccion {requiredFields.has("addressStreet") ? "*" : ""}
                        </label>
                        <Input
                          required={requiredFields.has("addressStreet")}
                          value={patient.address?.street}
                          onChange={(e) =>
                            setPatient({
                              ...patient,
                              address: { ...patient.address, street: e.target.value }
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    )}
                    {visibleFields.has("addressCity") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Ciudad {requiredFields.has("addressCity") ? "*" : ""}
                        </label>
                        <Input
                          required={requiredFields.has("addressCity")}
                          value={patient.address?.city}
                          onChange={(e) =>
                            setPatient({ ...patient, address: { ...patient.address, city: e.target.value } })
                          }
                          className="mt-1"
                        />
                      </div>
                    )}
                    {visibleFields.has("addressState") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Delegacion {requiredFields.has("addressState") ? "*" : ""}
                        </label>
                        <Input
                          required={requiredFields.has("addressState")}
                          value={patient.address?.state}
                          onChange={(e) =>
                            setPatient({ ...patient, address: { ...patient.address, state: e.target.value } })
                          }
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Motivo de la consulta (Opcional)
                  </label>
                  <textarea
                    value={motive}
                    onChange={(e) => setMotive(e.target.value)}
                    rows={3}
                    placeholder="Cuéntanos brevemente el motivo de tu visita..."
                    className="w-full mt-1 border border-slate-300 rounded-md p-3 outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                {identityError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {identityError}
                  </div>
                ) : null}

                {identityCandidates.length ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <h3 className="font-semibold text-amber-950">¿Para quién es la cita?</h3>
                    <p className="mt-1 text-sm text-amber-800">
                      Este teléfono tiene relaciones autorizadas. Selecciona explícitamente; no mostraremos
                      información clínica.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {identityCandidates.map((candidate) => (
                        <button
                          key={candidate.patientId}
                          type="button"
                          onClick={() => void choosePatient(candidate)}
                          className="rounded-lg border border-amber-300 bg-white px-4 py-3 text-left transition hover:border-amber-500 hover:bg-amber-100"
                        >
                          <span className="block text-sm font-semibold text-slate-900">
                            {candidate.displayName ?? candidate.maskedName}
                          </span>
                          {candidate.relationship || candidate.ageReference ? (
                            <span className="block text-xs text-slate-500">
                              {[candidate.relationship, candidate.ageReference].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                          <span className="block text-xs text-slate-500">
                            {candidate.relationship === "FAMILY"
                              ? "Integrante autorizado"
                              : "Coincidencia verificada"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto px-10 h-12 text-base font-semibold"
                    disabled={mutation.isPending || resolvingIdentity || identityCandidates.length > 0}
                  >
                    {mutation.isPending
                      ? "Confirmando reserva..."
                      : resolvingIdentity
                        ? "Verificando identidad..."
                        : "Confirmar Reserva"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in-95">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 text-green-600 mb-6">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-slate-800">¡Reserva Confirmada!</h2>
              <p className="text-slate-600 max-w-md mx-auto text-lg mt-4">
                {config.confirmationMessage ||
                  "Tu cita ha sido agendada con éxito. Hemos enviado un correo con los detalles."}
              </p>

              {config.redirectUrl && (
                <div className="mt-10">
                  <a
                    href={config.redirectUrl}
                    className="inline-block px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Volver a la página principal
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {config.footerText && (
          <div className="p-5 bg-slate-50 border-t border-slate-200 text-center text-sm text-slate-500 font-medium">
            {config.footerText}
          </div>
        )}
      </div>
    </div>
  );
}
