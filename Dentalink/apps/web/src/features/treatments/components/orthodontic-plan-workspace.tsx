import {
  PointerEvent,
  ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  DollarSign,
  FileText,
  ImageIcon,
  MessageSquarePlus,
  Pause,
  Play,
  Plus,
  Printer,
  Save,
  Send,
  Settings,
  Stethoscope,
  UploadCloud
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ProgressDonut } from "@/components/ui/progress-donut";
import { APP_ROUTES } from "@/lib/routes";
import { useDocumentsMutations, usePatientFiles } from "@/features/documents/hooks/use-documents";
import type { FileAttachment } from "@/features/documents/services/documents.service";
import { ClinicalEvolutionModal } from "@/features/clinical/components/clinical-evolution-modal";
import { PhotographicTemplatesPanel } from "@/features/treatments/components/photographic-templates-panel";
import { PlanAction, PlanActionDropdown } from "./plan-action-dropdown";
import {
  OrthodonticDiagnosisModal,
  type OrthodonticDiagnosisFormValue
} from "./orthodontic-diagnosis-modal";
import {
  OrthodonticTechnicalPlanModal,
  type OrthodonticProfileFormState
} from "./orthodontic-technical-plan-modal";
import { OrthodonticOptionsModal } from "./orthodontic-options-modal";
import {
  useOrthodonticDiagnosis,
  useOrthodonticDiagnosisCatalog,
  useOrthodonticDiagnosisStatus,
  useOrthodonticOptionFields,
  useOrthodonticSummary
} from "@/features/treatments/hooks/use-treatments";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";

import type {
  OrthodonticClinicalFieldSource,
  OrthodonticDiagnosisCatalogField,
  OrthodonticDiagnosisResult,
  OrthodonticDiagnosisValuePayload,
  OrthodonticProfilePayload,
  OrthodonticSummary,
  TreatmentPlanDetail,
  TreatmentPlanPrintDocumentType,
  TreatmentPlanPrintOption,
  TreatmentPlanStatus
} from "@/features/treatments/services/treatments.service";
import {
  dateInputValue,
  finiteNumberValue,
  formatDate,
  formatDateTime,
  numberValue,
  progressPercentageValue,
  todayInputValue
} from "./treatment-modal-helpers";
import {
  ClinicalStateLine,
  HygieneCurve,
  MetricTile,
  PlanFilesPanel,
  SummaryPanel,
  adaptLegacyOrthodonticSummary,
  addCalendarMonthsInput,
  clinicalFieldDetail,
  clinicalPlainText,
  dateTimeInputValue,
  diagnosisFormValuesFromResult,
  fieldSourceValue,
  isEmptyOrthodonticProfileValue,
  isOrthodonticTechnicalPlanEmpty,
  orthodonticCatalogSelectionsFromProfile,
  orthodonticStartDurationValue,
  orthodonticStatusDescription,
  orthodonticStatusLabel,
  recordValue
} from "./orthodontic-plan-components";

const ORTHODONTIC_RX_CATEGORY = "ORTHODONTIC_RX_CF";




