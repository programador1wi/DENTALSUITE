import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FilePlus2,
  FolderX,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  Search,
  Stethoscope,
  User,
  Users
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import type {
  PatientDetail,
  PatientListItem,
  PatientPayload
} from "@/features/patients/services/patients.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import {
  useSpecialties,
  useSpecialtyAppointmentReasons
} from "@/features/settings/specialties/hooks/use-specialties";
import { usePatientSearch } from "@/features/patients/hooks/use-patients";
import {
  usePatientFieldContext,
  getVisibleFormFields,
  getRequiredFormFields
} from "@/features/patients/config/patient-field-settings";
import { specialtyMatchesSelection } from "@/features/settings/specialties/utils/allowed-specialties";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import { useAgreements } from "@/features/settings/admin-workflows/hooks/use-admin-workflows";
import type {
  CreateTreatmentPlanPayload,
  TreatmentPlan
} from "@/features/treatments/services/treatments.service";
import {
  getAvailability,
  listAppointments,
  type Appointment,
  type AttendanceMode,
  type AppointmentPayload,
  type AppointmentStatus
} from "../services/appointments.service";

type FormState = {
  branchId: string;
  specialtyId: string;
  patientId: string;
  professionalId: string;
  chairId: string;
  chairIndex: number;
  allowOverbooking: boolean;
  attendanceMode: AttendanceMode;
  title: string;
  reason: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  durationMinutes: string;
  notes: string;
};

type NewPatientState = {
  firstName: string;
  socialName: string;
  lastName: string;
  agreementId: string;
  internalNumber: string;
  birthDate: string;
  sex: string;
  gender: string;
  email: string;
  phone: string;
  alternatePhone: string;
  documentType: string;
  documentNumber: string;
  occupation: string;
  employer: string;
  observations: string;
  referredBy: string;
  status: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  emergencyName: string;
  emergencySocialName: string;
  emergencyDocumentNumber: string;
  emergencyGender: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyEmail: string;
  comment: string;
};

type SelectedSlot = {
  startAt: string;
  endAt: string;
};

export type AppointmentSubmitOptions = {
  notifyByEmail?: boolean;
};

type DayAvailability = {
  day: ReturnType<typeof buildWeekDays>[number];
  slots: Array<{ startAt: string; endAt: string; available: boolean }>;
  error?: string;
};

type Step = "schedule" | "reason" | "patient";
type PatientMode = "existing" | "new";
type TreatmentPlanChoice = "existing" | "new";
type ReasonOption = {
  id: string;
  name: string;
  durationMinutes: number;
  color?: string | null;
  isActive: boolean;
};

const MAX_REASON_DURATION_MINUTES = 60;
const PATIENT_DAILY_LIMIT_FREE_STATUSES: AppointmentStatus[] = [
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "CANCELLED_CONFLICT",
  "CANCELLED_RESCHEDULED",
  "NO_SHOW",
  "RESCHEDULED"
];

const defaultForm: FormState = {
  branchId: "",
  specialtyId: "",
  patientId: "",
  professionalId: "",
  chairId: "",
  chairIndex: 1,
  allowOverbooking: false,
  attendanceMode: "PRESENTIAL",
  title: "",
  reason: "",
  status: "SCHEDULED",
  startAt: "",
  endAt: "",
  durationMinutes: "30",
  notes: ""
};

const defaultNewPatient: NewPatientState = {
  firstName: "",
  socialName: "",
  lastName: "",
  agreementId: "",
  internalNumber: "",
  birthDate: "",
  sex: "",
  gender: "",
  email: "",
  phone: "",
  alternatePhone: "",
  documentType: "",
  documentNumber: "",
  occupation: "",
  employer: "",
  observations: "",
  referredBy: "",
  status: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  emergencyName: "",
  emergencySocialName: "",
  emergencyDocumentNumber: "",
  emergencyGender: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyEmail: "",
  comment: ""
};

function hasNewPatientFieldValue(patient: NewPatientState, field: string) {
  const value = patient[field as keyof NewPatientState];
  return typeof value === "string" && value.trim().length > 0;
}

export const SAME_DAY_APPOINTMENT_MESSAGE =
  'Sólo puede agendar una cita por día para el mismo paciente. Si desea darle mas duración, hágalo desde el menu "Duración" al lado izquierdo de esta agenda.';

const localDayFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function appointmentLocalDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return localDayFormatter.format(date);
}