export function OrthodonticPlanWorkspace({
  patientId,
  plan,
  procedures,
  odontogramPanel,
  savingProfile,
  savingDiagnosis,
  generatingMonthlyItems,
  onSaveProfile,
  onSaveDiagnosisDraft,
  onSaveDiagnosisActive,
  onGenerateMonthlyItems,
  onCollect,
  onFinance,
  onPayrollDiscount,
  financeDisabledReason,
  payrollDiscountDisabledReason,
  collectDisabledReason,
  onOpenRefunds,
  onDuplicate,
  onPrintDocument,
  printOptions,
  canPrintBudget,
  canPrintDocuments,
  onPause,
  onResume,
  startingTreatment,
  canManageOrthodonticCatalogs,
  canManageOrthodonticDiagnosisCatalogs,
  onStart,
  onCreateCatalogOption,
  onUpdateCatalogOption,
  onDeactivateCatalogOption,
  onReactivateCatalogOption,
  onSortCatalogOptions,
  onCreateDiagnosisOption,
  onUpdateDiagnosisOption,
  onDeactivateDiagnosisOption,
  onReactivateDiagnosisOption,
  onSortDiagnosisOptions
}: {
  patientId: string;
  plan: TreatmentPlanDetail;
  procedures: Procedure[];
  odontogramPanel: ReactNode;
  savingProfile: boolean;
  savingDiagnosis: boolean;
  generatingMonthlyItems: boolean;
  onSaveProfile: (payload: OrthodonticProfilePayload) => Promise<unknown>;
  onSaveDiagnosisDraft: (payload: {
    clinicalDate?: string | null;
    values: OrthodonticDiagnosisValuePayload[];
  }) => Promise<unknown>;
  onSaveDiagnosisActive: (payload: {
    clinicalDate?: string | null;
    values: OrthodonticDiagnosisValuePayload[];
  }) => Promise<unknown>;
  onGenerateMonthlyItems: (payload: {
    procedureId: string;
    months: number;
    unitPrice?: number;
    startDate?: string;
    sectionName?: string;
    notes?: string;
  }) => Promise<unknown>;
  onCollect: () => void;
  onFinance: () => void;
  onPayrollDiscount: () => void;
  financeDisabledReason?: string;
  payrollDiscountDisabledReason?: string;
  collectDisabledReason?: string;
  onOpenRefunds: () => void;
  onDuplicate: () => void;
  onPrintDocument: (type: TreatmentPlanPrintDocumentType) => void;
  printOptions: TreatmentPlanPrintOption[];
  canPrintBudget: boolean;
  canPrintDocuments: boolean;
  onPause: (reason?: string) => Promise<unknown>;
  onResume: () => Promise<unknown>;
  startingTreatment: boolean;
  canManageOrthodonticCatalogs: boolean;
  canManageOrthodonticDiagnosisCatalogs: boolean;
  onStart: (payload: { startDate?: string; durationMonths: number }) => Promise<unknown>;
  onCreateCatalogOption: (fieldId: string, label: string) => Promise<unknown>;
  onUpdateCatalogOption: (
    optionId: string,
    payload: { label?: string; sortOrder?: number }
  ) => Promise<unknown>;
  onDeactivateCatalogOption: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivateCatalogOption: (optionId: string) => Promise<unknown>;
  onSortCatalogOptions: (fieldId: string, optionIds: string[]) => Promise<unknown>;
  onCreateDiagnosisOption: (fieldId: string, label: string) => Promise<unknown>;
  onUpdateDiagnosisOption: (
    optionId: string,
    payload: { label?: string; sortOrder?: number }
  ) => Promise<unknown>;
  onDeactivateDiagnosisOption: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivateDiagnosisOption: (optionId: string) => Promise<unknown>;
  onSortDiagnosisOptions: (fieldId: string, optionIds: string[]) => Promise<unknown>;
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const orthodonticCatalogs = useOrthodonticOptionFields(showPlanModal);
  const diagnosisStatus = useOrthodonticDiagnosisStatus(plan.id, activeTab === "diagnosis");
  const orthodonticDiagnosis = useOrthodonticDiagnosis(
    plan.id,
    showDiagnosisModal || activeTab === "diagnosis"
  );
  const diagnosisCatalogs = useOrthodonticDiagnosisCatalog(showDiagnosisModal || activeTab === "diagnosis");
  const [diagnosisAutoOpened, setDiagnosisAutoOpened] = useState(false);
  const [technicalPlanAutoOpened, setTechnicalPlanAutoOpened] = useState(false);
  const [diagnosisValues, setDiagnosisValues] = useState<Record<string, OrthodonticDiagnosisFormValue>>({});
  const [activeDiagnosisSection, setActiveDiagnosisSection] = useState<string>("generales");
  const [editingDiagnosisField, setEditingDiagnosisField] = useState<OrthodonticDiagnosisCatalogField | null>(
    null
  );
  const [profileForm, setProfileForm] = useState<OrthodonticProfileFormState>({
    technicalDescription: "",
    startDate: "",
    estimatedMonths: "",
    estimatedControls: "",
    totalAligners: "",
    indicatedExtractions: "",
    performedExtractions: "",
    reevaluationDate: "",
    interconsultations: "",
    lastUpperArch: "",
    lastLowerArch: "",
    nextControlAt: "",
    nextRadiographyAt: "",
    hygieneStatus: "",
    alert: "",
    indications: "",
    elastics: "",
    planNotes: "",
    catalogSelections: {} as Record<string, string[]>
  });
  const [monthlyForm, setMonthlyForm] = useState({
    procedureId: "",
    months: "12",
    unitPrice: "",
    startDate: "",
    notes: ""
  });
  const rxFiles = usePatientFiles(patientId, ORTHODONTIC_RX_CATEGORY, plan.id);
  const documentMutations = useDocumentsMutations();
  const orthodonticSummary = useOrthodonticSummary(plan.id, activeTab === "summary");
  const summary = orthodonticSummary.data ?? adaptLegacyOrthodonticSummary(plan);
  const isPlanReadOnly =
    plan.status === "COMPLETED" || plan.status === "CANCELLED" || plan.status === "REJECTED";
  const technicalPlanEmpty = isOrthodonticTechnicalPlanEmpty(plan.orthodonticProfile);
  const latestEvolution = summary?.latestEvolution;
  const diagnosisHydrationKey = JSON.stringify(orthodonticDiagnosis.data?.diagnosis?.values ?? []);
  const diagnosisFirstSectionCode =
    orthodonticDiagnosis.data?.catalog?.[0]?.code ?? diagnosisCatalogs.data?.[0]?.code ?? "generales";
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showStartModal, setShowStartModal] = useState(false);
  const [startDate, setStartDate] = useState(
    dateInputValue(plan.orthodonticProfile?.startDate) || todayInputValue()
  );
  const [startDurationMonths, setStartDurationMonths] = useState(
    String(orthodonticStartDurationValue(plan.orthodonticProfile?.estimatedMonths))
  );

  useEffect(() => {
    const profile = plan.orthodonticProfile;
    setProfileForm({
      technicalDescription: profile?.technicalDescription ?? "",
      startDate: dateInputValue(profile?.startDate),
      estimatedMonths: profile?.estimatedMonths ? String(profile.estimatedMonths) : "",
      estimatedControls: profile?.estimatedControls ? String(profile.estimatedControls) : "",
      totalAligners:
        profile?.totalAligners !== null && profile?.totalAligners !== undefined
          ? String(profile.totalAligners)
          : "",
      indicatedExtractions: profile?.indicatedExtractions ?? "",
      performedExtractions: profile?.performedExtractions ?? "",
      reevaluationDate: dateInputValue(profile?.reevaluationDate),
      interconsultations: profile?.interconsultations ?? "",
      lastUpperArch: profile?.lastUpperArch ?? "",
      lastLowerArch: profile?.lastLowerArch ?? "",
      nextControlAt: dateTimeInputValue(profile?.nextControlAt),
      nextRadiographyAt: dateTimeInputValue(profile?.nextRadiographyAt),
      hygieneStatus: profile?.hygieneStatus ?? "",
      alert: profile?.alert ?? "",
      indications: profile?.indications ?? "",
      elastics: profile?.elastics ?? "",
      planNotes: profile?.planNotes ?? "",
      catalogSelections: orthodonticCatalogSelectionsFromProfile(profile)
    });

    setMonthlyForm((current) => ({ ...current, startDate: dateInputValue(profile?.startDate) }));
    setStartDate(dateInputValue(profile?.startDate) || todayInputValue());
    setStartDurationMonths(String(orthodonticStartDurationValue(profile?.estimatedMonths)));
  }, [plan.id, plan.orthodonticProfile]);

  useEffect(() => {
    setDiagnosisValues(diagnosisFormValuesFromResult(orthodonticDiagnosis.data));
    setActiveDiagnosisSection(diagnosisFirstSectionCode);
  }, [diagnosisHydrationKey, diagnosisFirstSectionCode]);

  useEffect(() => {
    if (activeTab !== "diagnosis") {
      setDiagnosisAutoOpened(false);
      return;
    }
    if (diagnosisAutoOpened || diagnosisStatus.isLoading || diagnosisStatus.data?.status !== "EMPTY") return;
    setDiagnosisAutoOpened(true);
    setShowDiagnosisModal(true);
  }, [activeTab, diagnosisAutoOpened, diagnosisStatus.data?.status, diagnosisStatus.isLoading]);

  useEffect(() => {
    if (activeTab !== "plan") {
      setTechnicalPlanAutoOpened(false);
      return;
    }
    if (technicalPlanAutoOpened || !technicalPlanEmpty || isPlanReadOnly) return;
    setTechnicalPlanAutoOpened(true);
    setShowPlanModal(true);
  }, [activeTab, isPlanReadOnly, technicalPlanAutoOpened, technicalPlanEmpty]);

  const updateProfileField = (
    field: Exclude<keyof OrthodonticProfileFormState, "catalogSelections">,
    value: string
  ) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const updateCatalogSelection = (
    fieldCode: string,
    optionId: string,
    allowsMultiple: boolean,
    checked?: boolean
  ) => {
    setProfileForm((current) => {
      const currentValues = current.catalogSelections[fieldCode] ?? [];
      const nextValues = allowsMultiple
        ? checked
          ? [...new Set([...currentValues, optionId])]
          : currentValues.filter((id) => id !== optionId)
        : optionId
          ? [optionId]
          : [];
      return {
        ...current,
        catalogSelections: {
          ...current.catalogSelections,
          [fieldCode]: nextValues
        }
      };
    });
  };

  const saveProfile = async () => {
    await onSaveProfile({
      technicalDescription: profileForm.technicalDescription || null,
      startDate: profileForm.startDate || null,
      estimatedMonths: profileForm.estimatedMonths ? Number(profileForm.estimatedMonths) : null,
      estimatedControls: profileForm.estimatedControls ? Number(profileForm.estimatedControls) : null,
      totalAligners: profileForm.totalAligners ? Number(profileForm.totalAligners) : null,
      indicatedExtractions: profileForm.indicatedExtractions || null,
      performedExtractions: profileForm.performedExtractions || null,
      reevaluationDate: profileForm.reevaluationDate || null,
      nextRadiographyAt: profileForm.nextRadiographyAt
        ? new Date(profileForm.nextRadiographyAt).toISOString()
        : null,
      indications: profileForm.indications || null,
      interconsultations: profileForm.interconsultations || null,
      planNotes: profileForm.planNotes || null,
      catalogSelections: profileForm.catalogSelections
    });
    setShowPlanModal(false);
    toast.success("Perfil de ortodoncia guardado.");
  };

  const diagnosisSections = orthodonticDiagnosis.data?.catalog ?? diagnosisCatalogs.data ?? [];
  const currentDiagnosis = orthodonticDiagnosis.data ?? diagnosisStatus.data;
  const readOnlyDiagnosis =
    plan.status === "COMPLETED" || plan.status === "CANCELLED" || plan.status === "REJECTED";

  const updateDiagnosisValue = (fieldCode: string, nextValue: OrthodonticDiagnosisFormValue) => {
    setDiagnosisValues((current) => ({ ...current, [fieldCode]: { ...current[fieldCode], ...nextValue } }));
  };

  const buildDiagnosisPayload = () => {
    const values: OrthodonticDiagnosisValuePayload[] = [];
    for (const section of diagnosisSections) {
      for (const field of section.fields) {
        const value = diagnosisValues[field.code] ?? {};
        if (field.inputType === "checkbox") {
          const optionIds = (value.optionIds ?? []).filter(Boolean);
          if (optionIds.length) values.push({ fieldCode: field.code, optionIds });
          continue;
        }
        if (field.inputType === "select") {
          if (value.optionId) values.push({ fieldCode: field.code, optionId: value.optionId });
          continue;
        }
        if (field.inputType === "number") {
          const num = Number(value.valueNumber);
          if (value.valueNumber !== undefined && value.valueNumber !== "" && !Number.isNaN(num)) {
            values.push({ fieldCode: field.code, valueNumber: num });
          }
          continue;
        }
        const textValue = (value.valueText ?? "").trim();
        if (textValue) values.push({ fieldCode: field.code, valueText: textValue });
      }
    }
    return { values };
  };

  const saveDiagnosisDraft = async () => {
    await onSaveDiagnosisDraft(buildDiagnosisPayload());
    setShowDiagnosisModal(false);
    toast.success("Borrador de diagnostico guardado.");
  };

  const saveDiagnosisActive = async () => {
    await onSaveDiagnosisActive(buildDiagnosisPayload());
    setShowDiagnosisModal(false);
    toast.success("Diagnostico de ortodoncia guardado.");
  };

  const generateMonthlyItems = async () => {
    if (!monthlyForm.procedureId) {
      toast.error("Selecciona una prestacion para mensualidades.");
      return;
    }
    await onGenerateMonthlyItems({
      procedureId: monthlyForm.procedureId,
      months: Number(monthlyForm.months || 1),
      unitPrice: monthlyForm.unitPrice ? Number(monthlyForm.unitPrice) : undefined,
      startDate: monthlyForm.startDate || undefined,
      sectionName: "Mensualidades",
      notes: monthlyForm.notes || undefined
    });
    toast.success("Mensualidades agregadas al plan.");
  };

  const uploadFile = async (file: File | undefined, category: string) => {
    if (!file) return;
    await documentMutations.uploadPatientBinaryFile.mutateAsync({
      patientId,
      file,
      category,
      treatmentPlanId: plan.id
    });
  };

  const tabs = [
    ["summary", "Resumen"],
    ["photos", "Plantilla Fotografica"],
    ["diagnosis", "Diagnostico"],
    ["plan", "Plan de tratamiento"],
    ["rx", "Rx y Cf"]
  ] as const;

  const handlePause = async () => {
    await onPause(pauseReason);
    setShowPauseModal(false);
    setPauseReason("");
    toast.success("Tratamiento pausado correctamente.");
  };

  const handleResume = async () => {
    await onResume();
    toast.success("Tratamiento reanudado.");
  };

  const handleStart = async () => {
    const durationMonths = numberValue(startDurationMonths);
    if (!startDate) {
      toast.error("Selecciona la fecha de inicio.");
      return;
    }
    if (!Number.isInteger(durationMonths) || durationMonths < 3 || durationMonths > 36) {
      toast.error("La duracion debe estar entre 3 y 36 meses.");
      return;
    }
    if (startDate > todayInputValue()) {
      toast.error("La fecha de inicio no puede ser futura.");
      return;
    }
    await onStart({ startDate, durationMonths });
    setShowStartModal(false);
    toast.success("Tratamiento iniciado.");
  };

  const summaryRuntime = summary as unknown as {
    calendarProgress?: unknown;
    realProgress?: unknown;
    planning?: unknown;
  } | null;
  const calendarProgressData = recordValue(summaryRuntime?.calendarProgress);
  const realProgressData = recordValue(summaryRuntime?.realProgress);
  const planningData = recordValue(summaryRuntime?.planning);
  const statusLabel = orthodonticStatusLabel(summary?.status);
  const statusDescription = orthodonticStatusDescription(summary);
  const isNotStarted = summary?.status === "NOT_STARTED";
  const canStart = summary?.capabilities.canStart ?? isNotStarted;
  const canOpenStart = canStart && !plan.isAlternative;
  const canPause = summary?.capabilities.canPause ?? false;
  const canResume = summary?.capabilities.canResume ?? false;
  const clinicalState = summary?.currentClinicalState;
  const calendarProgress = progressPercentageValue(summaryRuntime?.calendarProgress);
  const realProgress = progressPercentageValue(summaryRuntime?.realProgress);
  const controlsProgressStatus =
    typeof realProgressData?.status === "string" ? realProgressData.status : summary?.realProgressStatus;
  const isDelayed =
    controlsProgressStatus === "POR_DEBAJO_DEL_RITMO" ||
    controlsProgressStatus === "PLAZO_EXCEDIDO" ||
    controlsProgressStatus === "DELAYED" ||
    realProgress < calendarProgress - 15;
  const estimatedMonths =
    finiteNumberValue(summary?.estimatedMonths ?? planningData?.plannedMonths, NaN) ||
    numberValue(profileForm.estimatedMonths);
  const plannedControls =
    finiteNumberValue(
      summary?.estimatedControls ?? planningData?.plannedControls ?? realProgressData?.plannedControls,
      NaN
    ) ||
    numberValue(profileForm.estimatedControls) ||
    estimatedMonths;
  const elapsedMonths = finiteNumberValue(
    summary?.elapsedMonths ?? calendarProgressData?.elapsedMonths,
    estimatedMonths ? Math.max(0, Math.round((calendarProgress / 100) * estimatedMonths)) : 0
  );
  const realControlsCount = finiteNumberValue(
    summary?.realControlsCount ?? planningData?.completedControls ?? realProgressData?.completedControls
  );
  const startDurationNumber = numberValue(startDurationMonths);
  const startDurationValid =
    Number.isInteger(startDurationNumber) && startDurationNumber >= 3 && startDurationNumber <= 36;
  const startDateIsFuture = Boolean(startDate && startDate > todayInputValue());
  const startPlannedControls = startDurationValid ? startDurationNumber : 0;
  const startExpectedEndDate = startDurationValid
    ? addCalendarMonthsInput(startDate, startDurationNumber)
    : "";
  const startCanSubmit = Boolean(startDate) && startDurationValid && !startDateIsFuture && !startingTreatment;
  const calendarProgressLabel =
    summary?.calendarProgressLabel ??
    (typeof calendarProgressData?.label === "string" ? calendarProgressData.label : undefined) ??
    statusDescription;
  const controlsProgressLabel =
    (typeof realProgressData?.label === "string" ? realProgressData.label : undefined) ??
    summary?.realProgressLabel ??
    (isDelayed ? "Seguimiento por debajo del calendario" : "Seguimiento en ritmo operativo");
  const nextControlLabel =
    fieldSourceValue(clinicalState?.nextControl) ||
    (profileForm.nextControlAt ? formatDateTime(profileForm.nextControlAt) : "Sin fecha");
  const nextRxLabel =
    fieldSourceValue(clinicalState?.radiographicControl) ||
    (profileForm.nextRadiographyAt ? formatDate(profileForm.nextRadiographyAt) : "Sin fecha");
  const hygieneMaximum = summary?.hygiene.maximumScore ?? 7;
  const latestHygieneLabel =
    summary?.hygiene.latestScore !== null && summary?.hygiene.latestScore !== undefined
      ? `${summary.hygiene.latestScore}/${hygieneMaximum}`
      : "Sin registro";
  const latestEvolutionText = latestEvolution?.plainText || clinicalPlainText(latestEvolution?.notes) || "";
  const setMenuOpen = (menu: string) => (nextOpen: boolean) => setOpenActionMenu(nextOpen ? menu : null);
  const emptyPlanDocumentReason = "Agrega al menos un procedimiento al plan.";
  const printOptionByType = new Map(printOptions.map((option) => [option.document_type, option] as const));
  const printAction = (
    type: TreatmentPlanPrintDocumentType,
    fallback: { label: string; description: string; disabled: boolean; disabledReason: string }
  ): PlanAction => {
    const option = printOptionByType.get(type);
    return {
      label: option?.label ?? fallback.label,
      description: option?.description ?? fallback.description,
      onSelect: () => onPrintDocument(type),
      disabled: option ? !option.enabled : fallback.disabled,
      disabledReason: option?.disabled_reason ?? (fallback.disabled ? fallback.disabledReason : undefined)
    };
  };
  const actionMenus = {
    money: [
      {
        label: "Financiamiento",
        onSelect: onFinance,
        disabled: Boolean(financeDisabledReason),
        disabledReason: financeDisabledReason
      },
      {
        label: "Descuento por planilla",
        onSelect: onPayrollDiscount,
        disabled: Boolean(payrollDiscountDisabledReason),
        disabledReason: payrollDiscountDisabledReason
      },
      {
        label: "Recaudar este tratamiento",
        onSelect: onCollect,
        disabled: Boolean(collectDisabledReason),
        disabledReason: collectDisabledReason
      }
    ] satisfies PlanAction[],
    settings: [
      { label: "Solicitud de reembolso", onSelect: onOpenRefunds },
      { label: "Duplicar plan de tratamiento", onSelect: onDuplicate },
      {
        label: "Crear tratamiento alternativo",
        disabled: true,
        disabledReason: "Requiere modal de seleccion de procedimientos antes de llamar al endpoint."
      },
      {
        label: "Solicitar atencion con otro profesional",
        disabled: true,
        disabledReason: "Requiere seleccionar profesional/sucursal/motivo."
      },
      {
        label: "Finalizar",
        disabled: true,
        disabledReason: "Falta validacion de bloqueos clinicos y financieros antes de cerrar."
      },
      {
        label: "Eliminar",
        disabled: true,
        disabledReason: "No existe endpoint de eliminacion logica del plan.",
        danger: true
      }
    ] satisfies PlanAction[],
    printer: [
      printAction("BUDGET_COMPLETE", {
        label: "Presupuesto completo",
        description: "Muestra procedimientos, importes individuales, resumen y estado de cuenta.",
        disabled: !canPrintBudget,
        disabledReason: "Primero genera un presupuesto."
      }),
      printAction("BUDGET_TOTAL_ONLY", {
        label: "Presupuesto con total general",
        description: "Muestra procedimientos y el total final, sin precios unitarios.",
        disabled: !canPrintBudget,
        disabledReason: "Primero genera un presupuesto."
      }),
      printAction("BUDGET_NO_DETAIL", {
        label: "Presupuesto sin valores",
        description: "Muestra el detalle clinico sin informacion economica.",
        disabled: !canPrintBudget,
        disabledReason: "Primero genera un presupuesto."
      }),
      printAction("LAB_ORDER", {
        label: "Orden de laboratorio",
        description: "Imprime la orden de laboratorio vinculada.",
        disabled: true,
        disabledReason: "No hay orden de laboratorio vinculada."
      }),
      printAction("CARE_PLAN", {
        label: "Plan de atencion",
        description: "Documento clinico, no financiero.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      }),
      printAction("SECTIONS", {
        label: "Secciones",
        description: "Imprime las secciones del plan.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      }),
      printAction("ODONTOGRAM", {
        label: "Odontograma",
        description: "Imprime el odontograma y hallazgos.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      }),
      printAction("CLINICAL_HISTORY", {
        label: "Historial clinico",
        description: "Imprime el historial clinico del paciente.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      })
    ] satisfies PlanAction[],
    send: [
      {
        label: "Email",
        disabled: true,
        disabledReason:
          "El backend actual solo marca presupuesto como enviado; falta email con PDF y CommunicationJob."
      },
      { label: "WhatsApp", disabled: true, disabledReason: "WhatsApp estara disponible proximamente." },
      {
        label: "Historial de envios",
        disabled: true,
        disabledReason: "Falta consulta de CommunicationJob por plan/documento."
      }
    ] satisfies PlanAction[]
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-end border-b border-slate-300 px-4 pt-3 bg-slate-50/50">
          <button
            type="button"
            className={`mr-2 rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab !== "odontogram"
                ? "border-slate-300 bg-white text-slate-900 z-10 -mb-[1px]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("summary")}
          >
            Ortodoncia
          </button>
          <button
            type="button"
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "odontogram"
                ? "border-slate-300 bg-white text-slate-900 z-10 -mb-[1px]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("odontogram")}
          >
            Odontograma
          </button>

          <div className="mb-2 ml-auto flex items-center gap-1 text-slate-500">
            <PlanActionDropdown
              id="money"
              label="Acciones financieras"
              icon={<DollarSign className="h-4 w-4" />}
              actions={actionMenus.money}
              open={openActionMenu === "money"}
              onOpenChange={setMenuOpen("money")}
            />
            <PlanActionDropdown
              id="settings"
              label="Acciones del plan"
              icon={<Settings className="h-4 w-4" />}
              actions={actionMenus.settings}
              open={openActionMenu === "settings"}
              onOpenChange={setMenuOpen("settings")}
            />
            <PlanActionDropdown
              id="printer"
              label="Imprimir documentos"
              icon={<Printer className="h-4 w-4" />}
              actions={actionMenus.printer}
              open={openActionMenu === "printer"}
              onOpenChange={setMenuOpen("printer")}
            />
            <PlanActionDropdown
              id="send"
              label="Enviar documentos"
              icon={<Send className="h-4 w-4" />}
              actions={actionMenus.send}
              open={openActionMenu === "send"}
              onOpenChange={setMenuOpen("send")}
            />
          </div>
        </div>

        {activeTab !== "odontogram" && (
          <div className="border-b border-slate-200 px-4 pt-4">
            <div className="flex gap-6 overflow-x-auto">
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    activeTab === value
                      ? "border-sky-600 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => {
                    if (value === "plan") {
                      setActiveTab(value);
                      setShowPlanModal(true);
                      return;
                    }
                    setActiveTab(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "summary" ? (
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-sky-100 bg-[linear-gradient(135deg,#f4fbff_0%,#ffffff_54%,#f4fdfa_100%)] p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                    Resumen clinico de ortodoncia
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{statusLabel}</h3>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">{statusDescription}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-sky-300 bg-white"
                    onClick={() => setShowPlanModal(true)}
                  >
                    <Save className="h-4 w-4" />
                    Editar ficha
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-2 border-sky-600 bg-sky-600 hover:bg-sky-700 hover:border-sky-700 text-white"
                    onClick={() => setIsEvolutionModalOpen(true)}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Nueva evolucion
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold uppercase text-slate-500"
                          title="Tiempo transcurrido desde el inicio frente a la duracion estimada."
                        >
                          Progreso calendario
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {isNotStarted
                            ? "Sin iniciar"
                            : estimatedMonths
                              ? `${elapsedMonths} de ${estimatedMonths} meses`
                              : "Sin duracion"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Inicio: {summary?.startedAt ? formatDate(summary.startedAt) : "Sin fecha"}
                        </p>
                      </div>
                      <ProgressDonut
                        percentage={calendarProgress}
                        size={104}
                        strokeWidth={10}
                        label={`${Math.round(calendarProgress)}%`}
                        subLabel="Calendario"
                        color="text-sky-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold uppercase text-slate-500"
                          title="Controles realizados frente a los controles planificados. No representa automaticamente el avance biologico del tratamiento."
                        >
                          Progreso por controles
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {plannedControls
                            ? `${realControlsCount} de ${plannedControls} controles`
                            : `${realControlsCount} controles`}
                        </p>
                        <p
                          className={`mt-1 text-xs font-medium ${isDelayed ? "text-amber-700" : "text-emerald-700"}`}
                        >
                          {controlsProgressLabel}
                        </p>
                      </div>
                      <ProgressDonut
                        percentage={realProgress}
                        size={104}
                        strokeWidth={10}
                        label={`${Math.round(realProgress)}%`}
                        subLabel="Controles"
                        color={isDelayed ? "text-amber-500" : "text-emerald-500"}
                        isAlert={isDelayed}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        summary?.status === "PAUSED"
                          ? "bg-amber-50 text-amber-700"
                          : isNotStarted
                            ? "bg-slate-100 text-slate-600"
                            : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {summary?.status === "PAUSED" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase text-slate-500">Estado operativo</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {statusLabel.replace("Tratamiento ", "")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{calendarProgressLabel}</p>
                    </div>
                    {canOpenStart ? (
                      <Button
                        size="sm"
                        className="bg-sky-600 text-white hover:bg-sky-700"
                        onClick={() => setShowStartModal(true)}
                      >
                        <Play className="h-4 w-4" />
                        Dar inicio
                      </Button>
                    ) : canResume ? (
                      <Button variant="secondary" size="sm" className="bg-white" onClick={handleResume}>
                        <Play className="h-4 w-4" />
                        Reanudar
                      </Button>
                    ) : canPause ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowPauseModal(true)}
                      >
                        <Pause className="h-4 w-4" />
                        Pausar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                icon={<CalendarClock className="h-4 w-4" />}
                label="Proximo control"
                value={nextControlLabel}
                detail={`Rx/Cf: ${nextRxLabel}`}
              />
              <MetricTile
                icon={<Stethoscope className="h-4 w-4" />}
                label="Higiene"
                value={latestHygieneLabel}
                detail={
                  summary?.hygiene.latestRecordedAt
                    ? `Registrada ${formatDateTime(summary.hygiene.latestRecordedAt)}`
                    : "Sin punto clinico registrado"
                }
              />
              <MetricTile
                icon={<Activity className="h-4 w-4" />}
                label="Planificacion"
                value={estimatedMonths ? `${estimatedMonths} meses` : "Sin meses"}
                detail={
                  plannedControls ? `${plannedControls} controles planificados` : "Sin controles planificados"
                }
              />
            </div>

            <Modal open={showPauseModal} onClose={() => setShowPauseModal(false)} title="Pausar Tratamiento">
              <div className="p-4 space-y-4">
                <p className="text-sm text-slate-600">
                  Al pausar el tratamiento, el porcentaje de avance del calendario se detendra hasta que lo
                  vuelvas a reanudar.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Motivo de la pausa (Opcional)
                  </label>
                  <Textarea
                    placeholder="Ej. Vacaciones, brackets despegados..."
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowPauseModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handlePause}>Pausar</Button>
                </div>
              </div>
            </Modal>

            <Modal
              open={showStartModal}
              onClose={() => setShowStartModal(false)}
              title="Dar inicio al tratamiento de ortodoncia"
            >
              <div className="space-y-5 p-4">
                <div className="rounded-md border border-sky-100 bg-sky-50/70 p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Paciente</p>
                      <p className="font-semibold text-slate-900">
                        {plan.patient.firstName} {plan.patient.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Plan</p>
                      <p className="font-semibold text-slate-900">{plan.name || `#${plan.id.slice(-6)}`}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Profesional</p>
                      <p className="font-semibold text-slate-900">
                        Dr(a) {plan.professional.firstName} {plan.professional.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Sucursal</p>
                      <p className="font-semibold text-slate-900">{plan.branch.name}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Fecha de inicio</span>
                    <Input
                      className="mt-1"
                      type="date"
                      max={todayInputValue()}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                    {startDateIsFuture ? (
                      <span className="mt-1 block text-xs font-medium text-red-600">
                        La fecha de inicio no puede ser futura.
                      </span>
                    ) : null}
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-slate-600">Duracion estimada</span>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      value={startDurationMonths}
                      onChange={(event) => setStartDurationMonths(event.target.value)}
                    >
                      {[3, 6, 9, 12, 18, 24, 30, 36].map((months) => (
                        <option key={months} value={months}>
                          {months} meses
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Frecuencia</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">1 control mensual</p>
                    <p className="mt-1 text-xs text-slate-500">Frecuencia sugerida: un control mensual.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Controles planificados</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {startPlannedControls} controles
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Se calculan igual a la duracion seleccionada.
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Finalizacion estimada</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {startExpectedEndDate ? formatDate(startExpectedEndDate) : "Sin fecha"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">No crea una cita automaticamente.</p>
                  </div>
                </div>

                {realControlsCount > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Se encontraron {realControlsCount} controles realizados relacionados con este plan. Se
                    conservaran y seran incluidos en el progreso por controles.
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="bg-white"
                    onClick={() => {
                      setShowStartModal(false);
                      setShowPlanModal(true);
                    }}
                  >
                    Configurar plan completo
                  </Button>
                  <Button variant="ghost" onClick={() => setShowStartModal(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={!startCanSubmit} onClick={() => void handleStart()}>
                    <Play className="mr-1 h-4 w-4" />
                    {startingTreatment ? "Iniciando..." : "Dar inicio"}
                  </Button>
                </div>
              </div>
            </Modal>

            <div className="grid gap-3 md:grid-cols-2">
              <SummaryPanel title="Arcos y alertas">
                <ClinicalStateLine
                  label="Arco superior"
                  source={clinicalState?.upperArchSize ?? clinicalState?.upperArchMaterial}
                />
                <ClinicalStateLine
                  label="Arco inferior"
                  source={clinicalState?.lowerArchSize ?? clinicalState?.lowerArchMaterial}
                />
                <ClinicalStateLine
                  label="Elasticos"
                  source={clinicalState?.elasticsConfig ?? clinicalState?.elasticsType}
                />
                <ClinicalStateLine label="Alerta" source={clinicalState?.alert} />
              </SummaryPanel>
              <SummaryPanel title="Ultima evolucion">
                {latestEvolutionText ? (
                  <p className="line-clamp-6 text-sm leading-6 text-slate-700">{latestEvolutionText}</p>
                ) : (
                  <p className="text-sm text-slate-500">Sin evoluciones registradas.</p>
                )}
                {latestEvolution ? (
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {formatDateTime(latestEvolution.createdAt)}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-4">
                  <Link
                    to={`${APP_ROUTES.patients.clinicalEvolutions(patientId)}?treatmentPlanId=${encodeURIComponent(plan.id)}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
                  >
                    <FileText className="h-4 w-4" />
                    Ver evoluciones
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-sm font-semibold text-sky-700 hover:text-sky-800 hover:bg-sky-50"
                    onClick={() => setIsEvolutionModalOpen(true)}
                  >
                    <MessageSquarePlus className="mr-1 h-4 w-4" />
                    Nueva
                  </Button>
                </div>
              </SummaryPanel>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_0.75fr]">
              <SummaryPanel title="Indicaciones">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {fieldSourceValue(clinicalState?.nextSessionInstructions) ||
                    profileForm.indications ||
                    "Sin indicaciones registradas."}
                </p>
              </SummaryPanel>
              <SummaryPanel title="Alerta clinica">
                <div
                  className={`flex items-start gap-3 rounded-md border p-3 ${fieldSourceValue(clinicalState?.alert) || profileForm.alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm leading-6">
                    {fieldSourceValue(clinicalState?.alert) || profileForm.alert || "Sin alertas activas."}
                  </p>
                </div>
              </SummaryPanel>
            </div>

            <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <SummaryPanel title="Curva de higiene">
                <HygieneCurve points={summary?.hygiene.points ?? []} />
              </SummaryPanel>
              <SummaryPanel title="Evoluciones recientes">
                <div className="divide-y divide-slate-100">
                  {(summary?.recentEvolutions ?? []).slice(0, 5).map((evolution) => (
                    <div key={evolution.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {evolution.professionalName ?? "Profesional no informado"}
                        </p>
                        <p className="text-xs text-slate-500">{formatDateTime(evolution.createdAt)}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                        {evolution.plainText || "Sin nota clinica."}
                      </p>
                    </div>
                  ))}
                  {summary?.recentEvolutions?.length ? null : (
                    <p className="text-sm text-slate-500">Sin evoluciones registradas.</p>
                  )}
                </div>
              </SummaryPanel>
            </div>
          </div>
        ) : null}

        {activeTab === "diagnosis" ? (
          <div className="space-y-4 p-4">
            {diagnosisStatus.isLoading ? <LoadingState message="Consultando diagnostico..." /> : null}
            {currentDiagnosis?.status === "EMPTY" ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                <h3 className="text-base font-semibold text-slate-900">El diagnostico esta vacio</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Captura la informacion clinica inicial para mostrar el resumen del diagnostico.
                </p>
                <Button className="mt-4" onClick={() => setShowDiagnosisModal(true)}>
                  Definir diagnostico
                </Button>
              </div>
            ) : null}
            {currentDiagnosis?.status === "DRAFT" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950">Borrador de diagnostico</h3>
                    <p className="text-sm text-amber-800">Hay informacion capturada pendiente de activar.</p>
                  </div>
                  <Button onClick={() => setShowDiagnosisModal(true)}>Continuar borrador</Button>
                </div>
              </div>
            ) : null}
            {currentDiagnosis?.status === "ACTIVE" ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Resumen del diagnostico</h3>
                    <p className="text-xs text-slate-500">
                      Version {currentDiagnosis.diagnosis?.versionNumber ?? 1}
                      {currentDiagnosis.diagnosis?.activatedAt
                        ? ` - ${formatDateTime(currentDiagnosis.diagnosis.activatedAt)}`
                        : ""}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setShowDiagnosisModal(true)}>
                    Ver / editar
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {currentDiagnosis.summaryItems.length ? (
                    currentDiagnosis.summaryItems.map((item) => (
                      <div
                        key={item.fieldCode}
                        className="rounded-md border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="text-xs font-semibold text-slate-500">{item.fieldName}</p>
                        <p className="mt-1 text-sm text-slate-900">{item.value}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      Diagnostico guardado sin campos marcados para resumen.
                    </p>
                  )}
                </div>
                {currentDiagnosis.sectionsWithData.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentDiagnosis.sectionsWithData.map((section) => (
                      <Badge key={section.code} value={`${section.name}: ${section.count}`} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "photos" ? (
          <PhotographicTemplatesPanel
            treatmentPlanId={plan.id}
            patientId={patientId}
            professionalId={plan.professional.id}
            branchId={plan.branch.id}
            readOnly={isPlanReadOnly}
          />
        ) : null}

        {activeTab === "plan" ? (
          <div className="space-y-4 p-4">
            {technicalPlanEmpty ? (
              <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Plan de tratamiento</h3>
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <p className="text-lg text-slate-500">El plan de tratamiento está vacío</p>
                  <Button className="mt-5" disabled={isPlanReadOnly} onClick={() => setShowPlanModal(true)}>
                    Definir Plan de Tratamiento
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Plan de tratamiento</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Plan de tratamiento definido desde el modal.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={isPlanReadOnly}
                      onClick={() => setShowPlanModal(true)}
                    >
                      Editar Plan de Tratamiento
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Generar mensualidades</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_100px_120px_150px]">
                    <Select
                      value={monthlyForm.procedureId}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, procedureId: event.target.value }))
                      }
                    >
                      <option value="">Seleccionar prestacion</option>
                      {procedures.map((procedure) => (
                        <option key={procedure.id} value={procedure.id}>
                          [{procedure.code}] {procedure.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={monthlyForm.months}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, months: event.target.value }))
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Precio"
                      value={monthlyForm.unitPrice}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, unitPrice: event.target.value }))
                      }
                    />
                    <Input
                      type="date"
                      value={monthlyForm.startDate}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, startDate: event.target.value }))
                      }
                    />
                    <Textarea
                      className="md:col-span-4"
                      rows={2}
                      placeholder="Notas para mensualidades"
                      value={monthlyForm.notes}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button disabled={generatingMonthlyItems} onClick={() => void generateMonthlyItems()}>
                      <Plus className="mr-1 h-4 w-4" />
                      Agregar mensualidades
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === "rx" ? (
          <PlanFilesPanel
            title="Rx y Cf"
            icon={<FileText className="h-4 w-4" />}
            files={rxFiles.data ?? []}
            loading={rxFiles.isLoading}
            uploading={documentMutations.uploadPatientBinaryFile.isPending}
            accept="image/*,.pdf,.dcm,.dicom"
            onUpload={(file) => uploadFile(file, ORTHODONTIC_RX_CATEGORY)}
          />
        ) : null}

        {activeTab === "odontogram" ? <div className="space-y-4 p-4">{odontogramPanel}</div> : null}
      </section>

      <OrthodonticTechnicalPlanModal
        open={showPlanModal}
        plan={plan}
        form={profileForm}
        fields={orthodonticCatalogs.data ?? []}
        loadingCatalogs={orthodonticCatalogs.isLoading}
        saving={savingProfile}
        readOnly={isPlanReadOnly}
        canManageCatalogs={canManageOrthodonticCatalogs}
        onClose={() => setShowPlanModal(false)}
        onPrintDocument={onPrintDocument}
        onFieldChange={updateProfileField}
        onSelectionChange={updateCatalogSelection}
        onSave={() => void saveProfile()}
        onCreateCatalogOption={onCreateCatalogOption}
        onUpdateCatalogOption={onUpdateCatalogOption}
        onDeactivateCatalogOption={onDeactivateCatalogOption}
        onReactivateCatalogOption={onReactivateCatalogOption}
        onSortCatalogOptions={onSortCatalogOptions}
      />

      <OrthodonticDiagnosisModal
        open={showDiagnosisModal}
        plan={plan}
        sections={diagnosisSections}
        values={diagnosisValues}
        activeSection={activeDiagnosisSection}
        loading={orthodonticDiagnosis.isLoading || diagnosisCatalogs.isLoading}
        saving={savingDiagnosis}
        readOnly={readOnlyDiagnosis}
        canManageCatalogs={canManageOrthodonticDiagnosisCatalogs}
        status={currentDiagnosis?.status ?? "EMPTY"}
        onActiveSectionChange={setActiveDiagnosisSection}
        onFieldChange={updateDiagnosisValue}
        onClose={() => setShowDiagnosisModal(false)}
        onSaveDraft={() => void saveDiagnosisDraft()}
        onSaveActive={() => void saveDiagnosisActive()}
        onEditOptions={setEditingDiagnosisField}
      />

      <OrthodonticOptionsModal
        field={editingDiagnosisField}
        canManage={canManageOrthodonticDiagnosisCatalogs}
        onClose={() => setEditingDiagnosisField(null)}
        onCreate={onCreateDiagnosisOption}
        onUpdate={onUpdateDiagnosisOption}
        onDeactivate={onDeactivateDiagnosisOption}
        onReactivate={onReactivateDiagnosisOption}
        onSort={onSortDiagnosisOptions}
      />

      <ClinicalEvolutionModal
        patientId={patientId}
        branchId={plan.branch.id}
        open={isEvolutionModalOpen}
        initialTreatmentPlanId={plan.id}
        onClose={() => setIsEvolutionModalOpen(false)}
      />
    </div>
  );
}