export function isSameAppointmentLocalDay(left: string, right: string) {
  const leftKey = appointmentLocalDayKey(left);
  const rightKey = appointmentLocalDayKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function AppointmentModal({
  open,
  appointment,
  initialValues,
  defaultDate,
  branches,
  professionals,
  chairs,
  patients,
  onClose,
  onSubmit,
  onCreatePatient,
  onCreateTreatmentPlan,
  multipleMode = false
}: {
  open: boolean;
  appointment?: Appointment | null;
  initialValues?: Partial<AppointmentPayload> | null;
  defaultDate?: string;
  branches: Branch[];
  professionals: Professional[];
  chairs: Chair[];
  patients: PatientListItem[];
  onClose: () => void;
  onSubmit: (payloads: AppointmentPayload[], options?: AppointmentSubmitOptions) => Promise<void>;
  onCreatePatient: (payload: PatientPayload) => Promise<PatientDetail>;
  onCreateTreatmentPlan: (payload: CreateTreatmentPlanPayload) => Promise<{ id: string }>;
  multipleMode?: boolean;
}) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [weekStart, setWeekStart] = useState(() => getWeekStartDateInput(toDateInputValue(new Date())));
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [step, setStep] = useState<Step>("reason");
  const [patientMode, setPatientMode] = useState<PatientMode>("existing");
  const [patientSearch, setPatientSearch] = useState("");
  const [reasonSearch, setReasonSearch] = useState("");
  const [newPatient, setNewPatient] = useState<NewPatientState>(defaultNewPatient);
  const [submitting, setSubmitting] = useState(false);
  const [bookingProblems, setBookingProblems] = useState<string[]>([]);
  const [treatmentPlanChoice, setTreatmentPlanChoice] = useState<TreatmentPlanChoice>("new");
  const [selectedTreatmentPlanId, setSelectedTreatmentPlanId] = useState("");
  const [lockedScheduleContext, setLockedScheduleContext] = useState(false);
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState("");

  const appointmentConfig = usePatientFieldContext("appointment");
  const visibleAppointmentFields = useMemo(
    () => getVisibleFormFields(appointmentConfig),
    [appointmentConfig]
  );
  const requiredAppointmentFields = useMemo(
    () => getRequiredFormFields(appointmentConfig),
    [appointmentConfig]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [patientSearch]);

  const patientSearchQuery = usePatientSearch({
    q: debouncedPatientSearch.length >= 2 ? debouncedPatientSearch : ""
  });

  const { hasPermission } = usePermissions();
  const canReadTreatmentPlans = hasPermission("treatment_plans.read") || hasPermission("system.manage_all");
  const canCreateTreatmentPlans =
    hasPermission("treatment_plans.create") || hasPermission("system.manage_all");
  const specialties = useSpecialties(undefined, "true");
  const reasons = useSpecialtyAppointmentReasons(form.specialtyId);
  const selectedSlotsLookupRange = useMemo(
    () => buildSelectedSlotsLookupRange(selectedSlots),
    [selectedSlots]
  );

  useEffect(() => {
    if (!open) return;
    const nextForm = appointment ? toFormFromAppointment(appointment) : toFormDefaults(initialValues);
    const initialDate = nextForm.startAt
      ? nextForm.startAt.slice(0, 10)
      : defaultDate || toDateInputValue(new Date());
    setForm(nextForm);
    setSelectedSlots(
      nextForm.startAt && nextForm.endAt
        ? [
            {
              startAt: new Date(nextForm.startAt).toISOString(),
              endAt: new Date(nextForm.endAt).toISOString()
            }
          ]
        : []
    );
    setWeekStart(getWeekStartDateInput(initialDate));
    setStep("reason");
    setPatientMode("existing");
    setPatientSearch("");
    setReasonSearch(nextForm.reason);
    setNewPatient(defaultNewPatient);
    setBookingProblems([]);
    setLockedScheduleContext(
      Boolean(
        !appointment && nextForm.branchId && nextForm.professionalId && nextForm.startAt && nextForm.endAt
      )
    );
    setSelectedTreatmentPlanId(appointment?.treatmentPlanId ?? initialValues?.treatmentPlanId ?? "");
    setTreatmentPlanChoice(
      (appointment?.treatmentPlanId ?? initialValues?.treatmentPlanId) ? "existing" : "new"
    );
    setNotifyByEmail(false);
  }, [appointment, defaultDate, initialValues, open]);

  useEffect(() => {
    if (!open || !lockedScheduleContext || form.specialtyId || !form.professionalId) return;
    const professional = professionals.find((item) => item.id === form.professionalId);
    const nextSpecialtyId = resolveProfessionalSpecialtyId(professional, "", null);
    if (!nextSpecialtyId) return;
    setForm((prev) => ({ ...prev, specialtyId: nextSpecialtyId }));
  }, [form.professionalId, form.specialtyId, lockedScheduleContext, open, professionals]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === form.branchId),
    [branches, form.branchId]
  );
  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === form.professionalId),
    [professionals, form.professionalId]
  );
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === form.patientId),
    [patients, form.patientId]
  );
  const notificationEmail = (
    patientMode === "new" ? newPatient.email : (selectedPatient?.email ?? "")
  ).trim();
  const canNotifyByEmail = requiresClinicalPatient(form.status) && Boolean(notificationEmail);
  useEffect(() => {
    if (!canNotifyByEmail && notifyByEmail) setNotifyByEmail(false);
  }, [canNotifyByEmail, notifyByEmail]);
  const selectedSpecialty = useMemo(
    () =>
      (specialties.data ?? []).find((specialty) => specialty.id === form.specialtyId) ??
      appointment?.specialty ??
      null,
    [appointment?.specialty, form.specialtyId, specialties.data]
  );
  const shouldLoadTreatmentPlans = Boolean(
    open &&
    canReadTreatmentPlans &&
    patientMode === "existing" &&
    requiresClinicalPatient(form.status) &&
    form.patientId
  );
  const treatmentPlans = useTreatmentPlans(
    { patientId: form.patientId || undefined },
    shouldLoadTreatmentPlans
  );
  const shouldLoadPatientDayAppointments = Boolean(
    open &&
    requiresClinicalPatient(form.status) &&
    patientMode === "existing" &&
    form.branchId &&
    form.patientId &&
    selectedSlotsLookupRange
  );
  const patientDayAppointments = useQuery({
    queryKey: [
      "appointments",
      "patient-day-limit",
      form.branchId,
      form.patientId,
      selectedSlotsLookupRange?.start ?? "",
      selectedSlotsLookupRange?.end ?? ""
    ],
    queryFn: () =>
      listAppointments({
        branchId: form.branchId,
        patientId: form.patientId,
        start: selectedSlotsLookupRange!.start,
        end: selectedSlotsLookupRange!.end
      }),
    enabled: shouldLoadPatientDayAppointments
  });
  const selectedProfessionalBranch = useMemo(
    () =>
      selectedProfessional?.branches?.find(
        (branch) =>
          branch.id === form.branchId &&
          isBranchAssignmentActiveAt(branch, selectedSlots[0]?.startAt ?? form.startAt)
      ) ?? null,
    [selectedProfessional, form.branchId, form.startAt, selectedSlots]
  );
  const appointmentIntervalMinutes =
    selectedProfessionalBranch?.agendaSlotMinutes ?? selectedBranch?.agendaSlotMinutes ?? 30;
  const fallbackDuration =
    selectedProfessionalBranch?.defaultAppointmentDurationMinutes ?? appointmentIntervalMinutes;
  const rawDuration = Number(form.durationMinutes);
  const selectedDuration =
    Number.isInteger(rawDuration) && rawDuration > 0
      ? Math.ceil(rawDuration / appointmentIntervalMinutes) * appointmentIntervalMinutes
      : rawDuration;
  const durationAvailabilityError = "";

  useEffect(() => {
    if (!open) return;
    if (form.durationMinutes) return;
    setForm((prev) => ({ ...prev, durationMinutes: String(fallbackDuration) }));
  }, [fallbackDuration, form.durationMinutes, open]);

  const filteredChairs = useMemo(
    () => chairs.filter((chair) => !form.branchId || chair.branchId === form.branchId),
    [chairs, form.branchId]
  );
  const filteredPatients = useMemo(
    () => patients.filter((patient) => !form.branchId || patient.branchId === form.branchId),
    [patients, form.branchId]
  );
  const filteredProfessionals = useMemo(
    () =>
      professionals.filter((professional) => {
        const isInBranch =
          !form.branchId ||
          professional.branches.some(
            (branch) =>
              branch.id === form.branchId &&
              isBranchAssignmentActiveAt(branch, selectedSlots[0]?.startAt ?? form.startAt)
          );
        const matchesSpecialty =
          !form.specialtyId ||
          professional.specialties.some((specialty) =>
            specialtyMatchesSelection(specialty, form.specialtyId, selectedSpecialty)
          );
        return isInBranch && matchesSpecialty;
      }),
    [form.branchId, form.specialtyId, form.startAt, professionals, selectedSlots, selectedSpecialty]
  );

  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const selectedProfessionalIsAvailable = filteredProfessionals.some(
    (professional) => professional.id === form.professionalId
  );
  const availability = useQuery({
    queryKey: [
      "appointments",
      "availability-week",
      form.branchId,
      form.professionalId,
      form.chairId,
      form.chairIndex,
      selectedDuration,
      weekStart,
      appointment?.id
    ],
    queryFn: async () => {
      const rows = await Promise.all(
        days.map(async (day): Promise<DayAvailability> => {
          const professionalBranchForDay = selectedProfessional?.branches.find(
            (branch) =>
              branch.id === form.branchId && isBranchAssignmentActiveAt(branch, `${day.date}T00:00:00`)
          );
          if (!professionalBranchForDay) {
            return {
              day,
              slots: [],
              error: "Doctor no activo en esta fecha"
            };
          }

          try {
            return {
              day,
              slots: (
                await getAvailability({
                  branchId: form.branchId,
                  professionalId: form.professionalId,
                  chairId: form.chairId || undefined,
                  chairIndex: String(form.chairIndex),
                  date: day.date,
                  durationMinutes: String(selectedDuration),
                  excludeAppointmentId: appointment?.id
                })
              ).slots
            };
          } catch (error) {
            return {
              day,
              slots: [],
              error: error instanceof Error ? error.message : "No se pudo consultar disponibilidad"
            };
          }
        })
      );
      return rows;
    },
    enabled: Boolean(
      open &&
      form.branchId &&
      form.professionalId &&
      selectedProfessionalIsAvailable &&
      selectedDuration &&
      !durationAvailabilityError
    )
  });

  const activeReasons = useMemo(
    () =>
      (reasons.data ?? []).filter(
        (reason) => reason.isActive && reason.durationMinutes <= MAX_REASON_DURATION_MINUTES
      ),
    [reasons.data]
  );
  const selectedReason = useMemo(
    () => activeReasons.find((reason) => reason.name === form.reason),
    [activeReasons, form.reason]
  );
  const requiresPatient = form.status !== "BLOCKED";
  const visibleTreatmentPlans = useMemo(
    () => (shouldLoadTreatmentPlans ? (treatmentPlans.data ?? []) : []),
    [shouldLoadTreatmentPlans, treatmentPlans.data]
  );
  const selectableTreatmentPlans = useMemo(
    () => visibleTreatmentPlans.filter((plan) => isSelectableTreatmentPlan(plan)),
    [visibleTreatmentPlans]
  );
  const currentProfessionalTreatmentPlans = useMemo(
    () => selectableTreatmentPlans.filter((plan) => plan.professional.id === form.professionalId),
    [form.professionalId, selectableTreatmentPlans]
  );
  const otherProfessionalTreatmentPlans = useMemo(
    () => selectableTreatmentPlans.filter((plan) => plan.professional.id !== form.professionalId),
    [form.professionalId, selectableTreatmentPlans]
  );
  const historicalTreatmentPlans = useMemo(
    () => visibleTreatmentPlans.filter((plan) => !isSelectableTreatmentPlan(plan)),
    [visibleTreatmentPlans]
  );
  const patientDayConflict = useMemo(() => {
    if (!shouldLoadPatientDayAppointments) return null;
    return (
      (patientDayAppointments.data ?? []).find((item) => {
        if (item.id === appointment?.id) return false;
        if (!appointmentCountsAgainstPatientDailyLimit(item)) return false;
        return selectedSlots.some((slot) => isSameAppointmentLocalDay(item.startAt, slot.startAt));
      }) ?? null
    );
  }, [appointment?.id, patientDayAppointments.data, selectedSlots, shouldLoadPatientDayAppointments]);
  const patientDayConflictLoading = Boolean(
    shouldLoadPatientDayAppointments && patientDayAppointments.isFetching
  );
  const needsTreatmentPlanDecision = Boolean(
    requiresPatient &&
    patientMode === "existing" &&
    form.patientId &&
    canReadTreatmentPlans &&
    !treatmentPlans.isLoading &&
    (selectableTreatmentPlans.length > 0 || canCreateTreatmentPlans)
  );
  const hasTreatmentPlanDecision =
    !needsTreatmentPlanDecision ||
    treatmentPlanChoice === "new" ||
    (treatmentPlanChoice === "existing" &&
      selectableTreatmentPlans.some((plan) => plan.id === selectedTreatmentPlanId));
  const canContinueReason = Boolean(form.branchId && form.specialtyId && selectedReason);
  const canContinueSchedule = Boolean(
    canContinueReason && form.professionalId && selectedProfessionalIsAvailable && selectedSlots.length > 0
  );
  const scheduleResolvedFromContext = Boolean(
    lockedScheduleContext &&
    form.professionalId &&
    selectedProfessionalIsAvailable &&
    selectedSlots.length > 0
  );
  const canSubmitPatient =
    canContinueSchedule &&
    !patientDayConflict &&
    !patientDayConflictLoading &&
    !treatmentPlans.isLoading &&
    hasTreatmentPlanDecision &&
    (!requiresPatient ||
      (patientMode === "existing" && Boolean(form.patientId)) ||
      (patientMode === "new" &&
        newPatient.firstName.trim().length >= 2 &&
        newPatient.lastName.trim().length >= 2 &&
        Array.from(requiredAppointmentFields).every((field) => hasNewPatientFieldValue(newPatient, field))));

  const searchedPatients = useMemo(() => {
    const query = normalizeSearch(patientSearch);
    if (!query) return [];

    const localMatches = filteredPatients
      .filter((patient) =>
        normalizeSearch(
          `${patient.firstName} ${patient.lastName} ${patient.documentNumber ?? ""} ${patient.phone ?? ""} ${patient.email ?? ""}`
        ).includes(query)
      )
      .slice(0, 12);

    const remoteMatches = patientSearchQuery.data ?? [];
    const all = [...localMatches];

    for (const remote of remoteMatches) {
      if (!all.some((p) => p.id === remote.id)) {
        all.push(remote);
      }
    }

    return all.slice(0, 12);
  }, [filteredPatients, patientSearch, patientSearchQuery.data]);

  useEffect(() => {
    if (!open) return;
    if (!requiresPatient || patientMode !== "existing" || !form.patientId) {
      setSelectedTreatmentPlanId("");
      setTreatmentPlanChoice("new");
      return;
    }
    if (!canReadTreatmentPlans || treatmentPlans.isLoading) return;
    if (
      treatmentPlanChoice === "existing" &&
      selectableTreatmentPlans.some((plan) => plan.id === selectedTreatmentPlanId)
    ) {
      return;
    }

    const preferredPlan = currentProfessionalTreatmentPlans[0];
    if (preferredPlan) {
      setTreatmentPlanChoice("existing");
      setSelectedTreatmentPlanId(preferredPlan.id);
      return;
    }

    if (canCreateTreatmentPlans) {
      setTreatmentPlanChoice("new");
      setSelectedTreatmentPlanId("");
      return;
    }

    const fallbackPlan = selectableTreatmentPlans[0];
    if (fallbackPlan) {
      setTreatmentPlanChoice("existing");
      setSelectedTreatmentPlanId(fallbackPlan.id);
      return;
    }

    setTreatmentPlanChoice("new");
    setSelectedTreatmentPlanId("");
  }, [
    canCreateTreatmentPlans,
    canReadTreatmentPlans,
    currentProfessionalTreatmentPlans,
    form.patientId,
    open,
    patientMode,
    requiresPatient,
    selectableTreatmentPlans,
    selectedTreatmentPlanId,
    treatmentPlanChoice,
    treatmentPlans.isLoading
  ]);

  const handleProfessionalChange = (professionalId: string) => {
    const professional = professionals.find((item) => item.id === professionalId);
    const branchAssignment = professional?.branches.find(
      (branch) => branch.id === form.branchId && isBranchAssignmentActiveAt(branch, form.startAt)
    );
    const nextSpecialtyId = resolveProfessionalSpecialtyId(professional, form.specialtyId, selectedSpecialty);
    const nextChairId = resolveChairIdForBranch(filteredChairs, form.chairId);
    const currentDuration = Number(form.durationMinutes);
    const nextDuration =
      selectedReason?.durationMinutes ??
      (Number.isFinite(currentDuration) && currentDuration > 0 ? currentDuration : undefined) ??
      branchAssignment?.defaultAppointmentDurationMinutes ??
      branchAssignment?.agendaSlotMinutes ??
      selectedBranch?.agendaSlotMinutes ??
      30;

    if (nextSpecialtyId !== form.specialtyId) setReasonSearch("");
    setSelectedSlots([]);
    setForm((prev) => ({
      ...prev,
      professionalId,
      specialtyId: nextSpecialtyId,
      chairId: nextChairId,
      durationMinutes: String(nextDuration),
      reason: nextSpecialtyId === prev.specialtyId ? prev.reason : "",
      startAt: "",
      endAt: ""
    }));
  };

  const submit = async () => {
    if (selectedSlots.length === 0 || !canSubmitPatient) return;

    setSubmitting(true);
    try {
      let patientId = form.patientId || undefined;
      let patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "";

      if (requiresPatient && patientMode === "new") {
        const created = await onCreatePatient({
          branchId: form.branchId,
          firstName: newPatient.firstName.trim(),
          socialName: newPatient.socialName.trim() || undefined,
          lastName: newPatient.lastName.trim(),
          agreementId: newPatient.agreementId || undefined,
          internalNumber: newPatient.internalNumber.trim() || undefined,
          birthDate: newPatient.birthDate || undefined,
          sex: newPatient.sex || undefined,
          gender: newPatient.gender || undefined,
          email: newPatient.email.trim() || undefined,
          phone: newPatient.phone.trim() || undefined,
          alternatePhone: newPatient.alternatePhone.trim() || undefined,
          documentType: newPatient.documentType.trim() || undefined,
          documentNumber: newPatient.documentNumber.trim() || undefined,
          occupation: newPatient.occupation.trim() || undefined,
          employer: newPatient.employer.trim() || undefined,
          observations: newPatient.observations.trim() || undefined,
          referredBy: newPatient.referredBy.trim() || undefined,
          status: (newPatient.status || "NEW") as PatientPayload["status"],
          address:
            newPatient.addressStreet || newPatient.addressCity || newPatient.addressState
              ? {
                  street: newPatient.addressStreet.trim() || undefined,
                  city: newPatient.addressCity.trim() || undefined,
                  state: newPatient.addressState.trim() || undefined
                }
              : undefined,
          contacts: newPatient.emergencyName.trim()
            ? [
                {
                  name: newPatient.emergencyName.trim(),
                  socialName: newPatient.emergencySocialName.trim() || undefined,
                  documentNumber: newPatient.emergencyDocumentNumber.trim() || undefined,
                  gender: newPatient.emergencyGender.trim() || undefined,
                  relationship: newPatient.emergencyRelationship.trim() || undefined,
                  phone: newPatient.emergencyPhone.trim() || undefined,
                  email: newPatient.emergencyEmail.trim() || undefined,
                  isEmergencyContact: true
                }
              ]
            : undefined
        });
        patientId = created.id;
        patientName = `${created.firstName} ${created.lastName}`;
      }

      const notes = patientMode === "new" ? newPatient.comment.trim() : form.notes.trim();
      let treatmentPlanId =
        patientMode === "existing" && treatmentPlanChoice === "existing"
          ? selectedTreatmentPlanId || undefined
          : undefined;

      if (
        requiresPatient &&
        patientMode === "existing" &&
        patientId &&
        treatmentPlanChoice === "new" &&
        canCreateTreatmentPlans
      ) {
        const createdPlan = await onCreateTreatmentPlan({
          branchId: form.branchId,
          patientId,
          professionalId: form.professionalId,
          name: "Plan de Tratamiento Inicial",
          status: "DRAFT"
        });
        treatmentPlanId = createdPlan.id;
      }

      const payloads: AppointmentPayload[] = selectedSlots.map((slot) => ({
        branchId: form.branchId,
        patientId: requiresPatient ? patientId : undefined,
        professionalId: form.professionalId,
        chairId: form.chairId || undefined,
        chairIndex: form.chairIndex,
        allowOverbooking: form.allowOverbooking,
        attendanceMode: form.attendanceMode,
        specialtyId: form.specialtyId || undefined,
        title: appointment
          ? form.title || buildAppointmentTitle(patientName, form.reason)
          : buildAppointmentTitle(patientName, form.reason),
        reason: form.reason || undefined,
        ...(appointment ? { status: form.status } : {}),
        startAt: new Date(slot.startAt).toISOString(),
        endAt: new Date(slot.endAt).toISOString(),
        durationMinutes: diffMinutes(slot.startAt, slot.endAt) ?? Number(form.durationMinutes),
        notes: notes || undefined,
        treatmentPlanId
      }));

      await onSubmit(payloads, { notifyByEmail: notifyByEmail && canNotifyByEmail });
      if (notifyByEmail && canNotifyByEmail) {
        toast.success(`Se agendó y se envió el correo a ${patientName || "paciente"}`);
      } else {
        toast.success(appointment ? "Cita actualizada correctamente" : "Cita agendada correctamente");
      }
      onClose();
    } catch (error) {
      setBookingProblems([error instanceof Error ? error.message : "No se pudo guardar la cita."]);
      console.error("Error al agendar:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSlotSelect = (slot: SelectedSlot) => {
    if (appointment || !multipleMode) {
      setSelectedSlots([slot]);
      setForm((prev) => ({
        ...prev,
        startAt: toLocalInput(slot.startAt),
        endAt: toLocalInput(slot.endAt)
      }));
    } else {
      setSelectedSlots((prev) => {
        const index = prev.findIndex((s) => s.startAt === slot.startAt);
        if (index > -1) {
          return prev.filter((_, i) => i !== index);
        }

        const sameDaySlots = prev.filter((selectedSlot) =>
          isSameAppointmentLocalDay(selectedSlot.startAt, slot.startAt)
        );
        if (sameDaySlots.length) {
          const mergeableSlots = sameDaySlots.filter((selectedSlot) =>
            slotsTouchOrOverlap(selectedSlot, slot)
          );
          if (mergeableSlots.length) {
            const mergedSlot = mergeSlots([slot, ...mergeableSlots]);
            const next = [
              ...prev.filter((selectedSlot) => !mergeableSlots.includes(selectedSlot)),
              mergedSlot
            ];
            next.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
            return next;
          }

          setBookingProblems([SAME_DAY_APPOINTMENT_MESSAGE]);
          return prev;
        }

        const next = [...prev, slot];
        next.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        return next;
      });
    }
  };

  const handleReasonSelect = (reason: ReasonOption) => {
    const nextDuration = String(reason.durationMinutes);
    const durationChanged = form.durationMinutes !== nextDuration;
    const lockedStartAt = form.startAt || (selectedSlots[0] ? toLocalInput(selectedSlots[0].startAt) : "");
    const lockedSlot =
      lockedScheduleContext && lockedStartAt
        ? buildSlotFromLocalStart(
            lockedStartAt,
            roundDurationToInterval(reason.durationMinutes, appointmentIntervalMinutes)
          )
        : null;

    if (lockedSlot) {
      setSelectedSlots([lockedSlot]);
    } else if (durationChanged) {
      setSelectedSlots([]);
    }

    setReasonSearch(reason.name);
    setForm((prev) => ({
      ...prev,
      reason: reason.name,
      title: "",
      durationMinutes: nextDuration,
      startAt: lockedSlot ? toLocalInput(lockedSlot.startAt) : durationChanged ? "" : prev.startAt,
      endAt: lockedSlot ? toLocalInput(lockedSlot.endAt) : durationChanged ? "" : prev.endAt
    }));
  };

  const handleReasonSearchChange = (value: string) => {
    setReasonSearch(value);
    if (value !== form.reason) {
      setForm((prev) => ({ ...prev, reason: "", title: "" }));
    }
  };

  const closeOrStepBack = () => {
    if (step === "patient") {
      setStep(scheduleResolvedFromContext ? "reason" : "schedule");
      return;
    }
    if (step === "schedule") {
      setStep("reason");
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal open={open} title={appointment ? "Editar cita" : "Dar cita"} onClose={onClose} size="2xl">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid min-h-[500px] gap-0 lg:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                    Nueva atencion
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">Agenda inteligente</h3>
                </div>
                <div className="rounded-md bg-cyan-50 p-3 text-cyan-700">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>

              <div className="mb-5 rounded-md border border-cyan-100 bg-white px-3 py-2 text-sm text-slate-700">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Sucursal activa
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {selectedBranch?.name ?? "Sin sucursal seleccionada"}
                </p>
              </div>

              <StepRail step={step} />

              <div className="mt-5 grid gap-3">
                <FieldLabel label="Especialidad">
                  <Select
                    value={form.specialtyId}
                    onChange={(event) => {
                      if (!lockedScheduleContext) setSelectedSlots([]);
                      setReasonSearch("");
                      setForm((prev) => ({
                        ...prev,
                        specialtyId: event.target.value,
                        professionalId: lockedScheduleContext ? prev.professionalId : "",
                        reason: "",
                        startAt: lockedScheduleContext ? prev.startAt : "",
                        endAt: lockedScheduleContext ? prev.endAt : ""
                      }));
                    }}
                    disabled={step !== "reason"}
                  >
                    <option value="">Todas las especialidades</option>
                    {(specialties.data ?? []).map((specialty) => (
                      <option key={specialty.id} value={specialty.id}>
                        {specialty.name}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>

                <FieldLabel label="Doctor">
                  <Select
                    value={form.professionalId}
                    onChange={(event) => handleProfessionalChange(event.target.value)}
                    disabled={!canContinueReason || step !== "schedule"}
                  >
                    <option value="">Seleccionar doctor</option>
                    {filteredProfessionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professional.firstName} {professional.lastName}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>

                <FieldLabel label="Recurso / box">
                  <Select
                    value={form.chairId}
                    onChange={(event) => {
                      setSelectedSlots([]);
                      setForm((prev) => ({ ...prev, chairId: event.target.value, startAt: "", endAt: "" }));
                    }}
                    disabled={!canContinueReason || step !== "schedule"}
                  >
                    <option value="">Sin recurso especifico</option>
                    {filteredChairs.map((chair) => (
                      <option key={chair.id} value={chair.id}>
                        {chair.name}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>

                <FieldLabel label="Duracion del motivo">
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                    {selectedReason ? `${selectedReason.durationMinutes} minutos` : "Selecciona motivo"}
                  </div>
                </FieldLabel>
              </div>
            </aside>

            <main className="min-w-0 p-5">
              {step === "reason" ? (
                <ReasonStep
                  activeReasons={activeReasons}
                  form={form}
                  loadingReasons={reasons.isLoading}
                  reasonSearch={reasonSearch}
                  selectedReasonId={selectedReason?.id ?? ""}
                  selectedSlots={selectedSlots}
                  selectedSpecialtyName={selectedSpecialty?.name ?? ""}
                  onBack={closeOrStepBack}
                  onContinue={() => setStep(scheduleResolvedFromContext ? "patient" : "schedule")}
                  onReasonSearchChange={handleReasonSearchChange}
                  onReasonSelect={handleReasonSelect}
                  continueLabel={scheduleResolvedFromContext ? "Continuar a paciente" : "Continuar a horario"}
                />
              ) : step === "schedule" ? (
                <ScheduleStep
                  availability={availability}
                  availabilityError={durationAvailabilityError}
                  canContinue={canContinueSchedule}
                  days={days}
                  form={form}
                  selectedProfessionalIsAvailable={selectedProfessionalIsAvailable}
                  selectedSlots={selectedSlots}
                  weekStart={weekStart}
                  onContinue={() => setStep("patient")}
                  onSelectSlot={handleSlotSelect}
                  onWeekChange={setWeekStart}
                  onRemoveSlot={(slot) =>
                    setSelectedSlots((prev) => prev.filter((s) => s.startAt !== slot.startAt))
                  }
                  multipleMode={multipleMode}
                  selectedDuration={selectedDuration}
                  appointmentIntervalMinutes={appointmentIntervalMinutes}
                />
              ) : (
                <PatientStep
                  canSubmit={canSubmitPatient}
                  filteredPatients={searchedPatients}
                  form={form}
                  mode={patientMode}
                  newPatient={newPatient}
                  patientSearch={patientSearch}
                  requiresPatient={requiresPatient}
                  selectedBranchName={selectedBranch?.name ?? ""}
                  selectedPatient={selectedPatient}
                  selectedProfessional={selectedProfessional}
                  selectedSlots={selectedSlots}
                  patientDayConflict={patientDayConflict}
                  patientDayConflictLoading={patientDayConflictLoading}
                  canCreateTreatmentPlans={canCreateTreatmentPlans}
                  canReadTreatmentPlans={canReadTreatmentPlans}
                  currentProfessionalTreatmentPlans={currentProfessionalTreatmentPlans}
                  historicalTreatmentPlans={historicalTreatmentPlans}
                  otherProfessionalTreatmentPlans={otherProfessionalTreatmentPlans}
                  selectedTreatmentPlanId={selectedTreatmentPlanId}
                  canNotifyByEmail={canNotifyByEmail}
                  notificationEmail={notificationEmail}
                  notifyByEmail={notifyByEmail}
                  submitting={submitting}
                  treatmentPlanChoice={treatmentPlanChoice}
                  treatmentPlansLoading={treatmentPlans.isLoading}
                  onBack={closeOrStepBack}
                  onFormChange={setForm}
                  onModeChange={setPatientMode}
                  onNewPatientChange={setNewPatient}
                  onNotifyByEmailChange={setNotifyByEmail}
                  onPatientSearchChange={setPatientSearch}
                  patientSearchQueryFetching={patientSearchQuery.isFetching}
                  onTreatmentPlanChoiceChange={(choice) => {
                    setTreatmentPlanChoice(choice);
                    if (choice === "new") setSelectedTreatmentPlanId("");
                  }}
                  onTreatmentPlanSelect={(planId) => {
                    setTreatmentPlanChoice("existing");
                    setSelectedTreatmentPlanId(planId);
                  }}
                  onSubmit={() => void submit()}
                />
              )}
            </main>
          </div>
        </div>
      </Modal>
      <BookingProblemsModal
        open={bookingProblems.length > 0}
        problems={bookingProblems}
        onClose={() => setBookingProblems([])}
      />
    </>
  );
}

function StepRail({ step }: { step: Step }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: "reason", label: "Motivo" },
    { id: "schedule", label: "Horario" },
    { id: "patient", label: "Paciente" }
  ];
  const currentIndex = steps.findIndex((item) => item.id === step);

  return (
    <div className="grid gap-2">
      {steps.map((item, index) => {
        const active = item.id === step;
        const complete = index < currentIndex;
        return (
          <div
            key={item.id}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${active ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-600"}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${complete || active ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="font-semibold">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function BookingProblemsModal({
  open,
  problems,
  onClose
}: {
  open: boolean;
  problems: string[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Han ocurrido los siguientes problemas:" onClose={onClose} size="lg">
      <Alert variant="danger" size="sm">
        <ul className="list-disc space-y-1 pl-4">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </Alert>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose} type="button">
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}

function ScheduleStep({
  availability,
  availabilityError,
  canContinue,
  days,
  form,
  selectedProfessionalIsAvailable,
  selectedSlots,
  weekStart,
  onContinue,
  onSelectSlot,
  onWeekChange,
  onRemoveSlot,
  multipleMode = false,
  selectedDuration,
  appointmentIntervalMinutes
}: {
  availability: ReturnType<typeof useQuery<DayAvailability[]>>;
  availabilityError?: string;
  canContinue: boolean;
  days: ReturnType<typeof buildWeekDays>;
  form: FormState;
  selectedProfessionalIsAvailable: boolean;
  selectedSlots: SelectedSlot[];
  weekStart: string;
  onContinue: () => void;
  onSelectSlot: (slot: SelectedSlot) => void;
  onWeekChange: (value: string) => void;
  onRemoveSlot: (slot: SelectedSlot) => void;
  multipleMode?: boolean;
  selectedDuration: number;
  appointmentIntervalMinutes: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Horarios libres</p>
          <h4 className="text-lg font-semibold text-slate-950">{formatWeekRange(days)}</h4>
          <p className="text-xs text-slate-500">
            Duración requerida: {selectedDuration} minutos
            {Number(form.durationMinutes) !== selectedDuration && (
              <span className="text-cyan-700 font-semibold ml-1">
                (ajustado de {form.durationMinutes} min para calzar con intervalos de{" "}
                {appointmentIntervalMinutes} min)
              </span>
            )}
          </p>
          {availabilityError ? (
            <p className="mt-1 text-xs font-semibold text-red-600">{availabilityError}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onWeekChange(shiftDate(weekStart, -7))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
            Semana anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onWeekChange(shiftDate(weekStart, 7))}
            type="button"
          >
            Semana siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {days.map((day) => {
          const dayAvailability = availability.data?.find((item) => item.day.date === day.date);
          return (
            <section key={day.date} className="min-h-[280px] rounded-md border border-slate-200 bg-white">
              <div className={`border-b border-slate-100 px-3 py-2.5 ${day.isToday ? "bg-cyan-50" : ""}`}>
                <p className="text-center text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  {day.weekday}
                </p>
                <p className="text-center text-base font-bold text-slate-950 leading-tight">{day.day}</p>
                <p className="text-center text-[10px] text-slate-500">{day.month}</p>
              </div>
              <div className="max-h-[200px] space-y-1 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                {availabilityError ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Duracion invalida" />
                ) : !form.branchId || !form.professionalId || !selectedProfessionalIsAvailable ? (
                  <EmptyColumn icon={<Stethoscope className="h-4 w-4" />} text="Elige doctor" />
                ) : availability.isLoading ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4 animate-pulse" />} text="Buscando" />
                ) : dayAvailability?.error ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="No activo" />
                ) : !dayAvailability?.slots.some((slot) => slot.available) ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Sin horario" />
                ) : (
                  dayAvailability.slots
                    .filter((slot) => slot.available)
                    .map((slot) => {
                      const selected = selectedSlots.some((selectedSlot) =>
                        slotInsideSelectedRange(selectedSlot, slot)
                      );
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => onSelectSlot({ startAt: slot.startAt, endAt: slot.endAt })}
                          className={`flex w-full items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                            selected
                              ? "bg-cyan-700 border-cyan-700 text-white shadow-sm font-semibold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          {selected ? <Check className="h-3 w-3 stroke-[2.5]" /> : null}
                          {formatTime(slot.startAt)}
                        </button>
                      );
                    })
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <div className="rounded-md bg-slate-100 p-2 text-slate-700 mt-1">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-950 text-sm">
                {!multipleMode && selectedSlots.length > 0
                  ? formatSelectedSlot(selectedSlots[0])
                  : selectedSlots.length === 0
                    ? "0 horas seleccionadas"
                    : `${selectedSlots.length} hora(s) seleccionada(s)`}
              </p>
              <p className="text-xs text-slate-500">
                {selectedSlots.length === 0
                  ? "Selecciona un horario libre para continuar con el paciente."
                  : !multipleMode
                    ? "Presiona continuar para asignar el paciente."
                    : "Puedes cambiar de semana usando los controles de arriba para seleccionar más horarios."}
              </p>
            </div>
          </div>
          <Button onClick={onContinue} disabled={!canContinue} type="button" className="sm:self-center">
            Continuar
          </Button>
        </div>

        {multipleMode && selectedSlots.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Carrito de horarios seleccionados
            </p>
            <div className="flex flex-wrap gap-2 max-h-[85px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
              {selectedSlots.map((slot) => {
                const start = new Date(slot.startAt);
                const dayName = start.toLocaleDateString("es-MX", { weekday: "short" });
                const dayNum = start.getDate();
                const monthName = start.toLocaleDateString("es-MX", { month: "short" });
                return (
                  <span
                    key={slot.startAt}
                    className="inline-flex items-center gap-1.5 rounded bg-cyan-50 border border-cyan-100 pl-2.5 pr-1.5 py-1 text-xs font-semibold text-cyan-800"
                  >
                    {dayName} {dayNum} {monthName} - {formatTime(slot.startAt)}
                    <button
                      type="button"
                      onClick={() => onRemoveSlot(slot)}
                      className="text-cyan-600 hover:text-cyan-900 rounded hover:bg-cyan-100 p-0.5 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReasonStep({
  activeReasons,
  form,
  loadingReasons,
  reasonSearch,
  selectedReasonId,
  selectedSlots,
  selectedSpecialtyName,
  onBack,
  onContinue,
  onReasonSearchChange,
  onReasonSelect,
  continueLabel = "Continuar a horario"
}: {
  activeReasons: ReasonOption[];
  form: FormState;
  loadingReasons: boolean;
  reasonSearch: string;
  selectedReasonId: string;
  selectedSlots: SelectedSlot[];
  selectedSpecialtyName: string;
  onBack: () => void;
  onContinue: () => void;
  onReasonSearchChange: (value: string) => void;
  onReasonSelect: (reason: ReasonOption) => void;
  continueLabel?: string;
}) {
  const normalizedSearch = normalizeReasonKey(reasonSearch);
  const filteredReasons = normalizedSearch
    ? activeReasons.filter((reason) =>
        normalizeReasonKey(`${reason.name} ${reason.durationMinutes}`).includes(normalizedSearch)
      )
    : activeReasons;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-50 p-3 text-emerald-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Motivo / tratamiento
              </p>
              <h4 className="text-xl font-semibold text-slate-950">
                {selectedSpecialtyName || "Especialidad del doctor"}
              </h4>
            </div>
          </div>
          <div className="hidden rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-right text-sm text-cyan-900 sm:block">
            {selectedSlots.length > 0
              ? selectedSlots.length === 1
                ? formatSelectedSlot(selectedSlots[0])
                : `${selectedSlots.length} citas seleccionadas`
              : "Horario pendiente"}
          </div>
        </div>

        <FieldLabel label="Motivo">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="relative border-b border-slate-100 p-3">
              <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder={
                  form.specialtyId ? "Buscar motivo existente" : "Primero selecciona una especialidad..."
                }
                value={reasonSearch}
                onChange={(event) => onReasonSearchChange(event.target.value)}
                disabled={!form.specialtyId}
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto p-2">
              {loadingReasons ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Cargando motivos de esta especialidad...
                </div>
              ) : !form.specialtyId ? (
                <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm text-slate-600">
                  <div className="flex flex-col items-center justify-center text-center py-2">
                    <span className="font-semibold text-amber-800">Selecciona una especialidad primero</span>
                    <span className="text-xs text-slate-500 mt-1">
                      Debes escoger una especialidad en el panel izquierdo para poder ver y seleccionar un
                      tratamiento.
                    </span>
                  </div>
                </div>
              ) : !activeReasons.length ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay motivos disponibles para esta especialidad.
                </div>
              ) : filteredReasons.length ? (
                <div className="grid gap-1">
                  {filteredReasons.map((reason) => {
                    const selected = selectedReasonId === reason.id;
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => onReasonSelect(reason)}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                          selected
                            ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-950"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{reason.name}</span>
                          <span className="block text-xs text-slate-500">
                            {reason.durationMinutes} min sugeridos
                          </span>
                        </span>
                        {selected ? <Check className="h-4 w-4 shrink-0 text-emerald-700" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay coincidencias.
                </div>
              )}
            </div>
          </div>
        </FieldLabel>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBack} type="button">
          Regresar
        </Button>
        <Button onClick={onContinue} disabled={!selectedReasonId || !form.reason.trim()} type="button">
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

function PatientStep({
  canSubmit,
  filteredPatients,
  form,
  mode,
  newPatient,
  patientSearch,
  requiresPatient,
  selectedBranchName,
  selectedPatient,
  selectedProfessional,
  selectedSlots,
  patientDayConflict,
  patientDayConflictLoading,
  canCreateTreatmentPlans,
  canReadTreatmentPlans,
  currentProfessionalTreatmentPlans,
  historicalTreatmentPlans,
  otherProfessionalTreatmentPlans,
  selectedTreatmentPlanId,
  canNotifyByEmail,
  notificationEmail,
  notifyByEmail,
  submitting,
  treatmentPlanChoice,
  treatmentPlansLoading,
  onBack,
  onFormChange,
  onModeChange,
  onNewPatientChange,
  onNotifyByEmailChange,
  onPatientSearchChange,
  patientSearchQueryFetching,
  onTreatmentPlanChoiceChange,
  onTreatmentPlanSelect,
  onSubmit
}: {
  canSubmit: boolean;
  filteredPatients: PatientListItem[];
  form: FormState;
  mode: PatientMode;
  newPatient: NewPatientState;
  patientSearch: string;
  requiresPatient: boolean;
  selectedBranchName: string;
  selectedPatient?: PatientListItem;
  selectedProfessional?: Professional;
  selectedSlots: SelectedSlot[];
  patientDayConflict?: Appointment | null;
  patientDayConflictLoading: boolean;
  canCreateTreatmentPlans: boolean;
  canReadTreatmentPlans: boolean;
  currentProfessionalTreatmentPlans: TreatmentPlan[];
  historicalTreatmentPlans: TreatmentPlan[];
  otherProfessionalTreatmentPlans: TreatmentPlan[];
  selectedTreatmentPlanId: string;
  canNotifyByEmail: boolean;
  notificationEmail: string;
  notifyByEmail: boolean;
  submitting: boolean;
  treatmentPlanChoice: TreatmentPlanChoice;
  treatmentPlansLoading: boolean;
  onBack: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<FormState>>;
  onModeChange: (mode: PatientMode) => void;
  onNewPatientChange: React.Dispatch<React.SetStateAction<NewPatientState>>;
  onNotifyByEmailChange: (checked: boolean) => void;
  onPatientSearchChange: (value: string) => void;
  patientSearchQueryFetching: boolean;
  onTreatmentPlanChoiceChange: (choice: TreatmentPlanChoice) => void;
  onTreatmentPlanSelect: (planId: string) => void;
  onSubmit?: () => void;
}) {
  const appointmentConfig = usePatientFieldContext("appointment");
  const visibleAppointmentFields = useMemo(
    () => getVisibleFormFields(appointmentConfig),
    [appointmentConfig]
  );
  const requiredAppointmentFields = useMemo(
    () => getRequiredFormFields(appointmentConfig),
    [appointmentConfig]
  );
  const agreementsQuery = useAgreements(undefined, "true", visibleAppointmentFields.has("agreementId"));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <p className="font-semibold">
          {selectedSlots.length === 1 ? "Cita seleccionada" : "Citas seleccionadas"}
        </p>
        <div className="mt-1 space-y-1">
          {selectedSlots.map((slot, index) => (
            <p key={index} className="text-xs">
              • {formatSelectedSlot(slot)}
            </p>
          ))}
          <p className="mt-1 text-xs">
            {selectedProfessional
              ? `con ${selectedProfessional.firstName} ${selectedProfessional.lastName}`
              : ""}
            {selectedBranchName ? ` en ${selectedBranchName}` : ""}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-emerald-200 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <label
            className={`inline-flex items-center gap-2 text-xs font-semibold ${
              canNotifyByEmail ? "text-emerald-950" : "text-slate-400"
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:cursor-not-allowed"
              checked={notifyByEmail}
              disabled={!canNotifyByEmail || submitting}
              onChange={(event) => onNotifyByEmailChange(event.target.checked)}
            />
            <span>Notificar por correo</span>
          </label>
          {!canNotifyByEmail && requiresPatient ? (
            <span className="text-xs font-medium text-amber-700">
              Agrega un e-mail del paciente para enviar la confirmacion.
            </span>
          ) : notificationEmail ? (
            <span className="text-xs font-medium text-emerald-800">Se enviara a {notificationEmail}</span>
          ) : null}
        </div>
        <p className="mt-1 text-emerald-800 font-semibold">Motivo: {form.reason}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <button
            type="button"
            className={`mb-2 flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left text-sm font-semibold ${mode === "existing" ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-700"}`}
            onClick={() => onModeChange("existing")}
          >
            <span
              className={`h-3 w-3 rounded-full border ${mode === "existing" ? "border-cyan-700 bg-cyan-700" : "border-slate-300"}`}
            />
            Paciente existente
          </button>
          <button
            type="button"
            className={`flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left text-sm font-semibold ${mode === "new" ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-700"}`}
            onClick={() => onModeChange("new")}
          >
            <span
              className={`h-3 w-3 rounded-full border ${mode === "new" ? "border-cyan-700 bg-cyan-700" : "border-slate-300"}`}
            />
            Paciente nuevo
          </button>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5">
          {!requiresPatient ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Esta cita esta marcada como bloqueo. Puedes guardar sin paciente.
            </div>
          ) : mode === "existing" ? (
            <div className="grid gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre, documento, telefono o correo"
                  value={patientSearch}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    onPatientSearchChange(newValue);
                    if (
                      selectedPatient &&
                      newValue !== `${selectedPatient.firstName} ${selectedPatient.lastName}`
                    ) {
                      onFormChange((prev) => ({ ...prev, patientId: "" }));
                    }
                  }}
                />
                {patientSearchQueryFetching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-cyan-600" />
                )}
              </div>

              {patientSearch.trim().length > 0 && (
                <div className="max-h-[290px] overflow-y-auto rounded-md border border-slate-200">
                  {filteredPatients.length ? (
                    filteredPatients.map((patient) => {
                      const selected = patient.id === form.patientId;
                      return (
                        <button
                          key={patient.id}
                          type="button"
                          className={`grid w-full gap-1 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 ${selected ? "bg-cyan-50" : "bg-white hover:bg-slate-50"}`}
                          onClick={() => {
                            onFormChange((prev) => ({
                              ...prev,
                              patientId: patient.id,
                              title: prev.title || `Cita - ${patient.firstName} ${patient.lastName}`
                            }));
                            onPatientSearchChange(`${patient.firstName} ${patient.lastName}`);
                          }}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-semibold uppercase text-slate-900">
                              {patient.firstName} {patient.lastName}
                            </span>
                            {selected ? <Check className="h-4 w-4 text-cyan-700" /> : null}
                          </span>
                          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {patient.phone || "Sin telefono"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {patient.email || "Sin correo"}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-sm text-slate-500">
                      No hay pacientes para la busqueda en esta sucursal.
                    </div>
                  )}
                </div>
              )}

              {selectedPatient ? (
                <PatientDailyLimitNotice
                  conflict={patientDayConflict ?? null}
                  loading={patientDayConflictLoading}
                />
              ) : null}

              {selectedPatient ? (
                <TreatmentPlanSelector
                  canCreateTreatmentPlans={canCreateTreatmentPlans}
                  canReadTreatmentPlans={canReadTreatmentPlans}
                  currentProfessionalPlans={currentProfessionalTreatmentPlans}
                  historicalPlans={historicalTreatmentPlans}
                  loading={treatmentPlansLoading}
                  otherProfessionalPlans={otherProfessionalTreatmentPlans}
                  selectedPlanId={selectedTreatmentPlanId}
                  selectedProfessionalName={
                    selectedProfessional
                      ? `${selectedProfessional.firstName} ${selectedProfessional.lastName}`
                      : "este profesional"
                  }
                  treatmentPlanChoice={treatmentPlanChoice}
                  onChoiceChange={onTreatmentPlanChoiceChange}
                  onPlanSelect={onTreatmentPlanSelect}
                />
              ) : null}

              <FieldLabel label="Comentario">
                <Textarea
                  rows={3}
                  placeholder="Comentario para la cita"
                  value={form.notes}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </FieldLabel>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleAppointmentFields.has("firstName") && (
                  <FieldLabel label="Nombre legal" required={requiredAppointmentFields.has("firstName")}>
                    <Input
                      value={newPatient.firstName}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, firstName: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("socialName") && (
                  <FieldLabel label="Nombre social" required={requiredAppointmentFields.has("socialName")}>
                    <Input
                      value={newPatient.socialName}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, socialName: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("lastName") && (
                  <FieldLabel label="Apellidos" required={requiredAppointmentFields.has("lastName")}>
                    <Input
                      value={newPatient.lastName}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {visibleAppointmentFields.has("sex") && (
                  <FieldLabel label="Sexo" required={requiredAppointmentFields.has("sex")}>
                    <Select
                      value={newPatient.sex}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, sex: event.target.value }))
                      }
                    >
                      <option value="">Selecciona...</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="INTERSEXUAL">Intersexual</option>
                      <option value="NO_ESPECIFICADO">No especificado</option>
                    </Select>
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("birthDate") && (
                  <FieldLabel label="Fecha nacimiento" required={requiredAppointmentFields.has("birthDate")}>
                    <Input
                      type="date"
                      value={newPatient.birthDate}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, birthDate: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("gender") && (
                  <FieldLabel label="Genero" required={requiredAppointmentFields.has("gender")}>
                    <Select
                      value={newPatient.gender}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, gender: event.target.value }))
                      }
                    >
                      <option value="">Selecciona...</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="OTRO">Otro</option>
                    </Select>
                  </FieldLabel>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {visibleAppointmentFields.has("email") && (
                  <FieldLabel label="E-mail" required={requiredAppointmentFields.has("email")}>
                    <Input
                      type="email"
                      value={newPatient.email}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, email: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("phone") && (
                  <FieldLabel label="Telefono movil" required={requiredAppointmentFields.has("phone")}>
                    <Input
                      placeholder="+52 12221234567"
                      value={newPatient.phone}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, phone: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("alternatePhone") && (
                  <FieldLabel
                    label="Telefono fijo"
                    required={requiredAppointmentFields.has("alternatePhone")}
                  >
                    <Input
                      value={newPatient.alternatePhone}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, alternatePhone: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {visibleAppointmentFields.has("documentType") && (
                  <FieldLabel label="Tipo documento" required={requiredAppointmentFields.has("documentType")}>
                    <Input
                      value={newPatient.documentType}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, documentType: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("documentNumber") && (
                  <FieldLabel label="Documento" required={requiredAppointmentFields.has("documentNumber")}>
                    <Input
                      value={newPatient.documentNumber}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, documentNumber: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("status") && (
                  <FieldLabel label="Tipo" required={requiredAppointmentFields.has("status")}>
                    <Select
                      value={newPatient.status}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, status: event.target.value }))
                      }
                    >
                      <option value="">Selecciona un tipo</option>
                      <option value="NEW">Nuevo</option>
                      <option value="ACTIVE">Activo</option>
                      <option value="IN_TREATMENT">En tratamiento</option>
                    </Select>
                  </FieldLabel>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {visibleAppointmentFields.has("agreementId") && (
                  <FieldLabel label="Convenio" required={requiredAppointmentFields.has("agreementId")}>
                    <Select
                      value={newPatient.agreementId}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, agreementId: event.target.value }))
                      }
                    >
                      <option value="">Sin convenio</option>
                      {(agreementsQuery.data ?? []).map((agreement) => (
                        <option key={agreement.id} value={agreement.id}>
                          {agreement.name}
                        </option>
                      ))}
                    </Select>
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("internalNumber") && (
                  <FieldLabel
                    label="Numero interno"
                    required={requiredAppointmentFields.has("internalNumber")}
                  >
                    <Input
                      value={newPatient.internalNumber}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, internalNumber: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("occupation") && (
                  <FieldLabel
                    label="Actividad o profesion"
                    required={requiredAppointmentFields.has("occupation")}
                  >
                    <Input
                      value={newPatient.occupation}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, occupation: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("employer") && (
                  <FieldLabel label="Empleador" required={requiredAppointmentFields.has("employer")}>
                    <Input
                      value={newPatient.employer}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, employer: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
                {visibleAppointmentFields.has("referredBy") && (
                  <FieldLabel label="Referencia" required={requiredAppointmentFields.has("referredBy")}>
                    <Input
                      value={newPatient.referredBy}
                      onChange={(event) =>
                        onNewPatientChange((prev) => ({ ...prev, referredBy: event.target.value }))
                      }
                    />
                  </FieldLabel>
                )}
              </div>

              {(visibleAppointmentFields.has("addressStreet") ||
                visibleAppointmentFields.has("addressCity") ||
                visibleAppointmentFields.has("addressState")) && (
                <div className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
                  {visibleAppointmentFields.has("addressStreet") && (
                    <FieldLabel label="Direccion" required={requiredAppointmentFields.has("addressStreet")}>
                      <Input
                        value={newPatient.addressStreet}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, addressStreet: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("addressCity") && (
                    <FieldLabel label="Ciudad" required={requiredAppointmentFields.has("addressCity")}>
                      <Input
                        value={newPatient.addressCity}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, addressCity: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("addressState") && (
                    <FieldLabel label="Delegacion" required={requiredAppointmentFields.has("addressState")}>
                      <Input
                        value={newPatient.addressState}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, addressState: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                </div>
              )}

              {(visibleAppointmentFields.has("emergencyName") ||
                visibleAppointmentFields.has("emergencySocialName") ||
                visibleAppointmentFields.has("emergencyDocumentNumber") ||
                visibleAppointmentFields.has("emergencyGender") ||
                visibleAppointmentFields.has("emergencyRelationship") ||
                visibleAppointmentFields.has("emergencyPhone") ||
                visibleAppointmentFields.has("emergencyEmail")) && (
                <div className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
                  {visibleAppointmentFields.has("emergencyName") && (
                    <FieldLabel label="Apoderado" required={requiredAppointmentFields.has("emergencyName")}>
                      <Input
                        value={newPatient.emergencyName}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, emergencyName: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("emergencySocialName") && (
                    <FieldLabel
                      label="Nombre social tutor"
                      required={requiredAppointmentFields.has("emergencySocialName")}
                    >
                      <Input
                        value={newPatient.emergencySocialName}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, emergencySocialName: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("emergencyDocumentNumber") && (
                    <FieldLabel
                      label="CURP/RFC tutor legal"
                      required={requiredAppointmentFields.has("emergencyDocumentNumber")}
                    >
                      <Input
                        value={newPatient.emergencyDocumentNumber}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({
                            ...prev,
                            emergencyDocumentNumber: event.target.value
                          }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("emergencyGender") && (
                    <FieldLabel
                      label="Genero tutor"
                      required={requiredAppointmentFields.has("emergencyGender")}
                    >
                      <Input
                        value={newPatient.emergencyGender}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, emergencyGender: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("emergencyRelationship") && (
                    <FieldLabel
                      label="Relacion"
                      required={requiredAppointmentFields.has("emergencyRelationship")}
                    >
                      <Input
                        value={newPatient.emergencyRelationship}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({
                            ...prev,
                            emergencyRelationship: event.target.value
                          }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("emergencyPhone") && (
                    <FieldLabel
                      label="Telefono apoderado"
                      required={requiredAppointmentFields.has("emergencyPhone")}
                    >
                      <Input
                        value={newPatient.emergencyPhone}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, emergencyPhone: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                  {visibleAppointmentFields.has("emergencyEmail") && (
                    <FieldLabel
                      label="Email apoderado"
                      required={requiredAppointmentFields.has("emergencyEmail")}
                    >
                      <Input
                        type="email"
                        value={newPatient.emergencyEmail}
                        onChange={(event) =>
                          onNewPatientChange((prev) => ({ ...prev, emergencyEmail: event.target.value }))
                        }
                      />
                    </FieldLabel>
                  )}
                </div>
              )}

              {visibleAppointmentFields.has("observations") && (
                <FieldLabel label="Observaciones" required={requiredAppointmentFields.has("observations")}>
                  <Textarea
                    rows={2}
                    value={newPatient.observations}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, observations: event.target.value }))
                    }
                  />
                </FieldLabel>
              )}

              <FieldLabel label="Comentario">
                <Textarea
                  rows={3}
                  placeholder="Comentario..."
                  value={newPatient.comment}
                  onChange={(event) =>
                    onNewPatientChange((prev) => ({ ...prev, comment: event.target.value }))
                  }
                />
              </FieldLabel>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-30 flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {requiresPatient
            ? "Selecciona o crea el paciente antes de guardar."
            : "El bloqueo se guardara sin paciente."}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onBack} type="button">
            Regresar
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting} type="button">
            {submitting && notifyByEmail && canNotifyByEmail ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando correo...
              </span>
            ) : submitting ? (
              "Guardando..."
            ) : (
              "Guardar cita"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PatientDailyLimitNotice({ conflict, loading }: { conflict: Appointment | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
        Validando si el paciente ya tiene cita activa en esta fecha...
      </div>
    );
  }

  if (!conflict) return null;

  const professionalName = conflict.professional
    ? `${conflict.professional.firstName} ${conflict.professional.lastName}`
    : "profesional asignado";

  return (
    <Alert variant="warning" size="sm" title={`Este paciente ya tiene una cita activa este dia: ${formatTime(conflict.startAt)} - ${formatTime(conflict.endAt)} con ${professionalName}.`}>
      <p className="mt-0.5">
        Por regla de la clinica, un paciente solo puede tener 1 cita al dia (incluso con diferentes profesionales). Para darle mas duracion, edita la cita existente en la agenda de {professionalName}.
      </p>
    </Alert>
  );
}

function PatientSummary({ patient }: { patient: PatientListItem }) {
  return (
    <div className="grid gap-3 rounded-md border border-cyan-100 bg-cyan-50 p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-bold text-cyan-700 shadow-sm">
        {patientInitials(patient)}
      </div>
      <div className="min-w-0">
        <p className="font-semibold uppercase text-slate-950">
          {patient.firstName} {patient.lastName}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>{patient.documentNumber || "Sin documento"}</span>
          <span>{patient.branchName || "Sucursal activa"}</span>
          <span>{patient.hasFutureAppointment ? "Tiene cita futura" : "Sin cita futura"}</span>
        </div>
      </div>
    </div>
  );
}

function TreatmentPlanSelector({
  canCreateTreatmentPlans,
  canReadTreatmentPlans,
  currentProfessionalPlans,
  historicalPlans,
  loading,
  otherProfessionalPlans,
  selectedPlanId,
  selectedProfessionalName,
  treatmentPlanChoice,
  onChoiceChange,
  onPlanSelect
}: {
  canCreateTreatmentPlans: boolean;
  canReadTreatmentPlans: boolean;
  currentProfessionalPlans: TreatmentPlan[];
  historicalPlans: TreatmentPlan[];
  loading: boolean;
  otherProfessionalPlans: TreatmentPlan[];
  selectedPlanId: string;
  selectedProfessionalName: string;
  treatmentPlanChoice: TreatmentPlanChoice;
  onChoiceChange: (choice: TreatmentPlanChoice) => void;
  onPlanSelect: (planId: string) => void;
}) {
  if (!canReadTreatmentPlans) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)]">
        Los planes de tratamiento no se muestran por permisos. La cita se puede guardar sin bloquear el flujo.
      </div>
    );
  }

  const hasSelectablePlans = currentProfessionalPlans.length > 0 || otherProfessionalPlans.length > 0;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            Planes de Tratamiento
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Selecciona el plan que quedará asociado a esta cita.
          </p>
        </div>
        {loading ? (
          <Badge value="Cargando" tone="default" />
        ) : (
          <Badge
            value={`${currentProfessionalPlans.length + otherProfessionalPlans.length} activos`}
            tone="brand"
          />
        )}
      </div>

      <div className="grid gap-[var(--space-3)] p-[var(--space-3)] max-h-[220px] overflow-y-auto overflow-x-hidden pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
        {loading ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-4)] text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
            Consultando planes del paciente...
          </div>
        ) : (
          <>
            <TreatmentPlanGroup
              icon={<User className="h-4 w-4" />}
              emptyText={`No hay planes activos con ${selectedProfessionalName}.`}
              plans={currentProfessionalPlans}
              selectedPlanId={selectedPlanId}
              title={`Con ${selectedProfessionalName}`}
              onPlanSelect={onPlanSelect}
            />
            <TreatmentPlanGroup
              icon={<Users className="h-4 w-4" />}
              emptyText="No hay planes activos con otros profesionales."
              plans={otherProfessionalPlans}
              selectedPlanId={selectedPlanId}
              title="Con otros profesionales"
              onPlanSelect={onPlanSelect}
            />

            {canCreateTreatmentPlans ? (
              <button
                type="button"
                className={`group flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border border-dashed px-[var(--space-3)] py-[var(--space-3)] text-left transition-[background-color,border-color] duration-[var(--duration-fast)] ${
                  treatmentPlanChoice === "new"
                    ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)]"
                    : "border-slate-300 bg-[var(--bg-surface)] hover:bg-slate-50 hover:border-slate-400"
                }`}
                onClick={() => onChoiceChange("new")}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                    treatmentPlanChoice === "new"
                      ? "bg-[var(--action-brand)] text-white"
                      : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold transition-colors ${treatmentPlanChoice === "new" ? "text-[var(--text-brand)]" : "text-slate-700 group-hover:text-slate-900"}`}
                  >
                    Crear nuevo plan de tratamiento
                  </span>
                  <span className="block text-xs text-slate-500">
                    Se creará un borrador asociado a esta sucursal y profesional.
                  </span>
                </div>
                {treatmentPlanChoice === "new" && (
                  <CheckCircle2 className="h-5 w-5 text-[var(--text-brand)] shrink-0" />
                )}
              </button>
            ) : null}

            {!hasSelectablePlans && !canCreateTreatmentPlans ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-slate-50 px-[var(--space-3)] py-6 text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
                <FolderX className="h-8 w-8 text-slate-300" />
                <p>No hay planes activos seleccionables y tu usuario no puede crear uno desde agenda.</p>
              </div>
            ) : null}

            {historicalPlans.length ? (
              <div className="border-t border-[var(--border-default)] pt-[var(--space-3)] mt-2">
                <p className="mb-[var(--space-2)] flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Historial inactivo
                </p>
                <div className="grid gap-[var(--space-2)]">
                  {historicalPlans.map((plan) => (
                    <TreatmentPlanSummary key={plan.id} disabled plan={plan} selected={false} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function TreatmentPlanGroup({
  emptyText,
  icon,
  plans,
  selectedPlanId,
  title,
  onPlanSelect
}: {
  emptyText: string;
  icon?: React.ReactNode;
  plans: TreatmentPlan[];
  selectedPlanId: string;
  title: string;
  onPlanSelect: (planId: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        {icon && <span className="text-slate-400">{icon}</span>}
        {title}
      </p>
      {plans.length ? (
        <div className="grid gap-[var(--space-2)]">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => onPlanSelect(plan.id)}
              className="text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-[var(--radius-md)]"
            >
              <TreatmentPlanSummary plan={plan} selected={selectedPlanId === plan.id} />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-500">
          <FolderX className="h-6 w-6 text-slate-300" />
          {emptyText}
        </div>
      )}
    </div>
  );
}

function TreatmentPlanSummary({
  disabled = false,
  plan,
  selected
}: {
  disabled?: boolean;
  plan: TreatmentPlan;
  selected: boolean;
}) {
  return (
    <div
      className={`relative flex w-full flex-col gap-2 rounded-[var(--radius-md)] border px-3 py-3 transition-[background-color,border-color,box-shadow] duration-200 ${
        selected
          ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)] shadow-sm"
          : disabled
            ? "border-slate-200 bg-slate-50 opacity-70"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`truncate text-sm font-semibold ${selected ? "text-[var(--text-brand)]" : "text-slate-800"}`}
            >
              {plan.name}
            </span>
            <Badge
              value={treatmentPlanStatusLabel(plan.status)}
              tone={treatmentPlanStatusTone(plan.status)}
            />
            {disabled ? (
              <span className="rounded-[var(--radius-sm)] bg-[var(--status-danger-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--status-danger-text)]">
                No seleccionable
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <User className="h-3 w-3 text-slate-400" />
              Dr(a). {plan.professional.firstName} {plan.professional.lastName}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <MapPin className="h-3 w-3 text-slate-400" />
              {plan.branch.name}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Stethoscope className="h-3 w-3 text-slate-400" />
              {plan.specialty?.name ?? plan.specialtySnapshotName ?? "Sin especialidad"}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="h-3 w-3 text-slate-400" />
              {formatTreatmentPlanDate(plan.updatedAt ?? plan.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center pl-2">
          {selected ? (
            <CheckCircle2 className="h-5 w-5 text-[var(--text-brand)]" />
          ) : (
            <div
              className={`h-5 w-5 rounded-full border ${disabled ? "border-slate-200" : "border-slate-300"}`}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
          {plan.itemsCount ?? 0} prestaciones
        </span>
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
          {plan.budgetCount ?? 0} presupuestos
        </span>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function EmptyColumn({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex h-24 flex-col items-center justify-center gap-2 rounded-md bg-slate-50 text-xs font-semibold text-slate-400">
      {icon}
      {text}
    </div>
  );
}

function toFormFromAppointment(appointment: Appointment): FormState {
  const duration = appointment.durationMinutes || diffMinutes(appointment.startAt, appointment.endAt) || 30;
  return {
    branchId: appointment.branchId,
    specialtyId: appointment.specialtyId ?? "",
    patientId: appointment.patientId ?? "",
    professionalId: appointment.professionalId,
    chairId: appointment.chairId ?? "",
    chairIndex: appointment.chairIndex ?? 1,
    allowOverbooking: appointment.isOverbooking ?? false,
    attendanceMode: appointment.attendanceMode ?? "PRESENTIAL",
    title: appointment.title,
    reason: appointment.reason ?? "",
    status: appointment.status,
    startAt: toLocalInput(appointment.startAt),
    endAt: toLocalInput(appointment.endAt),
    durationMinutes: String(duration),
    notes: appointment.notes ?? ""
  };
}

function toFormDefaults(initialValues?: Partial<AppointmentPayload> | null): FormState {
  const startAt = initialValues?.startAt ? toLocalInput(initialValues.startAt) : "";
  const endAt = initialValues?.endAt ? toLocalInput(initialValues.endAt) : "";
  const initialDuration =
    initialValues?.durationMinutes ?? (startAt && endAt ? diffMinutes(startAt, endAt) : undefined);
  return {
    ...defaultForm,
    branchId: initialValues?.branchId ?? "",
    specialtyId: initialValues?.specialtyId ?? "",
    patientId: initialValues?.patientId ?? "",
    professionalId: initialValues?.professionalId ?? "",
    chairId: initialValues?.chairId ?? "",
    chairIndex: initialValues?.chairIndex ?? 1,
    allowOverbooking: initialValues?.allowOverbooking ?? false,
    attendanceMode: initialValues?.attendanceMode ?? "PRESENTIAL",
    title: initialValues?.title ?? "",
    reason: initialValues?.reason ?? "",
    status: initialValues?.status ?? "SCHEDULED",
    startAt,
    endAt,
    durationMinutes: initialDuration ? String(initialDuration) : defaultForm.durationMinutes,
    notes: initialValues?.notes ?? ""
  };
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStartDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  const weekDay = date.getDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  date.setDate(date.getDate() + diff);
  return toDateInputValue(date);
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function buildWeekDays(weekStart: string) {
  const today = toDateInputValue(new Date());
  const weekdays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(weekStart, index);
    const [year, month, day] = date.split("-").map(Number);
    return {
      date,
      weekday: weekdays[index],
      day: String(day),
      month: months[month - 1],
      isToday: date === today,
      labelDate: new Date(year, month - 1, day)
    };
  });
}

function formatWeekRange(days: ReturnType<typeof buildWeekDays>) {
  const first = days[0]?.labelDate;
  const last = days[days.length - 1]?.labelDate;
  if (!first || !last) return "";
  return `${first.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} - ${last.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatSelectedSlot(slot: SelectedSlot) {
  const start = new Date(slot.startAt);
  return `${start.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "short" })}, ${formatTime(slot.startAt)} - ${formatTime(slot.endAt)}`;
}

function buildAppointmentTitle(patientName?: string, reason?: string) {
  if (patientName && reason) return `${reason} - ${patientName}`;
  if (reason) return reason;
  if (patientName) return `Cita - ${patientName}`;
  return "Cita agendada";
}

function diffMinutes(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function buildSelectedSlotsLookupRange(slots: SelectedSlot[]) {
  const timestamps = slots
    .flatMap((slot) => [new Date(slot.startAt).getTime(), new Date(slot.endAt).getTime()])
    .filter((value) => !Number.isNaN(value));

  if (!timestamps.length) return null;

  const start = new Date(Math.min(...timestamps));
  start.setHours(0, 0, 0, 0);
  const end = new Date(Math.max(...timestamps));
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
}

function appointmentCountsAgainstPatientDailyLimit(appointment: Appointment) {
  return (
    Boolean(appointment.patientId) &&
    appointment.status !== "BLOCKED" &&
    !PATIENT_DAILY_LIMIT_FREE_STATUSES.includes(appointment.status)
  );
}

function roundDurationToInterval(durationMinutes: number, intervalMinutes: number) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return durationMinutes;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return durationMinutes;
  return Math.ceil(durationMinutes / intervalMinutes) * intervalMinutes;
}

function buildSlotFromLocalStart(startAt: string, durationMinutes: number): SelectedSlot | null {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime()) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function slotsTouchOrOverlap(left: SelectedSlot, right: SelectedSlot) {
  if (!isSameAppointmentLocalDay(left.startAt, right.startAt)) return false;
  const leftStart = new Date(left.startAt).getTime();
  const leftEnd = new Date(left.endAt).getTime();
  const rightStart = new Date(right.startAt).getTime();
  const rightEnd = new Date(right.endAt).getTime();
  if ([leftStart, leftEnd, rightStart, rightEnd].some((value) => Number.isNaN(value))) return false;
  return rightStart <= leftEnd && rightEnd >= leftStart;
}

function slotInsideSelectedRange(selectedSlot: SelectedSlot, slot: SelectedSlot) {
  const selectedStart = new Date(selectedSlot.startAt).getTime();
  const selectedEnd = new Date(selectedSlot.endAt).getTime();
  const slotStart = new Date(slot.startAt).getTime();
  const slotEnd = new Date(slot.endAt).getTime();
  if ([selectedStart, selectedEnd, slotStart, slotEnd].some((value) => Number.isNaN(value))) return false;
  return slotStart >= selectedStart && slotEnd <= selectedEnd;
}

function mergeSlots(slots: SelectedSlot[]): SelectedSlot {
  const sorted = [...slots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const first = sorted[0]!;
  return sorted.reduce(
    (merged, slot) => {
      const slotStart = new Date(slot.startAt).getTime();
      const slotEnd = new Date(slot.endAt).getTime();
      const mergedStart = new Date(merged.startAt).getTime();
      const mergedEnd = new Date(merged.endAt).getTime();

      return {
        startAt: slotStart < mergedStart ? slot.startAt : merged.startAt,
        endAt: slotEnd > mergedEnd ? slot.endAt : merged.endAt
      };
    },
    { startAt: first.startAt, endAt: first.endAt }
  );
}

function resolveProfessionalSpecialtyId(
  professional: Professional | undefined,
  currentSpecialtyId: string,
  currentSpecialty: { id: string; name: string } | null
) {
  if (!professional) return "";
  if (
    currentSpecialtyId &&
    professional.specialties.some((specialty) =>
      specialtyMatchesSelection(specialty, currentSpecialtyId, currentSpecialty)
    )
  ) {
    return currentSpecialtyId;
  }
  return professional.specialties[0]?.id ?? "";
}

function resolveChairIdForBranch(chairs: Chair[], currentChairId: string) {
  if (currentChairId && chairs.some((chair) => chair.id === currentChairId)) return currentChairId;
  return chairs.length === 1 ? chairs[0].id : "";
}

function patientInitials(patient: PatientListItem) {
  const first = patient.firstName?.trim().charAt(0) ?? "";
  const last = patient.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "PX";
}

function normalizeReasonKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function requiresClinicalPatient(status: AppointmentStatus) {
  return status !== "BLOCKED";
}

function isSelectableTreatmentPlan(plan: TreatmentPlan) {
  return plan.status !== "CANCELLED" && plan.status !== "REJECTED";
}

function treatmentPlanStatusLabel(status: TreatmentPlan["status"]) {
  const labels: Record<TreatmentPlan["status"], string> = {
    DRAFT: "Borrador",
    PRESENTED: "Presentado",
    ACCEPTED: "Aceptado",
    IN_PROGRESS: "En curso",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
    REJECTED: "Rechazado"
  };
  return labels[status] ?? status;
}

function treatmentPlanStatusTone(status: TreatmentPlan["status"]) {
  if (status === "ACCEPTED" || status === "IN_PROGRESS" || status === "COMPLETED") return "success";
  if (status === "PRESENTED") return "brand";
  if (status === "CANCELLED" || status === "REJECTED") return "danger";
  return "default";
}

function formatTreatmentPlanDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha invalida";
  return `Actualizado ${date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function isBranchAssignmentActiveAt(
  branch: {
    status?: "ACTIVE" | "PAUSED" | "ENDED";
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
  },
  localDateTime: string
) {
  if (branch.status && branch.status !== "ACTIVE") return false;
  if (!localDateTime) return true;
  const appointmentDate = new Date(localDateTime);
  const startsAt = branch.startsAt ? new Date(branch.startsAt) : null;
  const endsAt = branch.endsAt ? new Date(branch.endsAt) : null;

  if (startsAt && appointmentDate < startsAt) return false;
  if (endsAt && appointmentDate >= endsAt) return false;
  return true;
}
