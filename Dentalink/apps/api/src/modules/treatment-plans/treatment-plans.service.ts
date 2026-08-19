import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AppointmentStatus,
  BudgetStatus,
  HygieneAssessmentStatus,
  LabOrderStatus,
  OrthodonticControlStatus,
  OrthodonticDiagnosisStatus,
  OrthodonticMilestoneStatus,
  PaymentStatus,
  Prisma,
  ProfessionalBranchStatus,
  TreatmentPriceSource,
  ToothProcedureStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanKind,
  TreatmentPlanStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { resolveAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { PricingService } from "../pricing/pricing.service";
import { OrthodonticProgressService } from "../orthodontics/orthodontic-progress.service";
import {
  DiscountAuthorizationService,
  type UserDiscountCapability
} from "../discount-policies/discount-authorization.service";
import {
  BulkDiscountTreatmentPlanItemsDto,
  ChangeTreatmentPlanBranchDto,
  CreateOrthodonticOptionDto,
  CreateAlternativeDto,
  CreateBudgetDto,
  CreateOrthodonticMonthlyItemsDto,
  CreateOrthodonticDiagnosisOptionDto,
  CreateTreatmentPlanDto,
  ListBudgetsQueryDto,
  ListTreatmentPlansQueryDto,
  OrthodonticEvolutionsQueryDto,
  PrintTreatmentPlanDocumentDto,
  SaveOrthodonticDiagnosisDto,
  SortOrthodonticDiagnosisOptionsDto,
  SortOrthodonticOptionsDto,
  UpdateOrthodonticDiagnosisOptionDto,
  TreatmentPlanSectionInputDto,
  UpdateOrthodonticOptionDto,
  UpdateOrthodonticDiagnosisDto,
  UpdateOrthodonticProfileDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanItemDto,
  UpdateTreatmentPlanItemStatusDto,
  ReactivateTreatmentPlanDto,
  DeactivateTreatmentPlanDto,
  DuplicateTreatmentPlanDto,
  ReferTreatmentPlanDto,
  RepriceTreatmentPlanDto,
  StartOrthodonticTreatmentDto,
  TreatmentPlanPricePreviewDto
} from "./dto/treatment-plan.dto";
import {
  buildTreatmentPlanDocumentPdf,
  type TreatmentPlanDocumentImage,
  type TreatmentPlanDocumentInput,
  type TreatmentPlanDocumentItem,
  type TreatmentPlanDocumentOdontogram,
  type TreatmentPlanDocumentOdontogramRecord
} from "./treatment-plan-documents";
import {
  calculateTreatmentPlanClinicalProgress,
  resolveTreatmentPlanClinicalStatus,
  resolveTreatmentPlanStatusFromClinicalProgress
} from "./treatment-plan-progress";
import { TreatmentPlanFinancialSummaryService } from "./treatment-plan-financial-summary.service";
import { CrmTasksService } from "../crm-tasks/crm-tasks.service";

type TreatmentAgreementSnapshot = {
  id?: string | null;
  isActive?: boolean;
  status?: string;
  version?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priceListId?: string | null;
  discountPercent?: Prisma.Decimal | number | string | null;
} | null;

type TreatmentPatientForPricing = {
  agreement?: {
    id?: string | null;
    isActive?: boolean;
    status?: string;
    version?: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    priceListId?: string | null;
    discountPercent?: Prisma.Decimal | number | string | null;
  } | null;
};

type ProcedurePriceSnapshot = {
  unitPrice: number;
  priceListId: string | null;
  priceListItemId: string | null;
  priceSource: TreatmentPriceSource;
  priceSnapshotName: string | null;
  priceSnapshotCode: string | null;
  priceSnapshotCategory: string | null;
  priceResolvedAt: Date | null;
  priceListVersionId?: string | null;
  priceListVersionNumber?: number | null;
  priceListVersionItemId?: string | null;
  priceCurrency?: "MXN" | "USD" | "EUR";
  laboratoryCostSnapshot?: number;
  internalCostSnapshot?: number;
  pricingRuleSnapshot?: Prisma.InputJsonValue;
  pricedById?: string | null;
  procedureNameSnapshot?: string | null;
  allowsDiscountSnapshot?: boolean;
  maximumDiscountPercentSnapshot?: number;
};

type TreatmentPlanItemBuildInput = Required<
  Pick<UpdateTreatmentPlanItemDto, "procedureId" | "quantity" | "unitPrice" | "discount">
> &
  UpdateTreatmentPlanItemDto &
  ProcedurePriceSnapshot & {
    agreementPricing?: AgreementItemPricing | null;
    manualDiscountAuthorization?: ManualDiscountAuthorization | null;
  };

type ManualDiscountAuthorization = {
  requestedPercent: Prisma.Decimal;
  userMaximumPercent: Prisma.Decimal;
  procedureMaximumPercent: Prisma.Decimal;
  effectiveMaximumPercent: Prisma.Decimal;
};

type AgreementItemPricing = {
  agreementId: string;
  agreementVersionId: string | null;
  agreementVersionNumber: number;
  snapshot: Prisma.InputJsonValue;
  normalPrice: number;
  appliedPrice: number;
  discountAmount: number;
  coverageAmount: number;
};

type ProfessionalPlanSpecialty = {
  id: string;
  name: string;
  kind: TreatmentPlanKind;
};

type OrthodonticOptionFieldSeed = {
  code: string;
  name: string;
  inputType: "select" | "multiselect";
  allowsMultiple: boolean;
  options: string[];
};

type OrthodonticCatalogFieldRow = {
  id: string;
  code: string;
  name: string;
  inputType: string;
  allowsMultiple: boolean;
  isConfigurable: boolean;
  isActive: boolean;
  options: Array<{
    id: string;
    label: string;
    code: string;
    sortOrder: number;
    isActive: boolean;
    version: number;
  }>;
};

type OrthodonticDiagnosisInputType = "text" | "textarea" | "number" | "select" | "checkbox";

type OrthodonticDiagnosisFieldSeed = {
  code: string;
  name: string;
  inputType: OrthodonticDiagnosisInputType;
  allowsMultiple?: boolean;
  isHighlighted?: boolean;
  includeInSummary?: boolean;
  unitType?: string;
  options?: string[];
};

type OrthodonticDiagnosisSectionSeed = {
  code: string;
  name: string;
  sortOrder: number;
  fields: OrthodonticDiagnosisFieldSeed[];
};

const TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE: Record<string, string> = {
  BUDGET_COMPLETE: "print_complete_budget",
  BUDGET_TOTAL_ONLY: "print_total_only_budget",
  BUDGET_NO_DETAIL: "print_budget_without_values",
  LAB_ORDER: "print_laboratory_order",
  CARE_PLAN: "print_care_plan",
  SECTIONS: "print_treatment_sections",
  ODONTOGRAM: "print_odontogram",
  CLINICAL_HISTORY: "print_clinical_history"
};

const TREATMENT_PLAN_PRINT_LABEL_BY_TYPE: Record<string, string> = {
  BUDGET_COMPLETE: "Presupuesto completo",
  BUDGET_TOTAL_ONLY: "Presupuesto con total general",
  BUDGET_NO_DETAIL: "Presupuesto sin valores",
  LAB_ORDER: "Orden de laboratorio",
  CARE_PLAN: "Plan de atencion",
  SECTIONS: "Secciones",
  ODONTOGRAM: "Odontograma",
  CLINICAL_HISTORY: "Historial clinico"
};

const TREATMENT_PLAN_PRINT_DESCRIPTION_BY_TYPE: Record<string, string> = {
  BUDGET_COMPLETE: "Muestra procedimientos, importes individuales, resumen y estado de cuenta.",
  BUDGET_TOTAL_ONLY: "Muestra procedimientos y el total final, sin precios unitarios.",
  BUDGET_NO_DETAIL: "Muestra el detalle clinico sin informacion economica.",
  LAB_ORDER: "Imprime la orden de laboratorio vinculada al plan.",
  CARE_PLAN: "Documento clinico agrupado por secciones, sin informacion economica.",
  SECTIONS: "Permite imprimir las secciones del plan.",
  ODONTOGRAM: "Imprime el odontograma y su tabla de hallazgos.",
  CLINICAL_HISTORY: "Imprime el historial clinico del paciente."
};

const ORTHODONTIC_PLAN_FIELD_SEEDS: OrthodonticOptionFieldSeed[] = [
  {
    code: "treatment_type",
    name: "Tipo de tratamiento",
    inputType: "select",
    allowsMultiple: false,
    options: ["Interceptivo", "Correctivo", "Ortodoncia fija", "Alineadores", "Retencion"]
  },
  {
    code: "treatment_time",
    name: "Tiempo de tratamiento",
    inputType: "select",
    allowsMultiple: false,
    options: ["3 meses", "6 meses", "9 meses", "12 meses", "18 meses", "24 meses", "30 meses", "36 meses"]
  },
  {
    code: "upper_anchor",
    name: "Anclaje superior",
    inputType: "multiselect",
    allowsMultiple: true,
    options: ["Absoluto", "Maximo", "Medio", "Minimo"]
  },
  {
    code: "lower_anchor",
    name: "Anclaje inferior",
    inputType: "multiselect",
    allowsMultiple: true,
    options: ["Maximo", "Medio", "Minimo", "Minimo absoluto"]
  },
  {
    code: "attachments",
    name: "Aditamentos",
    inputType: "multiselect",
    allowsMultiple: true,
    options: [
      "Microtornillos",
      "Miniplacas",
      "Jigz",
      "Suzuki Shelf",
      "Barra Palatina",
      "SSP Inferior",
      "Topes"
    ]
  },
  {
    code: "radiographic_control",
    name: "Tipo de control radiografico",
    inputType: "multiselect",
    allowsMultiple: true,
    options: ["Panoramica", "Tele", "Marzo", "Scanner ATM post", "Depuracion"]
  },
  {
    code: "periodicity",
    name: "Periodicidad",
    inputType: "select",
    allowsMultiple: false,
    options: ["Mensual", "Bimensual", "Trimestral", "Semestral", "Anual"]
  },
  {
    code: "brackets",
    name: "Brackets",
    inputType: "multiselect",
    allowsMultiple: true,
    options: ["Estandar", "Alexander/American Orthodontic", "Esteticos", "Autoligados"]
  },
  {
    code: "aligners",
    name: "Alineadores",
    inputType: "multiselect",
    allowsMultiple: true,
    options: ["Invisalign"]
  },
  {
    code: "plates",
    name: "Placas",
    inputType: "multiselect",
    allowsMultiple: true,
    options: [
      "Arco Lingual",
      "Arco Transpalatino",
      "Bionator",
      "Bite Plane Anterior",
      "Frankel",
      "Hass",
      "Hyrax",
      "Lip Bumper",
      "Placa Schwarz",
      "Plano inclinado",
      "Transpalatino"
    ]
  },
  {
    code: "upper_tubes",
    name: "Tubos superiores",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "6", "7", "6 y 7"]
  },
  {
    code: "lower_tubes",
    name: "Tubos inferiores",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "6", "7", "6 y 7"]
  },
  {
    code: "upper_bands",
    name: "Bandas superiores",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "6", "7", "6 y 7"]
  },
  {
    code: "lower_bands",
    name: "Bandas inferiores",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "6", "7", "6 y 7"]
  },
  {
    code: "upper_anterior_cementation",
    name: "Cementacion superior anterior",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "Directa", "Indirecta"]
  },
  {
    code: "upper_posterior_cementation",
    name: "Cementacion superior posterior",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "Directa", "Indirecta"]
  },
  {
    code: "lower_anterior_cementation",
    name: "Cementacion inferior anterior",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "Directa", "Indirecta"]
  },
  {
    code: "lower_posterior_cementation",
    name: "Cementacion inferior posterior",
    inputType: "select",
    allowsMultiple: false,
    options: ["Sin definir", "Directa", "Indirecta"]
  }
];

const COMMON_OCCLUSAL_OPTIONS = ["Normal", "Aumentado", "Disminuido", "Desviado", "No evaluado"];
const CLASS_OPTIONS = ["Clase I", "Clase II", "Clase III", "No evaluado"];
const YES_NO_OPTIONS = ["Si", "No", "No evaluado"];
const AIRWAY_OPTIONS = ["Nasal", "Bucal", "Mixta", "No evaluado"];

const ORTHODONTIC_DIAGNOSIS_SECTION_SEEDS: OrthodonticDiagnosisSectionSeed[] = [
  {
    code: "generales",
    name: "Generales",
    sortOrder: 10,
    fields: [
      {
        code: "motivo_consulta",
        name: "Motivo de consulta",
        inputType: "textarea",
        isHighlighted: true,
        includeInSummary: true
      },
      {
        code: "malos_habitos",
        name: "Malos habitos",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        includeInSummary: true,
        options: [
          "Bruxismo Diurno",
          "Bruxismo Nocturno",
          "Onicofagia",
          "Uso prolongado chupete",
          "Uso prolongado mamadera",
          "Succion digital",
          "Interposicion lingual",
          "Dificultad para articular un sonido",
          "Dificultad al masticar",
          "Respiracion bucal",
          "Mordida profunda"
        ]
      },
      { code: "rx_mano", name: "Rx Mano", inputType: "select", isHighlighted: true, options: YES_NO_OPTIONS }
    ]
  },
  {
    code: "caracteristicas_faciales",
    name: "Caracteristicas faciales",
    sortOrder: 20,
    fields: [
      {
        code: "asimetria_williams",
        name: "Asimetria de Williams",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "desviacion_mandibular",
        name: "Desviacion mandibular",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "exposicion_gingival",
        name: "Exposicion gingival",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "cierre_labial",
        name: "Cierre labial",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "clase_facial_sagital",
        name: "Clase facial sagital",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: CLASS_OPTIONS
      },
      {
        code: "tercio_inferior",
        name: "Tercio inferior",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      { code: "labio_superior", name: "Labio superior", inputType: "text", isHighlighted: true },
      { code: "labio_inferior", name: "Labio inferior", inputType: "text", isHighlighted: true },
      { code: "menton", name: "Menton", inputType: "text", isHighlighted: true }
    ]
  },
  {
    code: "analisis_oclusal_dentario",
    name: "Analisis oclusal y dentario",
    sortOrder: 30,
    fields: [
      {
        code: "etapa_denticion",
        name: "Etapa denticion",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: ["Temporal", "Mixta temprana", "Mixta tardia", "Permanente", "No evaluado"]
      },
      {
        code: "linea_media_superior",
        name: "Linea media superior",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "linea_media_inferior",
        name: "Linea media inferior",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "clase_molar_izquierda",
        name: "Clase molar izquierda",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: CLASS_OPTIONS
      },
      {
        code: "clase_molar_derecha",
        name: "Clase molar derecha",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: CLASS_OPTIONS
      },
      {
        code: "clase_canina_izquierda",
        name: "Clase canina izquierda",
        inputType: "select",
        isHighlighted: true,
        options: CLASS_OPTIONS
      },
      {
        code: "clase_canina_derecha",
        name: "Clase canina derecha",
        inputType: "select",
        isHighlighted: true,
        options: CLASS_OPTIONS
      },
      {
        code: "overjet",
        name: "Overjet",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "curva_spee",
        name: "Curva de Spee",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "overbite",
        name: "Overbite",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "inclinacion_plano_oclusal",
        name: "Inclinacion de plano oclusal",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "mordida",
        name: "Mordida",
        inputType: "select",
        isHighlighted: true,
        options: ["Abierta", "Cruzada", "Profunda", "Borde a borde", "Normal", "No evaluado"]
      },
      {
        code: "curva_wilson",
        name: "Curva de Wilson",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "arco_superior",
        name: "Arco superior",
        inputType: "select",
        isHighlighted: true,
        options: ["Ovalado", "Triangular", "Cuadrado", "No evaluado"]
      },
      {
        code: "arco_inferior",
        name: "Arco inferior",
        inputType: "select",
        isHighlighted: true,
        options: ["Ovalado", "Triangular", "Cuadrado", "No evaluado"]
      }
    ]
  },
  {
    code: "dentoalveolar",
    name: "Dentoalveolar",
    sortOrder: 40,
    fields: [
      {
        code: "discrepancia_dent_sup",
        name: "Discrepancia dent. sup.",
        inputType: "number",
        isHighlighted: true,
        unitType: "mm",
        includeInSummary: true
      },
      {
        code: "discrepancia_dent_inf",
        name: "Discrepancia dent. inf.",
        inputType: "number",
        isHighlighted: true,
        unitType: "mm",
        includeInSummary: true
      },
      {
        code: "discrepancia_posterior",
        name: "Discrepancia posterior",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      { code: "indice_bolton", name: "Indice de Bolton", inputType: "number", isHighlighted: true },
      {
        code: "supernumerarios_agenesias",
        name: "Supernum. / Agenesias",
        inputType: "text",
        isHighlighted: true
      },
      { code: "ausentes_retenidos", name: "Ausentes / Retenidos", inputType: "text", isHighlighted: true },
      {
        code: "segundos_molares",
        name: "Segundos molares",
        inputType: "select",
        isHighlighted: true,
        options: YES_NO_OPTIONS
      },
      {
        code: "terceros_molares",
        name: "Terceros molares",
        inputType: "select",
        isHighlighted: true,
        options: YES_NO_OPTIONS
      },
      { code: "trauma", name: "Trauma", inputType: "text", isHighlighted: true },
      { code: "facetas_desgaste", name: "Facetas de desgaste", inputType: "text", isHighlighted: true },
      { code: "caries", name: "Caries", inputType: "text", isHighlighted: true },
      { code: "otros_dentoalveolar", name: "Otros", inputType: "text", isHighlighted: true },
      {
        code: "radiografia_panoramica",
        name: "Radiografia panoramica",
        inputType: "textarea",
        isHighlighted: true
      }
    ]
  },
  {
    code: "montaje_articulador",
    name: "Montaje articulador",
    sortOrder: 50,
    fields: [
      {
        code: "discrepancia_rcoc",
        name: "Discrepancia RCOC",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      { code: "contacto_prematuro", name: "Contacto prematuro", inputType: "text", isHighlighted: true },
      { code: "rotacion_molar", name: "Rotacion molar", inputType: "text", isHighlighted: true },
      { code: "torque_molar", name: "Torque molar", inputType: "text", isHighlighted: true },
      { code: "cpi_derecho", name: "CPI derecho", inputType: "text", isHighlighted: true },
      { code: "cpi_transversal", name: "CPI transversal", inputType: "text", isHighlighted: true },
      { code: "cpi_izquierdo", name: "CPI izquierdo", inputType: "text", isHighlighted: true }
    ]
  },
  {
    code: "analisis_periodontal",
    name: "Analisis periodontal",
    sortOrder: 60,
    fields: [
      {
        code: "higiene",
        name: "Higiene",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: ["Buena", "Regular", "Deficiente", "No evaluado"]
      },
      {
        code: "biotipo_periodontal",
        name: "Biotipo periodontal",
        inputType: "select",
        isHighlighted: true,
        options: ["Fino", "Grueso", "Mixto", "No evaluado"]
      },
      {
        code: "recesiones",
        name: "Recesiones",
        inputType: "select",
        isHighlighted: true,
        options: YES_NO_OPTIONS
      },
      {
        code: "hiperplasia_gingival",
        name: "Hiperplasia gingival",
        inputType: "select",
        isHighlighted: true,
        options: YES_NO_OPTIONS
      },
      {
        code: "eminencias_radiculares",
        name: "Eminencias radiculares",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "frenillo_lingual",
        name: "Frenillo lingual",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "frenillo_medio_superior",
        name: "Frenillo medio superior",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "frenillo_medio_inferior",
        name: "Frenillo medio inferior",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "frenillos_laterales",
        name: "Frenillos laterales",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      { code: "otros_periodontal", name: "Otros", inputType: "textarea", isHighlighted: true }
    ]
  },
  {
    code: "atm_muscular",
    name: "Analisis ATM/Muscular",
    sortOrder: 70,
    fields: [
      {
        code: "manipulacion_mandibular",
        name: "Manipulacion mandibular",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "atm_derecha",
        name: "ATM derecha",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: ["Sin alteraciones", "Click", "Crepito", "Apertura", "Cierre"]
      },
      {
        code: "atm_izquierda",
        name: "ATM izquierda",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: ["Sin alteraciones", "Click", "Crepito", "Apertura", "Cierre"]
      },
      {
        code: "palpacion_muscular",
        name: "Palpacion muscular",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: ["Temporal", "Masetero", "ECM", "Intramaseo"]
      },
      {
        code: "patron_apertura",
        name: "Patron de apertura",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: [
          "Hiperlaxitud",
          "Limitada",
          "Maxima sin dolor",
          "Maxima con dolor centrada",
          "Desviacion derecha",
          "Desviacion izquierda"
        ]
      },
      { code: "dx_cbct", name: "Dx CBCT", inputType: "text", isHighlighted: true },
      { code: "dx_rnm", name: "Dx RNM", inputType: "text", isHighlighted: true },
      { code: "otros_atm", name: "Otros", inputType: "text", isHighlighted: true }
    ]
  },
  {
    code: "via_aerea",
    name: "Analisis via aerea",
    sortOrder: 80,
    fields: [
      { code: "volumen_via_aerea", name: "Volumen via aerea", inputType: "text", isHighlighted: true },
      {
        code: "tipo_respiracion",
        name: "Tipo de respiracion",
        inputType: "select",
        isHighlighted: true,
        includeInSummary: true,
        options: AIRWAY_OPTIONS
      },
      {
        code: "sueno",
        name: "Sueno",
        inputType: "select",
        isHighlighted: true,
        options: ["Normal", "Ronquido", "Apnea sospechada", "No evaluado"]
      },
      { code: "otros_via_aerea", name: "Otros", inputType: "text", isHighlighted: true }
    ]
  },
  {
    code: "cefalometrico",
    name: "Analisis cefalometrico",
    sortOrder: 90,
    fields: [
      { code: "ricketts_vert", name: "Ricketts - Vert", inputType: "text", isHighlighted: true },
      {
        code: "ricketts_tipo",
        name: "Ricketts - Tipo",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: ["Braquifacial", "Mesofacial", "Dolicofacial"]
      },
      {
        code: "ricketts_nivel",
        name: "Ricketts - Nivel",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "jarabak_tipo",
        name: "Jarabak - Tipo",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: ["Antihorario", "Neutro", "Horario"]
      },
      {
        code: "jarabak_nivel",
        name: "Jarabak - Nivel",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      { code: "jarabak_porcentaje", name: "Jarabak - Porcentaje", inputType: "number", isHighlighted: true },
      {
        code: "inclinacion_incisivo_superior",
        name: "Inclinacion incisivo superior",
        inputType: "text",
        isHighlighted: true
      },
      {
        code: "inclinacion_incisivo_inferior",
        name: "Inclinacion incisivo inferior",
        inputType: "text",
        isHighlighted: true
      }
    ]
  },
  {
    code: "clase_esqueletal",
    name: "Clase esqueletal",
    sortOrder: 100,
    fields: [
      {
        code: "componente_sagital_vertical",
        name: "Componente",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        options: ["Vertical", "Sagital"]
      },
      { code: "anb", name: "ANB", inputType: "number", isHighlighted: true, includeInSummary: true },
      { code: "witts_verdadero", name: "WITS verdadero", inputType: "number", isHighlighted: true },
      {
        code: "clase_esqueletal",
        name: "Clase",
        inputType: "checkbox",
        allowsMultiple: true,
        isHighlighted: true,
        includeInSummary: true,
        options: ["Clase I", "Clase II", "Clase III"]
      },
      {
        code: "exceso_vertical_maxilar",
        name: "Exceso vertical maxilar",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "incisivo_inferior_stomion_superior",
        name: "Incisivo inferior a Stomion superior",
        inputType: "text",
        isHighlighted: true
      },
      {
        code: "incisivo_superior_stomion",
        name: "Incisivo superior a Stomion",
        inputType: "text",
        isHighlighted: true
      },
      { code: "analisis_penn", name: "Analisis Penn", inputType: "text", isHighlighted: true },
      {
        code: "ancho_sinfisis_grupo_v",
        name: "Ancho sinfisis grupo V",
        inputType: "select",
        isHighlighted: true,
        options: COMMON_OCCLUSAL_OPTIONS
      },
      {
        code: "otros_factores_determinantes",
        name: "Otros factores determinantes",
        inputType: "textarea",
        isHighlighted: true
      }
    ]
  }
];

const CLOSED_TREATMENT_PLAN_STATUSES = new Set<TreatmentPlanStatus>([
  TreatmentPlanStatus.CANCELLED,
  TreatmentPlanStatus.REJECTED
]);

@Injectable()
export class TreatmentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing?: PricingService,
    private readonly orthodonticProgressService?: OrthodonticProgressService,
    private readonly discountAuthorization?: DiscountAuthorizationService,
    private readonly financialSummaryService?: TreatmentPlanFinancialSummaryService,
    private readonly crmTasksService?: CrmTasksService
  ) {}

  async listTreatmentPlans(actor: AuthUser, query: ListTreatmentPlansQueryDto) {
    const { skip, take } = resolvePagination(query);
    const trimmedPatientId = query.patientId?.trim();
    const isNumericPatient = trimmedPatientId ? /^\d+$/.test(trimmedPatientId) : false;

    const rows = await this.prisma.treatmentPlan.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(trimmedPatientId
          ? {
              patient: {
                organizationId: actor.organizationId,
                branchId: branchScope(actor),
                deletedAt: null,
                ...(isNumericPatient
                  ? { OR: [{ id: trimmedPatientId }, { patientNumber: parseInt(trimmedPatientId, 10) }] }
                  : { id: trimmedPatientId })
              }
            }
          : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.professionalId ? { professionalId: query.professionalId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {})
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialties: { include: { specialty: { select: { id: true, name: true } } } }
          }
        },
        agreement: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
            payrollDiscount: true,
            isActive: true,
            status: true,
            priceListId: true,
            priceList: { select: { id: true, name: true, isDefault: true } }
          }
        },
        specialty: { select: { id: true, name: true } },
        orthodonticProfile: { include: this.orthodonticProfileCatalogInclude() },
        pauses: true,
        branch: { select: { id: true, name: true } },
        items: true,
        budgets: true,
        appointments: {
          select: { id: true, startAt: true, status: true },
          orderBy: { startAt: "desc" },
          take: 1
        },
        orthodonticControls: {
          where: {
            status: OrthodonticControlStatus.COMPLETED,
            annulledAt: null,
            clinicalConfirmed: true
          },
          select: { id: true },
          orderBy: [{ clinicalDate: "asc" }, { createdAt: "asc" }]
        },
        clinicalEvolutions: {
          where: { annulledAt: null },
          select: {
            id: true,
            createdAt: true,
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            notes: true
          },
          orderBy: { createdAt: "desc" },
          take: 100
        }
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });

    const summaries = this.financialSummaryService
      ? await this.financialSummaryService.calculateBatch(
          actor,
          rows.map((row) => row.id)
        )
      : new Map();

    return rows.map((row) => ({
      ...this.withTreatmentPlanDerivedState(row, {
        itemsCount: row.items.length,
        budgetCount: row.budgets.length
      }),
      financialSummary: summaries.get(row.id) ?? null
    }));
  }

  async createTreatmentPlan(actor: AuthUser, dto: CreateTreatmentPlanDto) {
    await this.validateBranch(actor, dto.branchId);
    const patient = await this.validatePatient(actor, dto.patientId);
    const agreement = await this.resolveTreatmentAgreement(
      actor,
      dto.branchId,
      dto.agreementId ?? patient.agreement?.id
    );
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      dto.professionalId,
      dto.branchId,
      dto.kind
    );
    if (dto.parentTreatmentPlanId) await this.ensureTreatmentPlan(actor, dto.parentTreatmentPlanId);

    const created = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          agreementId: agreement?.id ?? null,
          agreementVersionNumber: agreement?.version ?? null,
          agreementSnapshot: agreement ? this.treatmentAgreementSnapshot(agreement) : undefined,
          professionalId: dto.professionalId,
          kind: planSpecialty.kind,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          status: dto.status ?? TreatmentPlanStatus.DRAFT,
          isAlternative: dto.isAlternative ?? false,
          parentTreatmentPlanId: dto.parentTreatmentPlanId
        }
      });

      if (planSpecialty.kind === TreatmentPlanKind.ORTHODONTICS) {
        await tx.orthodonticTreatmentProfile.create({
          data: { treatmentPlanId: plan.id }
        });
      }

      if (dto.sections?.length) {
        for (const section of dto.sections) {
          await tx.treatmentPlanSection.create({
            data: {
              treatmentPlanId: plan.id,
              name: section.name.trim(),
              sortOrder: section.sortOrder ?? 0
            }
          });
        }
      }

      if (dto.items?.length) {
        for (const item of dto.items) {
          await this.validateProcedureInTransaction(tx, actor, item.procedureId);
          if (item.sectionId) await this.validateSectionInTransaction(tx, plan.id, item.sectionId);

          const itemPayload = await this.resolveItemPayload(actor, dto.branchId, patient, item, agreement);
          await tx.treatmentPlanItem.create({
            data: this.buildItemData(plan.id, itemPayload, agreement, actor.id)
          });
        }
      }

      if (dto.parentTreatmentPlanId) {
        await tx.treatmentPlanAlternative.upsert({
          where: {
            parentTreatmentPlanId_alternativeTreatmentPlanId: {
              parentTreatmentPlanId: dto.parentTreatmentPlanId,
              alternativeTreatmentPlanId: plan.id
            }
          },
          update: {},
          create: {
            parentTreatmentPlanId: dto.parentTreatmentPlanId,
            alternativeTreatmentPlanId: plan.id
          }
        });
      }

      return plan;
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      created.id,
      "create",
      {},
      {
        name: created.name,
        status: created.status,
        isAlternative: created.isAlternative,
        kind: created.kind,
        specialtySnapshotName: created.specialtySnapshotName
      }
    );
    return this.getTreatmentPlan(actor, created.id);
  }

  async listOrthodonticOptionFields(actor: AuthUser) {
    await this.ensureOrthodonticCatalogSeed(actor.organizationId, actor.id);
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async createOrthodonticFieldOption(actor: AuthUser, fieldId: string, dto: CreateOrthodonticOptionDto) {
    const label = this.cleanOptionLabel(dto.label);
    const field = await (this.prisma as any).orthodonticOptionField.findFirst({
      where: { id: fieldId, organizationId: actor.organizationId }
    });
    if (!field) throw new NotFoundException("Orthodontic option field not found");
    const normalizedLabel = this.normalizeOptionLabel(label);
    const existing = await (this.prisma as any).orthodonticFieldOption.findUnique({
      where: { fieldId_normalizedLabel: { fieldId, normalizedLabel } }
    });
    if (existing) throw new BadRequestException("An equivalent option already exists for this field");
    const max = await (this.prisma as any).orthodonticFieldOption.aggregate({
      where: { fieldId },
      _max: { sortOrder: true }
    });
    const created = await (this.prisma as any).orthodonticFieldOption.create({
      data: {
        fieldId,
        code: this.optionCode(label),
        label,
        normalizedLabel,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        createdById: actor.id,
        updatedById: actor.id
      }
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      created.id,
      "create",
      {},
      created as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async updateOrthodonticFieldOption(actor: AuthUser, optionId: string, dto: UpdateOrthodonticOptionDto) {
    const current = await this.findOrthodonticOptionForActor(actor, optionId);
    const data: Record<string, unknown> = {
      updatedById: actor.id,
      version: { increment: 1 }
    };
    if (dto.label !== undefined) {
      const label = this.cleanOptionLabel(dto.label);
      const normalizedLabel = this.normalizeOptionLabel(label);
      const usedCount = await this.countOrthodonticOptionUsage(optionId);
      if (usedCount > 0 && normalizedLabel !== current.normalizedLabel) {
        throw new BadRequestException(
          "Used options cannot be renamed; create a new option and deactivate the previous one"
        );
      }
      data.label = label;
      data.normalizedLabel = normalizedLabel;
      data.code = this.optionCode(label);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const updated = await (this.prisma as any).orthodonticFieldOption.update({
      where: { id: optionId },
      data
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      optionId,
      "update",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async deactivateOrthodonticFieldOption(actor: AuthUser, optionId: string, reason?: string) {
    const current = await this.findOrthodonticOptionForActor(actor, optionId);
    const updated = await (this.prisma as any).orthodonticFieldOption.update({
      where: { id: optionId },
      data: {
        isActive: false,
        deactivatedById: actor.id,
        deactivatedAt: new Date(),
        deactivationReason: reason?.trim() || null,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      optionId,
      "deactivate",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async reactivateOrthodonticFieldOption(actor: AuthUser, optionId: string) {
    const current = await this.findOrthodonticOptionForActor(actor, optionId);
    const activeEquivalent = await (this.prisma as any).orthodonticFieldOption.findFirst({
      where: {
        fieldId: current.fieldId,
        normalizedLabel: current.normalizedLabel,
        isActive: true,
        id: { not: optionId }
      }
    });
    if (activeEquivalent) throw new BadRequestException("An active equivalent option already exists");
    const updated = await (this.prisma as any).orthodonticFieldOption.update({
      where: { id: optionId },
      data: {
        isActive: true,
        reactivatedById: actor.id,
        reactivatedAt: new Date(),
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      optionId,
      "reactivate",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async sortOrthodonticFieldOptions(actor: AuthUser, fieldId: string, dto: SortOrthodonticOptionsDto) {
    const field = await (this.prisma as any).orthodonticOptionField.findFirst({
      where: { id: fieldId, organizationId: actor.organizationId },
      include: { options: true }
    });
    if (!field) throw new NotFoundException("Orthodontic option field not found");
    const knownIds = new Set(field.options.map((option: { id: string }) => option.id));
    if (dto.optionIds.some((id) => !knownIds.has(id))) {
      throw new BadRequestException("One or more options do not belong to this field");
    }
    await this.prisma.$transaction(
      dto.optionIds.map((id, index) =>
        (this.prisma as any).orthodonticFieldOption.update({
          where: { id },
          data: { sortOrder: index, updatedById: actor.id, version: { increment: 1 } }
        })
      )
    );
    await this.audit(actor, "OrthodonticOptionField", fieldId, "sort_options", {}, {
      optionIds: dto.optionIds
    } as Prisma.InputJsonValue);
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async getTreatmentPlan(actor: AuthUser, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialties: { include: { specialty: { select: { id: true, name: true } } } }
          }
        },
        agreement: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
            payrollDiscount: true,
            isActive: true,
            status: true,
            priceListId: true,
            priceList: { select: { id: true, name: true, isDefault: true } }
          }
        },
        specialty: { select: { id: true, name: true } },
        orthodonticProfile: { include: this.orthodonticProfileCatalogInclude() },
        pauses: true,
        branch: { select: { id: true, name: true } },
        sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        items: {
          include: {
            procedure: { select: { id: true, code: true, name: true } },
            section: true,
            paymentAllocations: { select: { id: true, amount: true, settlementDiscountAmount: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        budgets: {
          include: { items: true },
          orderBy: { createdAt: "desc" }
        },
        orthodonticControls: {
          where: {
            status: OrthodonticControlStatus.COMPLETED,
            annulledAt: null,
            clinicalConfirmed: true
          },
          select: { id: true },
          orderBy: [{ clinicalDate: "asc" }, { createdAt: "asc" }]
        },
        alternativePlans: {
          include: {
            items: true,
            professional: { select: { firstName: true, lastName: true } }
          }
        },
        clinicalEvolutions: {
          where: { annulledAt: null },
          select: {
            id: true,
            createdAt: true,
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            notes: true
          },
          orderBy: { createdAt: "desc" },
          take: 24
        },
        alternativesAsParent: {
          include: {
            alternativeTreatmentPlan: {
              include: { items: true, professional: { select: { firstName: true, lastName: true } } }
            }
          }
        }
      }
    });

    if (!plan) throw new NotFoundException("Treatment plan not found");
    const financialSummary = this.financialSummaryService
      ? await this.financialSummaryService.calculateForPlan(actor, id)
      : null;
    return { ...this.withTreatmentPlanDerivedState(plan), financialSummary };
  }

  async getFinancialSummary(actor: AuthUser, id: string) {
    if (!this.financialSummaryService) {
      throw new NotFoundException("Treatment plan financial summary is unavailable");
    }
    return this.financialSummaryService.calculateForPlan(actor, id);
  }

  async updateTreatmentPlan(actor: AuthUser, id: string, dto: UpdateTreatmentPlanDto) {
    const current = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(current);
    if (dto.status && CLOSED_TREATMENT_PLAN_STATUSES.has(dto.status)) {
      throw new BadRequestException("Use the treatment plan deactivation endpoint to close a plan");
    }
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);
    let planSpecialty: ProfessionalPlanSpecialty | null = null;
    if (dto.branchId || dto.professionalId) {
      planSpecialty = await this.validateProfessionalPlanSpecialty(
        actor,
        dto.professionalId ?? current.professionalId,
        dto.branchId ?? current.branchId,
        current.kind
      );
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        specialtyId: planSpecialty?.id,
        specialtySnapshotName: planSpecialty?.name,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        status: dto.status,
        acceptedAt:
          dto.status === TreatmentPlanStatus.ACCEPTED
            ? (current.acceptedAt ?? new Date())
            : current.acceptedAt,
        completedAt:
          dto.status === TreatmentPlanStatus.COMPLETED
            ? (current.completedAt ?? new Date())
            : current.completedAt
      }
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "update",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async updateOrthodonticProfile(actor: AuthUser, id: string, dto: UpdateOrthodonticProfileDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "update orthodontic data for");
    const payload = {
      technicalDescription: this.optionalString(dto.technicalDescription),
      startDate: this.optionalDate(dto.startDate),
      estimatedMonths: dto.estimatedMonths === undefined ? undefined : dto.estimatedMonths,
      estimatedControls: dto.estimatedControls === undefined ? undefined : dto.estimatedControls,
      totalAligners: dto.totalAligners === undefined ? undefined : dto.totalAligners,
      indicatedExtractions: this.optionalString(dto.indicatedExtractions),
      performedExtractions: this.optionalString(dto.performedExtractions),
      reevaluationDate: this.optionalDate(dto.reevaluationDate),
      interconsultations: this.optionalString(dto.interconsultations),
      lastUpperArch: this.optionalString(dto.lastUpperArch),
      lastLowerArch: this.optionalString(dto.lastLowerArch),
      nextControlAt: this.optionalDate(dto.nextControlAt),
      nextRadiographyAt: this.optionalDate(dto.nextRadiographyAt),
      hygieneStatus: this.optionalString(dto.hygieneStatus),
      alert: this.optionalString(dto.alert),
      indications: this.optionalString(dto.indications),
      elastics: this.optionalString(dto.elastics),
      planNotes: this.optionalString(dto.planNotes)
    };

    const previous = await (this.prisma as any).orthodonticTreatmentProfile.findUnique({
      where: { treatmentPlanId: plan.id },
      include: this.orthodonticProfileCatalogInclude()
    });
    if (dto.catalogSelections) {
      await this.ensureOrthodonticCatalogSeed(actor.organizationId, actor.id);
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const profile = await (tx as any).orthodonticTreatmentProfile.upsert({
        where: { treatmentPlanId: plan.id },
        create: {
          treatmentPlanId: plan.id,
          ...payload
        },
        update: {
          ...payload,
          version: { increment: 1 }
        }
      });
      if (dto.catalogSelections) {
        await this.replaceOrthodonticCatalogSelections(tx, actor, profile.id, dto.catalogSelections);
      }
      return (tx as any).orthodonticTreatmentProfile.findUnique({
        where: { id: profile.id },
        include: this.orthodonticProfileCatalogInclude()
      });
    });

    await this.audit(
      actor,
      "OrthodonticTreatmentProfile",
      saved.id,
      "update",
      (previous ?? {}) as Prisma.InputJsonValue,
      saved as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async updateOrthodonticDiagnosis(actor: AuthUser, id: string, dto: UpdateOrthodonticDiagnosisDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "update orthodontic diagnosis for");
    const saved = await this.prisma.orthodonticTreatmentProfile.upsert({
      where: { treatmentPlanId: plan.id },
      create: {
        treatmentPlanId: plan.id,
        diagnosis: dto.diagnosis as Prisma.InputJsonValue
      },
      update: {
        diagnosis: dto.diagnosis as Prisma.InputJsonValue
      }
    });

    await this.audit(actor, "OrthodonticTreatmentProfile", saved.id, "update_diagnosis", {}, {
      treatmentPlanId: plan.id
    } as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, id);
  }

  async listOrthodonticDiagnosisCatalog(actor: AuthUser) {
    await this.ensureOrthodonticDiagnosisCatalogSeed(actor.id);
    return this.findOrthodonticDiagnosisCatalog(true);
  }

  async getOrthodonticDiagnosisStatus(actor: AuthUser, id: string) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    const diagnosis = await this.findCurrentOrthodonticDiagnosis(plan.id);
    return this.mapOrthodonticDiagnosisResult(plan, diagnosis);
  }

  async getOrthodonticDiagnosis(actor: AuthUser, id: string) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    await this.ensureOrthodonticDiagnosisCatalogSeed(actor.id);
    const diagnosis = await this.findCurrentOrthodonticDiagnosis(plan.id);
    return {
      ...this.mapOrthodonticDiagnosisResult(plan, diagnosis),
      catalog: await this.findOrthodonticDiagnosisCatalog(true)
    };
  }

  async saveOrthodonticDiagnosisDraft(actor: AuthUser, id: string, dto: SaveOrthodonticDiagnosisDto) {
    return this.saveOrthodonticDiagnosisWorkflow(actor, id, dto, OrthodonticDiagnosisStatus.DRAFT);
  }

  async saveOrthodonticDiagnosisActive(actor: AuthUser, id: string, dto: SaveOrthodonticDiagnosisDto) {
    return this.saveOrthodonticDiagnosisWorkflow(actor, id, dto, OrthodonticDiagnosisStatus.ACTIVE);
  }

  async createOrthodonticDiagnosisFieldOption(
    actor: AuthUser,
    fieldId: string,
    dto: CreateOrthodonticDiagnosisOptionDto
  ) {
    await this.ensureOrthodonticDiagnosisCatalogSeed(actor.id);
    const field = await (this.prisma as any).orthodonticDiagnosisField.findFirst({ where: { id: fieldId } });
    if (!field) throw new NotFoundException("Orthodontic diagnosis field not found");
    if (!field.isConfigurable) throw new BadRequestException("This diagnosis field cannot be configured");
    const label = this.cleanOptionLabel(dto.label);
    const normalizedLabel = this.normalizeOptionLabel(label);
    const maxSort = await (this.prisma as any).orthodonticDiagnosisFieldOption.aggregate({
      where: { fieldId },
      _max: { sortOrder: true }
    });
    await (this.prisma as any).orthodonticDiagnosisFieldOption.create({
      data: {
        fieldId,
        code: `${field.code}_${this.optionCode(label)}`,
        label,
        normalizedLabel,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        createdById: actor.id,
        updatedById: actor.id
      }
    });
    await this.audit(actor, "OrthodonticDiagnosisFieldOption", fieldId, "create", {}, { fieldId, label });
    return this.listOrthodonticDiagnosisCatalog(actor);
  }

  async updateOrthodonticDiagnosisFieldOption(
    actor: AuthUser,
    optionId: string,
    dto: UpdateOrthodonticDiagnosisOptionDto
  ) {
    const option = await this.findOrthodonticDiagnosisOption(optionId);
    const used = await this.countOrthodonticDiagnosisOptionUsage(optionId);
    const data: Record<string, unknown> = { updatedById: actor.id, version: { increment: 1 } };
    if (dto.label !== undefined) {
      if (used > 0) throw new BadRequestException("Used diagnosis options cannot be renamed");
      const label = this.cleanOptionLabel(dto.label);
      data.label = label;
      data.normalizedLabel = this.normalizeOptionLabel(label);
      data.code = `${option.field.code}_${this.optionCode(label)}`;
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await (this.prisma as any).orthodonticDiagnosisFieldOption.update({ where: { id: optionId }, data });
    await this.audit(
      actor,
      "OrthodonticDiagnosisFieldOption",
      optionId,
      "update",
      option,
      data as Prisma.InputJsonValue
    );
    return this.listOrthodonticDiagnosisCatalog(actor);
  }

  async deactivateOrthodonticDiagnosisFieldOption(actor: AuthUser, optionId: string, reason?: string) {
    const option = await this.findOrthodonticDiagnosisOption(optionId);
    await (this.prisma as any).orthodonticDiagnosisFieldOption.update({
      where: { id: optionId },
      data: {
        isActive: false,
        deactivatedById: actor.id,
        deactivatedAt: new Date(),
        deactivationReason: this.optionalString(reason) ?? undefined,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(actor, "OrthodonticDiagnosisFieldOption", optionId, "deactivate", option, { reason });
    return this.listOrthodonticDiagnosisCatalog(actor);
  }

  async reactivateOrthodonticDiagnosisFieldOption(actor: AuthUser, optionId: string) {
    const option = await this.findOrthodonticDiagnosisOption(optionId);
    await (this.prisma as any).orthodonticDiagnosisFieldOption.update({
      where: { id: optionId },
      data: {
        isActive: true,
        reactivatedById: actor.id,
        reactivatedAt: new Date(),
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(actor, "OrthodonticDiagnosisFieldOption", optionId, "reactivate", option, {});
    return this.listOrthodonticDiagnosisCatalog(actor);
  }

  async sortOrthodonticDiagnosisFieldOptions(
    actor: AuthUser,
    fieldId: string,
    dto: SortOrthodonticDiagnosisOptionsDto
  ) {
    const field = await (this.prisma as any).orthodonticDiagnosisField.findFirst({ where: { id: fieldId } });
    if (!field) throw new NotFoundException("Orthodontic diagnosis field not found");
    const options = await (this.prisma as any).orthodonticDiagnosisFieldOption.findMany({
      where: { fieldId }
    });
    const optionIds = new Set(options.map((option: any) => option.id));
    if (dto.optionIds.some((optionId) => !optionIds.has(optionId))) {
      throw new BadRequestException("Invalid option order for diagnosis field");
    }
    await this.prisma.$transaction(
      dto.optionIds.map((optionId, sortOrder) =>
        (this.prisma as any).orthodonticDiagnosisFieldOption.update({
          where: { id: optionId },
          data: { sortOrder, updatedById: actor.id, version: { increment: 1 } }
        })
      )
    );
    await this.audit(
      actor,
      "OrthodonticDiagnosisFieldOption",
      fieldId,
      "sort",
      {},
      { fieldId, optionIds: dto.optionIds }
    );
    return this.listOrthodonticDiagnosisCatalog(actor);
  }

  async startOrthodonticTreatment(actor: AuthUser, id: string, dto: StartOrthodonticTreatmentDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "start");
    const existingProfile = await this.prisma.orthodonticTreatmentProfile.findUnique({
      where: { treatmentPlanId: plan.id }
    });
    if (existingProfile?.startDate) {
      throw new BadRequestException("Orthodontic treatment has already been started");
    }
    const durationMonths = dto.durationMonths ?? existingProfile?.estimatedMonths;
    if (!durationMonths || durationMonths < 3 || durationMonths > 36) {
      throw new BadRequestException("Orthodontic duration must be between 3 and 36 months");
    }
    await this.validateProfessionalPlanSpecialty(
      actor,
      plan.professionalId,
      plan.branchId,
      TreatmentPlanKind.ORTHODONTICS
    );

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException("Invalid startDate");
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    if (startDate >= tomorrow) {
      throw new BadRequestException("Orthodontic start date cannot be in the future");
    }
    const plannedControls = durationMonths;
    const recommendedNextControlAt = this.addMonths(startDate, 1);
    const expectedEndAt = this.addMonths(startDate, durationMonths);
    const existingCompletedControls = await this.prisma.orthodonticControl.count({
      where: {
        treatmentPlanId: plan.id,
        status: OrthodonticControlStatus.COMPLETED,
        annulledAt: null,
        clinicalConfirmed: true
      }
    });

    const saved = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.orthodonticTreatmentProfile.upsert({
        where: { treatmentPlanId: plan.id },
        create: {
          treatmentPlanId: plan.id,
          startDate,
          estimatedMonths: durationMonths,
          estimatedControls: plannedControls,
          controlFrequencyValue: 1,
          controlFrequencyUnit: "MONTH",
          nextControlAt: recommendedNextControlAt,
          startedById: actor.id,
          startedAt: new Date()
        },
        update: {
          startDate,
          estimatedMonths: durationMonths,
          estimatedControls: plannedControls,
          controlFrequencyValue: 1,
          controlFrequencyUnit: "MONTH",
          nextControlAt: existingProfile?.nextControlAt ?? recommendedNextControlAt,
          startedById: actor.id,
          startedAt: new Date(),
          version: { increment: 1 }
        }
      });
      await tx.treatmentPlan.update({
        where: { id: plan.id },
        data: {
          status:
            plan.status === TreatmentPlanStatus.DRAFT || plan.status === TreatmentPlanStatus.ACCEPTED
              ? TreatmentPlanStatus.IN_PROGRESS
              : plan.status
        }
      });
      return profile;
    });

    await this.audit(actor, "OrthodonticTreatmentProfile", saved.id, "ORTHODONTIC_TREATMENT_STARTED", {}, {
      treatmentPlanId: plan.id,
      startDate,
      durationMonths,
      plannedControls,
      controlFrequencyValue: 1,
      controlFrequencyUnit: "MONTH",
      expectedEndAt,
      recommendedNextControlAt,
      existingCompletedControls
    } as Prisma.InputJsonValue);
    return this.getOrthodonticSummary(actor, id);
  }

  async getOrthodonticSummary(actor: AuthUser, id: string) {
    const canViewPrivate = this.canViewPrivateEvolutions(actor);
    const now = new Date();
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        orthodonticProfile: { include: this.orthodonticProfileCatalogInclude() },
        pauses: { orderBy: { startDate: "desc" } },
        items: {
          include: {
            paymentAllocations: { include: { payment: { select: { id: true, status: true } } } }
          }
        },
        appointments: {
          where: {
            startAt: { gte: now },
            status: {
              notIn: [
                AppointmentStatus.CANCELLED_BY_PATIENT,
                AppointmentStatus.CANCELLED_BY_CLINIC,
                AppointmentStatus.CANCELLED_CONFLICT,
                AppointmentStatus.CANCELLED_RESCHEDULED,
                AppointmentStatus.NO_SHOW,
                AppointmentStatus.RESCHEDULED,
                AppointmentStatus.BLOCKED
              ]
            }
          },
          include: { professional: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { startAt: "asc" },
          take: 1
        },
        orthodonticControls: {
          where: {
            status: OrthodonticControlStatus.COMPLETED,
            annulledAt: null,
            clinicalConfirmed: true
          },
          orderBy: [{ clinicalDate: "asc" }, { createdAt: "asc" }]
        },
        orthodonticHygieneAssessments: {
          where: { status: HygieneAssessmentStatus.ACTIVE, annulledAt: null },
          include: {
            scale: true,
            option: true
          },
          orderBy: [{ clinicalDate: "asc" }, { createdAt: "asc" }]
        },
        orthodonticMilestones: {
          orderBy: [{ plannedAt: "asc" }, { createdAt: "asc" }]
        },
        clinicalEvolutions: {
          where: {
            annulledAt: null,
            ...(canViewPrivate ? {} : { OR: [{ isPrivate: false }, { createdById: actor.id }] })
          },
          include: this.orthodonticEvolutionInclude(),
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!plan) throw new NotFoundException("Treatment plan not found");

    // Call the new service to calculate progress.
    const progressSummary = this.orthodonticProgressService
      ? await this.orthodonticProgressService.getProgressSummary(id, now)
      : null;

    const profile = plan.orthodonticProfile;
    const estimatedMonths = profile?.estimatedMonths ?? 0;
    const completedControls = plan.orthodonticControls?.length ?? 0;
    const plannedControls = profile?.estimatedControls ?? estimatedMonths;

    // Use values from new service if available, else fallback
    const calendarPercentage = progressSummary?.calendarProgress?.percentage ?? 0;
    const realPercentage = progressSummary?.controlProgress?.percentage ?? 0;
    const diffStatus = progressSummary?.progressDifference?.status ?? "NOT_CALCULABLE";

    // We construct a mock calendar object to satisfy the frontend legacy fields
    // while feeding it the exact percentage derived from OrthodonticProgressService
    const calendar = {
      status: plan.status,
      percentage: calendarPercentage,
      activeDays: progressSummary?.calendarProgress?.elapsedPeriods
        ? Math.round(progressSummary.calendarProgress.elapsedPeriods * 30.4368)
        : 0,
      pausedDays: 0,
      elapsedMonths: progressSummary?.calendarProgress?.elapsedPeriods ?? 0,
      estimatedEndAt: null,
      monthsExceeded: 0,
      label: "Calculado desde servicio compartido"
    };

    const deviations = {
      status: diffStatus,
      percentage: progressSummary?.progressDifference?.percentagePoints ?? 0,
      label: "Diferencia actualizada"
    };

    if (plan.kind !== TreatmentPlanKind.ORTHODONTICS) {
      throw new BadRequestException("Orthodontic summary is only available for orthodontic treatment plans");
    }

    return this.mapOrthodonticSummary(plan, canViewPrivate);
  }

  async listOrthodonticEvolutions(actor: AuthUser, id: string, query: OrthodonticEvolutionsQueryDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    const { page, pageSize, skip, take } = resolvePagination(query);
    const canViewPrivate = this.canViewPrivateEvolutions(actor);
    const where: Prisma.ClinicalEvolutionWhereInput = {
      treatmentPlanId: plan.id,
      addendumOfId: null,
      annulledAt: null,
      ...(canViewPrivate ? {} : { OR: [{ isPrivate: false }, { createdById: actor.id }] }),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    if (query.hasHygiene !== undefined) {
      where.fields = query.hasHygiene
        ? { some: { group: "ORTHODONTICS", label: { contains: "Higiene", mode: "insensitive" } } }
        : { none: { group: "ORTHODONTICS", label: { contains: "Higiene", mode: "insensitive" } } };
    }
    if (query.search?.trim()) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { notes: { contains: query.search.trim(), mode: "insensitive" } },
            { fields: { some: { value: { contains: query.search.trim(), mode: "insensitive" } } } }
          ]
        }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.clinicalEvolution.findMany({
        where,
        include: this.orthodonticEvolutionInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.clinicalEvolution.count({ where })
    ]);

    return {
      items: items.map((evolution) => this.mapOrthodonticEvolution(evolution)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  async createOrthodonticMonthlyItems(actor: AuthUser, id: string, dto: CreateOrthodonticMonthlyItemsDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "create monthly items for");
    await this.validateProcedure(actor, dto.procedureId);
    const agreement = plan.patient.agreement;
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException("Invalid startDate");
    const sectionName = dto.sectionName?.trim() || "Mensualidades";

    const createdIds = await this.prisma.$transaction(async (tx) => {
      const section =
        (await tx.treatmentPlanSection.findFirst({
          where: { treatmentPlanId: plan.id, name: sectionName }
        })) ??
        (await tx.treatmentPlanSection.create({
          data: {
            treatmentPlanId: plan.id,
            name: sectionName,
            sortOrder:
              ((
                await tx.treatmentPlanSection.aggregate({
                  where: { treatmentPlanId: plan.id },
                  _max: { sortOrder: true }
                })
              )._max.sortOrder ?? -1) + 1
          }
        }));

      const ids: string[] = [];
      for (let index = 0; index < dto.months; index++) {
        const plannedAt = new Date(startDate);
        plannedAt.setMonth(startDate.getMonth() + index);
        const itemPayload = await this.resolveItemPayload(actor, plan.branchId, plan.patient, {
          procedureId: dto.procedureId,
          quantity: 1,
          unitPrice: dto.unitPrice,
          discount: 0,
          plannedAt: plannedAt.toISOString(),
          notes: dto.notes?.trim()
        });

        const item = await tx.treatmentPlanItem.create({
          data: this.buildItemData(
            plan.id,
            {
              ...itemPayload,
              sectionId: section.id,
              plannedAt: plannedAt.toISOString(),
              notes: dto.notes?.trim() || `Mensualidad ${index + 1}/${dto.months}`
            },
            agreement,
            actor.id
          )
        });
        ids.push(item.id);
      }
      return ids;
    });

    await this.audit(actor, "TreatmentPlanItem", null, "create_orthodontic_monthly_items", {}, {
      treatmentPlanId: plan.id,
      count: createdIds.length
    } as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, id);
  }

  async changeBranch(actor: AuthUser, id: string, dto: ChangeTreatmentPlanBranchDto) {
    const current = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(current, "change branch for");
    await this.validateBranch(actor, dto.branchId);
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      dto.professionalId,
      dto.branchId,
      current.kind
    );

    const futureAppointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      patientId: current.patientId,
      treatmentPlanId: id,
      startAt: { gte: new Date() },
      status: {
        notIn: [
          AppointmentStatus.COMPLETED,
          AppointmentStatus.CANCELLED_BY_PATIENT,
          AppointmentStatus.CANCELLED_BY_CLINIC,
          AppointmentStatus.NO_SHOW,
          AppointmentStatus.RESCHEDULED,
          AppointmentStatus.BLOCKED
        ]
      }
    };
    const futureAppointmentsCount = await this.prisma.appointment.count({ where: futureAppointmentWhere });

    const movedFutureAppointmentsCount = await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: current.patientId },
        data: { branchId: dto.branchId }
      });

      await tx.treatmentPlan.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          professionalId: dto.professionalId,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name
        }
      });

      if (!dto.moveFutureAppointments || futureAppointmentsCount === 0) return 0;

      const result = await tx.appointment.updateMany({
        where: futureAppointmentWhere,
        data: {
          branchId: dto.branchId,
          professionalId: dto.professionalId,
          chairId: null,
          updatedById: actor.id
        }
      });
      return result.count;
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "change_branch",
      {
        patientId: current.patientId,
        branchId: current.branchId,
        professionalId: current.professionalId
      } as Prisma.InputJsonValue,
      {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        futureAppointmentsCount,
        movedFutureAppointmentsCount
      } as Prisma.InputJsonValue
    );

    return {
      ...(await this.getTreatmentPlan(actor, id)),
      futureAppointmentsCount,
      movedFutureAppointmentsCount
    };
  }

  async addSection(actor: AuthUser, treatmentPlanId: string, dto: TreatmentPlanSectionInputDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "add sections to");
    const nextSortOrder =
      dto.sortOrder ??
      ((
        await this.prisma.treatmentPlanSection.aggregate({
          where: { treatmentPlanId },
          _max: { sortOrder: true }
        })
      )._max.sortOrder ?? -1) + 1;

    const created = await this.prisma.treatmentPlanSection.create({
      data: {
        treatmentPlanId,
        name: dto.name.trim(),
        sortOrder: nextSortOrder
      }
    });

    await this.audit(
      actor,
      "TreatmentPlanSection",
      created.id,
      "create",
      {},
      created as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async createAlternative(actor: AuthUser, parentId: string, dto: CreateAlternativeDto) {
    const parent = await this.ensureTreatmentPlan(actor, parentId);
    this.ensureTreatmentPlanCanMutate(parent, "create alternatives for");
    const created = await this.createTreatmentPlan(actor, {
      ...dto,
      branchId: dto.branchId ?? parent.branchId,
      patientId: dto.patientId ?? parent.patientId,
      professionalId: dto.professionalId ?? parent.professionalId,
      isAlternative: true,
      parentTreatmentPlanId: parentId
    });
    return created;
  }

  async activateAlternative(actor: AuthUser, parentId: string, alternativeId: string) {
    const [parent, alternative, link] = await Promise.all([
      this.ensureTreatmentPlan(actor, parentId),
      this.ensureTreatmentPlan(actor, alternativeId),
      this.prisma.treatmentPlanAlternative.findUnique({
        where: {
          parentTreatmentPlanId_alternativeTreatmentPlanId: {
            parentTreatmentPlanId: parentId,
            alternativeTreatmentPlanId: alternativeId
          }
        }
      })
    ]);

    if (!link)
      throw new BadRequestException(
        "The selected plan is not registered as an alternative of the parent plan"
      );
    this.ensureTreatmentPlanCanMutate(parent, "activate alternatives for");
    this.ensureTreatmentPlanCanMutate(alternative, "activate");
    if (parent.patientId !== alternative.patientId)
      throw new BadRequestException("Alternative and parent plan must belong to the same patient");

    await this.prisma.$transaction(async (tx) => {
      await tx.treatmentPlan.update({
        where: { id: alternative.id },
        data: {
          isAlternative: false,
          parentTreatmentPlanId: null
        }
      });

      await tx.treatmentPlan.update({
        where: { id: parent.id },
        data: {
          isAlternative: true,
          parentTreatmentPlanId: alternative.id,
          status: TreatmentPlanStatus.REJECTED
        }
      });
    });

    await this.audit(
      actor,
      "TreatmentPlanAlternative",
      parentId,
      "activate_alternative",
      {
        parentId,
        alternativeId
      } as Prisma.InputJsonValue,
      {}
    );

    return this.getTreatmentPlan(actor, alternative.id);
  }

  async addItem(actor: AuthUser, treatmentPlanId: string, dto: UpdateTreatmentPlanItemDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "add items to");
    if (!dto.procedureId) throw new BadRequestException("procedureId is required");

    await this.validateProcedure(actor, dto.procedureId);
    if (dto.sectionId) await this.validateSection(treatmentPlanId, dto.sectionId);

    const agreement = await this.resolveTreatmentAgreement(
      actor,
      plan.branchId,
      plan.agreementId ?? plan.patient.agreement?.id
    );
    const itemPayload = await this.resolveItemPayload(
      actor,
      plan.branchId,
      plan.patient,
      {
        ...dto,
        procedureId: dto.procedureId
      },
      agreement
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.treatmentPlanItem.create({
        data: this.buildItemData(treatmentPlanId, itemPayload, agreement, actor.id),
        include: { procedure: true, section: true }
      });

      if (dto.syncOdontogram && item.toothNumber) {
        await this.syncTreatmentItemOdontogram(tx, plan, item, dto.notes?.trim());
      }

      return item;
    });

    await this.audit(actor, "TreatmentPlanItem", created.id, "create", {}, created as Prisma.InputJsonValue);
    await this.crmTasksService?.handleTreatmentItemAdded(created.id, actor.id);
    return this.getTreatmentPlan(actor, plan.id);
  }

  async pricePreview(actor: AuthUser, treatmentPlanId: string, dto: TreatmentPlanPricePreviewDto) {
    if (!this.pricing || process.env.PRICE_LISTS_V2_ENABLED !== "true") {
      throw new BadRequestException("Versioned pricing is disabled");
    }
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      select: { id: true, branchId: true, patientId: true, agreementId: true, status: true }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    return this.pricing.resolve(actor, {
      branchId: plan.branchId,
      patientId: plan.patientId,
      planId: plan.id,
      procedureId: dto.procedureId,
      clinicalDate: dto.clinicalDate,
      currency: dto.currency,
      agreementId: plan.agreementId ?? undefined
    });
  }

  async priceCatalog(actor: AuthUser, treatmentPlanId: string, clinicalDate?: string) {
    if (!this.pricing || process.env.PRICE_LISTS_V2_ENABLED !== "true") {
      throw new BadRequestException("Versioned pricing is disabled");
    }
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      select: { id: true, branchId: true, patientId: true, agreementId: true }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    const catalog = await this.pricing.catalog(actor, {
      branchId: plan.branchId,
      patientId: plan.patientId,
      planId: plan.id,
      agreementId: plan.agreementId ?? undefined,
      clinicalDate
    });
    const capability = await this.getDiscountCapability(actor);
    return {
      ...catalog,
      discountCapability: {
        hasPermission: capability.hasPermission,
        maximumDiscountPercent: capability.effectiveMaximumPercent.toFixed(2),
        configured: capability.policyVersion !== null
      }
    };
  }

  async repricePreview(actor: AuthUser, treatmentPlanId: string, dto: RepriceTreatmentPlanDto) {
    if (!this.pricing || process.env.PRICE_LISTS_V2_ENABLED !== "true") {
      throw new BadRequestException("Versioned pricing is disabled");
    }
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        items: {
          where: {
            status: { not: TreatmentPlanItemStatus.CANCELLED },
            ...(dto.itemIds?.length ? { id: { in: dto.itemIds } } : {})
          },
          include: { paymentAllocations: true, budgetItems: { include: { budget: true } } }
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    const results = [];
    for (const item of plan.items) {
      try {
        const price = await this.pricing.resolve(actor, {
          branchId: plan.branchId,
          patientId: plan.patientId,
          planId: plan.id,
          procedureId: item.procedureId,
          clinicalDate: dto.clinicalDate,
          agreementId: plan.agreementId ?? undefined,
          currency: item.priceCurrency
        });
        const quantity = new Prisma.Decimal(item.quantity);
        const newTotal = new Prisma.Decimal(price.finalPrice).mul(quantity).toDecimalPlaces(2);
        results.push({
          itemId: item.id,
          procedureId: item.procedureId,
          current: {
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            total: item.total.toFixed(2),
            versionId: item.priceListVersionId,
            versionNumber: item.priceListVersionNumber,
            versionItemId: item.priceListVersionItemId
          },
          proposed: { ...price, quantity: quantity.toFixed(2), total: newTotal.toFixed(2) },
          difference: newTotal.sub(item.total).toFixed(2),
          hasFinancialDependencies:
            item.paymentAllocations.length > 0 ||
            item.budgetItems.some((budgetItem) => budgetItem.budget.status !== BudgetStatus.DRAFT),
          error: null
        });
      } catch (error) {
        results.push({
          itemId: item.id,
          procedureId: item.procedureId,
          current: {
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            total: item.total.toFixed(2)
          },
          proposed: null,
          difference: null,
          hasFinancialDependencies: item.paymentAllocations.length > 0 || item.budgetItems.length > 0,
          error: error instanceof Error ? error.message : "Price resolution failed"
        });
      }
    }
    return {
      planId: plan.id,
      status: plan.status,
      canApply:
        plan.status === TreatmentPlanStatus.DRAFT &&
        results.every((result) => !result.error && !result.hasFinancialDependencies),
      requiresRevision: plan.status !== TreatmentPlanStatus.DRAFT,
      items: results
    };
  }

  async repriceApply(actor: AuthUser, treatmentPlanId: string, dto: RepriceTreatmentPlanDto) {
    if (!dto.reason?.trim()) throw new BadRequestException("reason is required to update plan prices");
    const reason = dto.reason.trim();
    const preview = await this.repricePreview(actor, treatmentPlanId, dto);
    if (preview.status !== TreatmentPlanStatus.DRAFT) {
      throw new ConflictException(
        "Accepted, started or completed plans require a revision or addendum; prices were not changed"
      );
    }
    if (!preview.canApply)
      throw new ConflictException("Plan contains pricing errors or financial dependencies");
    const pricedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const row of preview.items) {
        if (!row.proposed) continue;
        const quantity = new Prisma.Decimal(row.proposed.quantity);
        const normalTotal = new Prisma.Decimal(row.proposed.basePrice).mul(quantity).toDecimalPlaces(2);
        const finalTotal = new Prisma.Decimal(row.proposed.total);
        const discountAmount = normalTotal.sub(finalTotal).toDecimalPlaces(2);
        await tx.treatmentPlanItem.update({
          where: { id: row.itemId },
          data: {
            unitPrice: new Prisma.Decimal(row.proposed.basePrice),
            discount: discountAmount,
            total: finalTotal,
            originalPrice: normalTotal,
            allowsDiscountSnapshot: row.proposed.allowDiscount,
            maximumDiscountPercentSnapshot: new Prisma.Decimal(row.proposed.maxDiscountPercent),
            discountType: discountAmount.gt(0) ? "AMOUNT" : null,
            discountValue: discountAmount.gt(0) ? discountAmount : null,
            discountAmount,
            finalPrice: finalTotal,
            discountAuthorizedBy: discountAmount.gt(0) ? actor.id : null,
            discountedAt: discountAmount.gt(0) ? pricedAt : null,
            appliedDiscountPercent: 0,
            userMaximumDiscountSnapshot: 0,
            effectiveMaximumDiscountSnapshot: 0,
            priceListId: row.proposed.priceList.id,
            priceListItemId: null,
            priceListVersionId: row.proposed.version.id,
            priceListVersionNumber: row.proposed.version.number,
            priceListVersionItemId: row.proposed.version.itemId,
            priceSource: TreatmentPriceSource.PRICE_LIST,
            priceSnapshotName: row.proposed.priceList.name,
            priceSnapshotCode: row.proposed.procedure.code,
            priceSnapshotCategory: row.proposed.procedure.category,
            procedureCodeSnapshot: row.proposed.procedure.code,
            procedureNameSnapshot: row.proposed.procedure.name,
            procedureCategorySnapshot: row.proposed.procedure.category,
            priceListNameSnapshot: row.proposed.priceList.name,
            priceResolvedAt: pricedAt,
            priceCurrency: row.proposed.currency,
            laboratoryCostSnapshot: new Prisma.Decimal(row.proposed.laboratoryCost),
            internalCostSnapshot: new Prisma.Decimal(row.proposed.internalCost),
            pricingRuleSnapshot: row.proposed.rule as Prisma.InputJsonValue,
            pricedById: actor.id,
            agreementId: row.proposed.agreement?.id,
            agreementVersionId: row.proposed.agreement?.versionId,
            agreementVersionNumber: row.proposed.agreement?.version,
            agreementSnapshot: row.proposed.agreement
              ? ({ ...row.proposed.agreement, rule: row.proposed.rule } as Prisma.InputJsonValue)
              : undefined,
            agreementNormalPrice: row.proposed.agreement ? new Prisma.Decimal(row.proposed.basePrice) : null,
            agreementAppliedPrice: row.proposed.agreement
              ? new Prisma.Decimal(row.proposed.finalPrice)
              : null,
            agreementDiscountAmount: row.proposed.agreement
              ? new Prisma.Decimal(row.proposed.discountAmount)
              : null,
            agreementCoverage: new Prisma.Decimal(row.proposed.coverageAmount),
            version: { increment: 1 }
          }
        });
      }
      await tx.pricingAuditEvent.create({
        data: {
          organizationId: actor.organizationId,
          branchId: preview.items[0]?.proposed?.trace.branchId,
          actorUserId: actor.id,
          entity: "TreatmentPlan",
          entityId: treatmentPlanId,
          action: "treatment_plan.repriced",
          reason,
          oldValue: {
            items: preview.items.map((item) => ({
              itemId: item.itemId,
              procedureId: item.procedureId,
              ...item.current
            }))
          },
          newValue: {
            pricedAt,
            items: preview.items.map((item) => ({
              itemId: item.itemId,
              procedureId: item.procedureId,
              versionId: item.proposed?.version.id ?? null,
              versionNumber: item.proposed?.version.number ?? null,
              versionItemId: item.proposed?.version.itemId ?? null,
              unitPrice: item.proposed?.basePrice ?? null,
              discount: item.proposed?.discountAmount ?? null,
              total: item.proposed?.total ?? null,
              difference: item.difference
            }))
          },
          metadata: {
            priceListIds: [
              ...new Set(
                preview.items
                  .map((item) => item.proposed?.priceList.id)
                  .filter((id): id is string => Boolean(id))
              )
            ]
          }
        }
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: actor.organizationId,
          aggregateType: "TreatmentPlan",
          aggregateId: treatmentPlanId,
          eventType: "treatment_plan.repriced",
          payload: { itemIds: preview.items.map((item) => item.itemId), pricedAt, actorUserId: actor.id }
        }
      });
    });
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async getProcedures(actor: AuthUser, treatmentPlanId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        items: {
          include: {
            procedure: true,
            section: true,
            paymentAllocations: {
              include: { payment: { select: { id: true, status: true } } }
            },
            budgetItems: { include: { budget: { select: { id: true, status: true } } } }
          },
          orderBy: [{ section: { sortOrder: "asc" } }, { createdAt: "asc" }]
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");

    const userDiscountCapability = await this.getDiscountCapability(actor);

    const activeItems = plan.items.filter((item) => item.status !== TreatmentPlanItemStatus.CANCELLED);
    const clinicalProgress = calculateTreatmentPlanClinicalProgress(activeItems);
    const sections = plan.sections.map((section) => ({
      id: section.id,
      name: section.name,
      description: null,
      position: section.sortOrder,
      procedures: activeItems
        .filter((item) => item.sectionId === section.id)
        .map((item) => this.mapProcedureListItem(plan, item, userDiscountCapability))
    }));
    const unsectionedProcedures = activeItems
      .filter((item) => !item.sectionId)
      .map((item) => this.mapProcedureListItem(plan, item, userDiscountCapability));

    return {
      planId: plan.id,
      summary: {
        sectionsCount: plan.sections.length,
        proceduresCount: activeItems.length,
        clinicalProgress,
        clinicalStatus: resolveTreatmentPlanClinicalStatus(plan.status, clinicalProgress),
        pendingCount: activeItems.filter(
          (item) =>
            item.status === TreatmentPlanItemStatus.PLANNED ||
            item.status === TreatmentPlanItemStatus.ACCEPTED
        ).length,
        inProgressCount: activeItems.filter((item) => item.status === TreatmentPlanItemStatus.IN_PROGRESS)
          .length,
        completedCount: activeItems.filter((item) => item.status === TreatmentPlanItemStatus.COMPLETED)
          .length,
        paidCount: activeItems.filter((item) => this.resolveProcedurePayment(item).status === "PAID").length,
        withDebtCount: activeItems.filter((item) => this.resolveProcedurePayment(item).balance.gt(0)).length
      },
      sections,
      unsectionedProcedures,
      capabilities: {
        canAddSection: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canAddProcedure: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canApplyBulkDiscount:
          !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) &&
          userDiscountCapability.hasPermission &&
          userDiscountCapability.effectiveMaximumPercent.gt(0) &&
          activeItems.some((item) => item.allowsDiscountSnapshot && item.maximumDiscountPercentSnapshot.gt(0))
      }
    };
  }

  async applyBulkDiscount(actor: AuthUser, treatmentPlanId: string, dto: BulkDiscountTreatmentPlanItemsDto) {
    this.ensureCanApplyTreatmentDiscount(actor);
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "apply discounts to");
    const itemIds = [...new Set(dto.itemIds.map((id) => id.trim()).filter(Boolean))];
    if (!itemIds.length) throw new BadRequestException("Select at least one procedure");
    if (dto.discountType === "PERCENTAGE" && dto.value > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100");
    }

    let authorizationAudit: Array<{
      itemId: string;
      userMaximumPercent: string;
      procedureMaximumPercent: string;
      effectiveMaximumPercent: string;
    }> = [];
    const updatedIds = await this.prisma.$transaction(async (tx) => {
      const items = await tx.treatmentPlanItem.findMany({
        where: { id: { in: itemIds }, treatmentPlanId },
        include: {
          paymentAllocations: { include: { payment: { select: { id: true, status: true } } } },
          budgetItems: { include: { budget: { include: { items: true } } } }
        }
      });
      if (items.length !== itemIds.length)
        throw new BadRequestException("One or more procedures do not belong to this plan");

      const invalidItem = items.find(
        (item) => item.status === TreatmentPlanItemStatus.CANCELLED || !item.allowsDiscountSnapshot
      );
      if (invalidItem) {
        throw new BadRequestException({
          code: "PROCEDURE_DOES_NOT_ALLOW_DISCOUNT",
          message: "Una o más prestaciones seleccionadas no admiten descuentos. No se guardó ningún cambio."
        });
      }
      const discountableItems = items;

      const touchedBudgetIds = new Set<string>();
      const budgetExtraDiscount = new Map<string, Prisma.Decimal>();

      for (const item of discountableItems) {
        const payment = item.paymentAllocations.reduce(
          (sum, allocation) =>
            allocation.payment?.status === PaymentStatus.VOIDED
              ? sum
              : sum.plus(allocation.amount).plus(allocation.settlementDiscountAmount ?? 0),
          new Prisma.Decimal(0)
        );
        if (item.status === TreatmentPlanItemStatus.PAID || payment.gte(item.total)) {
          throw new BadRequestException("Paid procedures cannot receive discounts");
        }
        const nonDraftBudget = item.budgetItems.find(
          (budgetItem) => budgetItem.budget.status !== BudgetStatus.DRAFT
        );
        if (nonDraftBudget) {
          throw new BadRequestException("Cannot update discounts for procedures in sent or accepted budgets");
        }

        for (const budgetItem of item.budgetItems) {
          touchedBudgetIds.add(budgetItem.budgetId);
          if (!budgetExtraDiscount.has(budgetItem.budgetId)) {
            const currentItemsDiscount = budgetItem.budget.items.reduce(
              (sum, row) => sum.plus(row.discount),
              new Prisma.Decimal(0)
            );
            const extra = new Prisma.Decimal(budgetItem.budget.discountTotal).minus(currentItemsDiscount);
            budgetExtraDiscount.set(budgetItem.budgetId, extra.gt(0) ? extra : new Prisma.Decimal(0));
          }
        }
      }

      const discountableBase = discountableItems.reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item.quantity).mul(item.unitPrice)),
        new Prisma.Decimal(0)
      );
      const fixedDiscountTotal =
        dto.discountType === "AMOUNT" ? new Prisma.Decimal(dto.value).toDecimalPlaces(2) : null;
      if (fixedDiscountTotal?.gt(discountableBase)) {
        throw new BadRequestException("Discount cannot exceed discountable subtotal");
      }
      const requestedPercent =
        dto.discountType === "PERCENTAGE"
          ? new Prisma.Decimal(dto.value)
          : discountableBase.eq(0)
            ? new Prisma.Decimal(0)
            : fixedDiscountTotal!.mul(100).div(discountableBase);
      const authorizations = new Map<string, ManualDiscountAuthorization>();
      for (const item of discountableItems) {
        if (
          new Prisma.Decimal(item.agreementDiscountAmount ?? 0).gt(0) ||
          new Prisma.Decimal(item.agreementCoverage ?? 0).gt(0)
        ) {
          throw new BadRequestException({
            code: "DISCOUNT_COMBINATION_POLICY_REQUIRED",
            message:
              "No se puede combinar un descuento manual con beneficios de convenio sin una política explícita."
          });
        }
        authorizations.set(
          item.id,
          await this.validateManualDiscount(
            actor,
            item.allowsDiscountSnapshot,
            item.maximumDiscountPercentSnapshot,
            requestedPercent
          )
        );
      }
      authorizationAudit = [...authorizations.entries()].map(([itemId, authorization]) => ({
        itemId,
        userMaximumPercent: authorization.userMaximumPercent.toFixed(2),
        procedureMaximumPercent: authorization.procedureMaximumPercent.toFixed(2),
        effectiveMaximumPercent: authorization.effectiveMaximumPercent.toFixed(2)
      }));
      let allocatedFixedDiscount = new Prisma.Decimal(0);

      for (const [index, item] of discountableItems.entries()) {
        const base = new Prisma.Decimal(item.quantity).mul(item.unitPrice);
        let discount: Prisma.Decimal;
        if (dto.discountType === "PERCENTAGE") {
          discount = base.mul(dto.value).div(100).toDecimalPlaces(2);
        } else if (index === discountableItems.length - 1) {
          discount = fixedDiscountTotal!.minus(allocatedFixedDiscount).toDecimalPlaces(2);
        } else {
          discount = fixedDiscountTotal!.mul(base).div(discountableBase).toDecimalPlaces(2);
        }
        if (dto.discountType === "AMOUNT" && index < discountableItems.length - 1) {
          allocatedFixedDiscount = allocatedFixedDiscount.plus(discount);
        }
        if (discount.gt(base)) throw new BadRequestException("Discount cannot exceed procedure subtotal");
        const total = base.minus(discount).toDecimalPlaces(2);
        const paidAmount = item.paymentAllocations.reduce(
          (sum, allocation) =>
            allocation.payment?.status === PaymentStatus.VOIDED
              ? sum
              : sum.plus(allocation.amount).plus(allocation.settlementDiscountAmount ?? 0),
          new Prisma.Decimal(0)
        );
        if (total.lt(paidAmount)) {
          throw new BadRequestException({
            code: "DISCOUNT_WOULD_REDUCE_BELOW_PAID_AMOUNT",
            message: "El nuevo precio no puede ser inferior al importe ya pagado."
          });
        }
        const authorization = authorizations.get(item.id)!;

        await tx.treatmentPlanItem.update({
          where: { id: item.id },
          data: {
            discount,
            total,
            originalPrice: base.toDecimalPlaces(2),
            discountType: discount.gt(0) ? dto.discountType : null,
            discountValue: discount.gt(0) ? new Prisma.Decimal(dto.value).toDecimalPlaces(2) : null,
            discountAmount: discount,
            finalPrice: total,
            discountAuthorizedBy: discount.gt(0) ? actor.id : null,
            discountedAt: discount.gt(0) ? new Date() : null,
            discountReason: discount.gt(0) ? dto.discountReason?.trim() || null : null,
            appliedDiscountPercent: discount.gt(0) ? authorization.requestedPercent.toDecimalPlaces(2) : 0,
            userMaximumDiscountSnapshot: authorization.userMaximumPercent,
            effectiveMaximumDiscountSnapshot: authorization.effectiveMaximumPercent,
            version: { increment: 1 }
          }
        });

        for (const budgetItem of item.budgetItems) {
          await tx.budgetItem.update({
            where: { id: budgetItem.id },
            data: {
              discount,
              total,
              version: { increment: 1 }
            }
          });
        }
      }

      for (const budgetId of touchedBudgetIds) {
        const budgetItems = await tx.budgetItem.findMany({ where: { budgetId } });
        const subtotal = budgetItems.reduce(
          (sum, item) => sum.plus(new Prisma.Decimal(item.quantity).mul(item.unitPrice)),
          new Prisma.Decimal(0)
        );
        const itemDiscount = budgetItems.reduce(
          (sum, item) => sum.plus(item.discount),
          new Prisma.Decimal(0)
        );
        const discountTotal = itemDiscount.plus(budgetExtraDiscount.get(budgetId) ?? 0).toDecimalPlaces(2);
        await tx.budget.update({
          where: { id: budgetId },
          data: {
            subtotal: subtotal.toDecimalPlaces(2),
            discountTotal,
            total: subtotal.minus(discountTotal).toDecimalPlaces(2)
          }
        });
      }

      return discountableItems.map((item) => item.id);
    });

    await this.audit(actor, "TreatmentPlanItem", null, "bulk_discount", {}, {
      treatmentPlanId,
      itemIds: updatedIds,
      skippedItemIds: itemIds.filter((itemId) => !updatedIds.includes(itemId)),
      discountType: dto.discountType,
      value: dto.value,
      discountReason: dto.discountReason?.trim() || null,
      limits: authorizationAudit
    } as Prisma.InputJsonValue);
    return this.getProcedures(actor, treatmentPlanId);
  }

  async updateItem(
    actor: AuthUser,
    treatmentPlanId: string,
    itemId: string,
    dto: UpdateTreatmentPlanItemDto
  ) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "update items in");
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId },
      include: {
        paymentAllocations: { include: { payment: { select: { status: true } } } },
        budgetItems: { include: { budget: { select: { status: true } } } }
      }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");
    if (dto.expectedVersion && dto.expectedVersion !== current.version) {
      throw new ConflictException({
        code: "DISCOUNT_VERSION_CONFLICT",
        message:
          "El plan fue modificado por otro usuario. Actualiza la información antes de aplicar el descuento."
      });
    }

    if (
      plan.status === TreatmentPlanStatus.ACCEPTED &&
      (dto.procedureId !== undefined ||
        dto.quantity !== undefined ||
        dto.unitPrice !== undefined ||
        dto.discount !== undefined)
    ) {
      throw new ConflictException(
        "Accepted treatment plan prices are immutable and keep their agreement snapshot"
      );
    }

    if (
      current.status === TreatmentPlanItemStatus.PAID &&
      (dto.procedureId !== undefined ||
        dto.quantity !== undefined ||
        dto.unitPrice !== undefined ||
        dto.discount !== undefined ||
        dto.toothNumber !== undefined ||
        dto.surface !== undefined ||
        dto.odontogramSymbol !== undefined)
    ) {
      throw new BadRequestException("Paid procedures cannot be modified");
    }
    const changesFinancialValues =
      dto.procedureId !== undefined ||
      dto.quantity !== undefined ||
      dto.unitPrice !== undefined ||
      dto.discount !== undefined;
    if (
      changesFinancialValues &&
      (current.budgetItems ?? []).some((item) => item.budget.status !== BudgetStatus.DRAFT)
    ) {
      throw new ConflictException(
        "Cannot update prices or discounts for procedures in sent or accepted budgets"
      );
    }

    if (dto.procedureId) await this.validateProcedure(actor, dto.procedureId);
    if (dto.sectionId) await this.validateSection(treatmentPlanId, dto.sectionId);

    const quantity = dto.quantity ?? Number(current.quantity);
    let unitPrice = dto.unitPrice ?? Number(current.unitPrice);
    let priceSnapshot = this.snapshotFromCurrentItem(current);
    let agreementPricing: AgreementItemPricing | null = null;
    const agreement = await this.resolveTreatmentAgreement(
      actor,
      plan.branchId,
      plan.agreementId ?? plan.patient.agreement?.id
    );
    if (
      dto.procedureId !== undefined ||
      dto.quantity !== undefined ||
      (dto.unitPrice !== undefined && !this.sameMoney(dto.unitPrice, Number(current.unitPrice)))
    ) {
      const resolvedPayload = await this.resolveItemPayload(
        actor,
        plan.branchId,
        plan.patient,
        {
          ...dto,
          procedureId: dto.procedureId ?? current.procedureId,
          quantity,
          unitPrice: dto.unitPrice,
          discount: dto.discount ?? Number(current.discount)
        },
        agreement
      );
      unitPrice = resolvedPayload.unitPrice;
      priceSnapshot = this.snapshotFromResolvedPayload(resolvedPayload);
      agreementPricing = resolvedPayload.agreementPricing ?? null;
      if (!priceSnapshot.allowsDiscountSnapshot) agreementPricing = null;
    }

    let discount = dto.discount ?? Number(current.discount);
    let manualDiscountAuthorization: ManualDiscountAuthorization | null = null;
    if (dto.discount !== undefined && !this.sameMoney(dto.discount, Number(current.discount))) {
      this.ensureCanApplyTreatmentDiscount(actor);
      if (current.status === TreatmentPlanItemStatus.CANCELLED && dto.discount > 0) {
        throw new BadRequestException("Cancelled procedures cannot receive discounts");
      }
      if (!priceSnapshot.allowsDiscountSnapshot && dto.discount > 0) {
        throw new BadRequestException(
          "Procedure does not allow discounts according to its price list snapshot"
        );
      }
      if (dto.discount > 0) {
        if (current.agreementDiscountAmount?.gt(0) || current.agreementCoverage.gt(0)) {
          throw new BadRequestException({
            code: "DISCOUNT_COMBINATION_POLICY_REQUIRED",
            message:
              "No se puede combinar un descuento manual con beneficios de convenio sin una política explícita."
          });
        }
        const base = new Prisma.Decimal(quantity).mul(unitPrice);
        const requestedPercent = base.eq(0)
          ? new Prisma.Decimal(0)
          : new Prisma.Decimal(dto.discount).mul(100).div(base);
        manualDiscountAuthorization = await this.validateManualDiscount(
          actor,
          priceSnapshot.allowsDiscountSnapshot ?? current.allowsDiscountSnapshot,
          priceSnapshot.maximumDiscountPercentSnapshot ?? current.maximumDiscountPercentSnapshot,
          requestedPercent
        );
      }
    }
    let agreementCoverage = Number(current.agreementCoverage || 0);
    if (agreementPricing) {
      discount = (dto.discount ?? 0) + agreementPricing.discountAmount + agreementPricing.coverageAmount;
      agreementCoverage = agreementPricing.coverageAmount;
      unitPrice = agreementPricing.normalPrice;
    } else if (
      (dto.quantity !== undefined || dto.unitPrice !== undefined) &&
      priceSnapshot.allowsDiscountSnapshot
    ) {
      if (agreement && agreement.isActive && Number(agreement.discountPercent) > 0) {
        agreementCoverage = Number(
          (quantity * unitPrice * (Number(agreement.discountPercent) / 100)).toFixed(2)
        );
        discount = Number(agreementCoverage.toFixed(2));
      }
    }
    if (!priceSnapshot.allowsDiscountSnapshot && discount > 0) {
      throw new BadRequestException(
        "Procedure does not allow discounts according to its price list snapshot"
      );
    }

    const total = this.computeTotal(quantity, unitPrice, discount);
    const paidAmount = (current.paymentAllocations ?? []).reduce(
      (sum, allocation) =>
        allocation.payment?.status === PaymentStatus.VOIDED
          ? sum
          : sum.plus(allocation.amount).plus(allocation.settlementDiscountAmount ?? 0),
      new Prisma.Decimal(0)
    );
    if (new Prisma.Decimal(total).lt(paidAmount)) {
      throw new BadRequestException({
        code: "DISCOUNT_WOULD_REDUCE_BELOW_PAID_AMOUNT",
        message: "El nuevo precio no puede ser inferior al importe ya pagado."
      });
    }
    const originalPrice = this.roundMoney(quantity * unitPrice);
    const discountAmount = this.roundMoney(discount);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.treatmentPlanItem.update({
        where: { id: current.id },
        data: {
          sectionId: dto.sectionId ?? current.sectionId,
          procedureId: dto.procedureId ?? current.procedureId,
          toothNumber: dto.toothNumber ?? current.toothNumber,
          surface: dto.surface ?? current.surface,
          odontogramSymbol:
            dto.odontogramSymbol === undefined
              ? current.odontogramSymbol
              : dto.odontogramSymbol.trim() || null,
          quantity: this.decimal(quantity),
          unitPrice: this.decimal(unitPrice),
          discount: this.decimal(discount),
          total: this.decimal(total),
          originalPrice: this.decimal(originalPrice),
          allowsDiscountSnapshot: priceSnapshot.allowsDiscountSnapshot ?? current.allowsDiscountSnapshot,
          maximumDiscountPercentSnapshot:
            priceSnapshot.maximumDiscountPercentSnapshot ?? current.maximumDiscountPercentSnapshot,
          discountType: discountAmount > 0 ? "AMOUNT" : null,
          discountValue: discountAmount > 0 ? this.decimal(discountAmount) : null,
          discountAmount: this.decimal(discountAmount),
          finalPrice: this.decimal(total),
          discountAuthorizedBy: discountAmount > 0 ? actor.id : null,
          discountedAt: discountAmount > 0 ? new Date() : null,
          discountReason: discountAmount > 0 ? dto.discountReason?.trim() || current.discountReason : null,
          appliedDiscountPercent: manualDiscountAuthorization
            ? manualDiscountAuthorization.requestedPercent.toDecimalPlaces(2)
            : discountAmount > 0
              ? current.appliedDiscountPercent
              : 0,
          userMaximumDiscountSnapshot: manualDiscountAuthorization
            ? manualDiscountAuthorization.userMaximumPercent
            : current.userMaximumDiscountSnapshot,
          effectiveMaximumDiscountSnapshot: manualDiscountAuthorization
            ? manualDiscountAuthorization.effectiveMaximumPercent
            : current.effectiveMaximumDiscountSnapshot,
          priceListId: priceSnapshot.priceListId,
          priceListItemId: priceSnapshot.priceListItemId,
          priceSource: priceSnapshot.priceSource,
          priceSnapshotName: priceSnapshot.priceSnapshotName,
          priceSnapshotCode: priceSnapshot.priceSnapshotCode,
          priceSnapshotCategory: priceSnapshot.priceSnapshotCategory,
          priceResolvedAt: priceSnapshot.priceResolvedAt,
          priceListVersionId: priceSnapshot.priceListVersionId,
          priceListVersionNumber: priceSnapshot.priceListVersionNumber,
          priceListVersionItemId: priceSnapshot.priceListVersionItemId,
          priceCurrency: priceSnapshot.priceCurrency,
          laboratoryCostSnapshot: this.decimal(priceSnapshot.laboratoryCostSnapshot ?? 0),
          internalCostSnapshot: this.decimal(priceSnapshot.internalCostSnapshot ?? 0),
          pricingRuleSnapshot: priceSnapshot.pricingRuleSnapshot,
          pricedById: priceSnapshot.pricedById,
          procedureCodeSnapshot: priceSnapshot.priceSnapshotCode,
          procedureNameSnapshot: priceSnapshot.procedureNameSnapshot,
          procedureCategorySnapshot: priceSnapshot.priceSnapshotCategory,
          priceListNameSnapshot: priceSnapshot.priceSnapshotName,
          notes: dto.notes ?? current.notes,
          plannedAt:
            dto.plannedAt === undefined ? current.plannedAt : dto.plannedAt ? new Date(dto.plannedAt) : null,
          agreementId: agreement?.id || null,
          agreementVersionId: agreementPricing?.agreementVersionId ?? current.agreementVersionId,
          agreementVersionNumber: agreementPricing?.agreementVersionNumber ?? current.agreementVersionNumber,
          agreementSnapshot: agreementPricing?.snapshot ?? current.agreementSnapshot ?? undefined,
          agreementNormalPrice: agreementPricing
            ? this.decimal(agreementPricing.normalPrice)
            : current.agreementNormalPrice,
          agreementAppliedPrice: agreementPricing
            ? this.decimal(agreementPricing.appliedPrice)
            : current.agreementAppliedPrice,
          agreementDiscountAmount: agreementPricing
            ? this.decimal(agreementPricing.discountAmount)
            : current.agreementDiscountAmount,
          agreementCoverage: this.decimal(agreementCoverage)
        }
      });

      if (dto.syncOdontogram && row.toothNumber) {
        await this.syncTreatmentItemOdontogram(tx, plan, row, dto.notes?.trim());
      }

      return row;
    });

    if (
      quantity !== Number(current.quantity) ||
      unitPrice !== Number(current.unitPrice) ||
      discount !== Number(current.discount) ||
      total !== Number(current.total)
    ) {
      await this.audit(
        actor,
        "TreatmentPlanItem",
        itemId,
        "price_update",
        {
          quantity: current.quantity,
          unitPrice: current.unitPrice,
          discount: current.discount,
          total: current.total
        } as Prisma.InputJsonValue,
        {
          quantity: updated.quantity,
          unitPrice: updated.unitPrice,
          discount: updated.discount,
          total: updated.total
        } as Prisma.InputJsonValue
      );
    } else {
      await this.audit(
        actor,
        "TreatmentPlanItem",
        itemId,
        "update",
        current as Prisma.InputJsonValue,
        updated as Prisma.InputJsonValue
      );
    }

    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async updateItemStatus(
    actor: AuthUser,
    treatmentPlanId: string,
    itemId: string,
    dto: UpdateTreatmentPlanItemStatusDto
  ) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "update item statuses in");
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");
    if (dto.expectedVersion !== undefined && current.version !== dto.expectedVersion) {
      throw new BadRequestException(
        "Treatment plan item was updated by another operation. Reload and try again."
      );
    }

    if (dto.status === TreatmentPlanItemStatus.PAID && plan.isAlternative) {
      throw new BadRequestException(
        "Alternative plans cannot receive paid items until they become the principal plan"
      );
    }

    const completionPercentage = this.resolveItemCompletionPercentage(
      dto.status,
      current.completionPercentage,
      dto.completionPercentage
    );
    const performedAmount = this.performedAmountForProgress(current.total, completionPercentage);
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.treatmentPlanItem.update({
        where: { id: itemId },
        data: {
          status: dto.status,
          completionPercentage,
          performedAmount,
          notes: dto.notes ?? current.notes,
          completedAt:
            dto.status === TreatmentPlanItemStatus.COMPLETED
              ? (current.completedAt ?? new Date())
              : completionPercentage < 100
                ? null
                : current.completedAt,
          ...(completionPercentage < 100 ? { completedByEvolutionId: null } : {}),
          version: { increment: 1 }
        }
      });
      await this.syncTreatmentPlanStatusFromItems(tx, treatmentPlanId);
      return updatedItem;
    });

    await this.syncTreatmentItemProcedureStatus(itemId, dto.status, completionPercentage);

    await this.audit(
      actor,
      "TreatmentPlanItem",
      itemId,
      "status_update",
      { status: current.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async deleteItem(actor: AuthUser, treatmentPlanId: string, itemId: string) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "delete items from");
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId },
      include: { budgetItems: { include: { budget: true } } }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");
    if (current.status === TreatmentPlanItemStatus.PAID) {
      throw new BadRequestException("Cannot remove paid procedures");
    }

    const nonDraftBudgets = current.budgetItems.filter((bi) => bi.budget.status !== BudgetStatus.DRAFT);
    if (nonDraftBudgets.length > 0) {
      throw new BadRequestException("Cannot remove item because it belongs to a sent or accepted budget");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const bi of current.budgetItems) {
        await tx.budgetItem.delete({ where: { id: bi.id } });

        const itemRawSubtotal = Number(bi.quantity) * Number(bi.unitPrice);
        const newSubtotal = Number(bi.budget.subtotal) - itemRawSubtotal;
        const newDiscountTotal = Number(bi.budget.discountTotal) - Number(bi.discount);
        const newTotal = Number(bi.budget.total) - Number(bi.total);

        await tx.budget.update({
          where: { id: bi.budgetId },
          data: {
            subtotal: this.decimal(Math.max(0, newSubtotal)),
            discountTotal: this.decimal(Math.max(0, newDiscountTotal)),
            total: this.decimal(Math.max(0, newTotal))
          }
        });
      }

      await tx.treatmentPlanItem.delete({ where: { id: itemId } });
      await this.syncTreatmentPlanStatusFromItems(tx, treatmentPlanId);
    });

    const auditData = { ...current };
    delete (auditData as any).budgetItems;
    await this.audit(actor, "TreatmentPlanItem", itemId, "delete", auditData as Prisma.InputJsonValue, {});
    return { success: true };
  }

  async createBudget(actor: AuthUser, treatmentPlanId: string, dto: CreateBudgetDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "create budgets for");
    const items = await this.prisma.treatmentPlanItem.findMany({
      where: { treatmentPlanId, status: { not: TreatmentPlanItemStatus.CANCELLED } },
      include: { procedure: true }
    });
    if (!items.length)
      throw new BadRequestException("Treatment plan requires at least one active item to generate a budget");

    let rawSubtotal = 0;
    let itemsDiscount = 0;

    for (const item of items) {
      rawSubtotal += Number(item.quantity) * Number(item.unitPrice);
      itemsDiscount += Number(item.discount);
    }

    const budgetDiscountTotal = dto.discountTotal ?? 0;
    const totalDiscount = itemsDiscount + budgetDiscountTotal;

    if (totalDiscount > rawSubtotal)
      throw new BadRequestException("total discount cannot be greater than subtotal");
    const total = rawSubtotal - totalDiscount;

    const budget = await this.prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          treatmentPlanId: plan.id,
          patientId: plan.patientId,
          professionalId: plan.professionalId,
          organizationId: actor.organizationId,
          subtotal: this.decimal(rawSubtotal),
          discountTotal: this.decimal(totalDiscount),
          total: this.decimal(total),
          status: BudgetStatus.DRAFT,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          notes: dto.notes?.trim()
        }
      });

      for (const item of items) {
        await tx.budgetItem.create({
          data: {
            budgetId: created.id,
            treatmentPlanItemId: item.id,
            description: `${item.procedure.code} - ${item.procedure.name}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total
          }
        });
      }

      return created;
    });

    await this.audit(actor, "Budget", budget.id, "create", {}, budget as Prisma.InputJsonValue);
    return this.getBudget(actor, budget.id);
  }

  async listBudgets(actor: AuthUser, query: ListBudgetsQueryDto) {
    const { skip, take } = resolvePagination(query);
    const trimmedPatientId = query.patientId?.trim();
    const isNumericPatient = trimmedPatientId ? /^\d+$/.test(trimmedPatientId) : false;

    return this.prisma.budget.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(trimmedPatientId
          ? {
              patient: {
                organizationId: actor.organizationId,
                branchId: branchScope(actor),
                deletedAt: null,
                ...(isNumericPatient
                  ? { OR: [{ id: trimmedPatientId }, { patientNumber: parseInt(trimmedPatientId, 10) }] }
                  : { id: trimmedPatientId })
              }
            }
          : {}),
        ...(query.treatmentPlanId ? { treatmentPlanId: query.treatmentPlanId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        treatmentPlan: { select: { id: true, name: true, status: true, isAlternative: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: true
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async getBudget(actor: AuthUser, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        treatmentPlan: {
          select: {
            id: true,
            name: true,
            status: true,
            isAlternative: true,
            patientId: true
          }
        },
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            treatmentPlanItem: {
              include: {
                procedure: { select: { code: true, name: true } }
              }
            }
          }
        }
      }
    });
    if (!budget) throw new NotFoundException("Budget not found");
    return budget;
  }

  async sendBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    this.ensureTreatmentPlanCanMutate(current.treatmentPlan, "send budgets for");
    if (current.status !== BudgetStatus.DRAFT)
      throw new BadRequestException("Only DRAFT budgets can be sent");
    const updated = await this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.SENT, sentAt: new Date() }
    });
    await this.audit(
      actor,
      "Budget",
      id,
      "send",
      { status: current.status } as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async acceptBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    this.ensureTreatmentPlanCanMutate(current.treatmentPlan, "accept budgets for");
    if (current.treatmentPlan.isAlternative) {
      throw new BadRequestException(
        "Alternative treatment plans cannot be accepted for payments until converted to principal"
      );
    }
    const acceptStatuses: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.SENT];
    if (!acceptStatuses.includes(current.status)) {
      throw new BadRequestException("Only DRAFT or SENT budgets can be accepted");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });
      await tx.treatmentPlan.update({
        where: { id: current.treatmentPlan.id },
        data: {
          status: TreatmentPlanStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });
    });

    await this.audit(
      actor,
      "Budget",
      id,
      "accept",
      { status: current.status } as Prisma.InputJsonValue,
      { status: BudgetStatus.ACCEPTED } as Prisma.InputJsonValue
    );
    await this.crmTasksService?.handleBudgetAccepted(id, actor.id);
    return this.getBudget(actor, id);
  }

  async rejectBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    const rejectStatuses: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.SENT];
    if (!rejectStatuses.includes(current.status)) {
      throw new BadRequestException("Only DRAFT or SENT budgets can be rejected");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.REJECTED,
          rejectedAt: new Date()
        }
      });
      if (current.treatmentPlan.status === TreatmentPlanStatus.PRESENTED) {
        await tx.treatmentPlan.update({
          where: { id: current.treatmentPlan.id },
          data: { status: TreatmentPlanStatus.REJECTED }
        });
      }
    });

    await this.audit(
      actor,
      "Budget",
      id,
      "reject",
      { status: current.status } as Prisma.InputJsonValue,
      { status: BudgetStatus.REJECTED } as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async printBudget(actor: AuthUser, id: string) {
    const budget = await this.getBudget(actor, id);
    const lines = budget.items.map((item) => {
      const label = `${item.treatmentPlanItem.procedure.code} ${item.treatmentPlanItem.procedure.name}`;
      return `- ${label} x${item.quantity} = ${item.total}`;
    });

    return {
      ...budget,
      printableText: [
        `Presupuesto: ${budget.id}`,
        `Paciente: ${budget.patient.firstName} ${budget.patient.lastName}`,
        `Plan: ${budget.treatmentPlan.name}`,
        `Estado: ${budget.status}`,
        ...lines,
        `Subtotal: ${budget.subtotal}`,
        `Descuento: ${budget.discountTotal}`,
        `Total: ${budget.total}`
      ].join("\n")
    };
  }

  async getTreatmentPlanPrintOptions(actor: AuthUser, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      select: {
        id: true,
        patientId: true,
        branchId: true,
        items: {
          where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
          select: { id: true },
          take: 1
        },
        budgets: {
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        labOrders: {
          where: { status: { not: LabOrderStatus.CANCELLED } },
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");

    const odontogramRecord = await this.prisma.odontogramRecord.findFirst({
      where: { patientId: plan.patientId },
      select: { id: true },
      orderBy: { createdAt: "desc" }
    });

    const hasItems = plan.items.length > 0;
    const hasBudget = plan.budgets.length > 0;
    const hasLabOrder = plan.labOrders.length > 0;
    const hasOdontogram = Boolean(odontogramRecord);

    return Object.keys(TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE).map((documentType) => {
      const permission = TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE[documentType];
      const permissionAllowed = this.hasAnyPermission(actor, [
        permission,
        ...this.legacyPrintPermissions(documentType)
      ]);
      let disabledReason: string | null = null;

      if (!permissionAllowed) disabledReason = "No tienes permiso para generar este documento.";
      else if (
        documentType === "BUDGET_COMPLETE" ||
        documentType === "BUDGET_TOTAL_ONLY" ||
        documentType === "BUDGET_NO_DETAIL"
      ) {
        if (!hasBudget) disabledReason = "Primero genera un presupuesto.";
      } else if (documentType === "LAB_ORDER") {
        if (!hasLabOrder) disabledReason = "No hay una orden de laboratorio vinculada.";
      } else if (documentType === "ODONTOGRAM") {
        if (!hasOdontogram) disabledReason = "El paciente no tiene una version de odontograma.";
      } else if (documentType === "CARE_PLAN" || documentType === "SECTIONS") {
        if (!hasItems) disabledReason = "Agrega al menos una prestacion al plan.";
      }

      return {
        visible: true,
        enabled: disabledReason === null,
        disabled_reason: disabledReason,
        permission,
        document_type: documentType,
        label: TREATMENT_PLAN_PRINT_LABEL_BY_TYPE[documentType],
        description: TREATMENT_PLAN_PRINT_DESCRIPTION_BY_TYPE[documentType],
        context: {
          budgetId: plan.budgets[0]?.id ?? null,
          laboratoryOrderId: plan.labOrders[0]?.id ?? null,
          odontogramVersionId: odontogramRecord?.id ?? null
        }
      };
    });
  }

  async previewTreatmentPlanDocument(actor: AuthUser, id: string, dto: PrintTreatmentPlanDocumentDto) {
    return this.printTreatmentPlanDocument(actor, id, dto, "preview");
  }

  async printTreatmentPlanDocument(
    actor: AuthUser,
    id: string,
    dto: PrintTreatmentPlanDocumentDto,
    mode: "preview" | "generate" = "generate"
  ) {
    this.ensurePrintPermission(actor, dto.type);
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        organization: { select: { name: true, address: true, phone: true, logoUrl: true } },
        branch: {
          select: {
            name: true,
            brand: { select: { name: true, logoUrl: true } },
            address: true,
            exteriorNumber: true,
            interiorNumber: true,
            neighborhood: true,
            municipality: true,
            city: true,
            state: true,
            phone: true
          }
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            documentNumber: true,
            email: true,
            phone: true,
            occupation: true,
            gender: true,
            createdAt: true,
            agreement: { select: { name: true } }
          }
        },
        professional: {
          select: {
            firstName: true,
            lastName: true,
            licenseNumber: true,
            specialties: { include: { specialty: { select: { name: true } } } }
          }
        },
        specialty: { select: { name: true } },
        items: {
          where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
          include: {
            procedure: { select: { code: true, name: true } },
            section: { select: { name: true, sortOrder: true } },
            paymentAllocations: {
              select: {
                amount: true,
                payment: { select: { status: true } }
              }
            }
          },
          orderBy: [{ section: { sortOrder: "asc" } }, { createdAt: "asc" }]
        },
        budgets: {
          where: dto.budgetId ? { id: dto.budgetId } : {},
          orderBy: { createdAt: "desc" },
          take: 1
        },
        labOrders: {
          where: { status: { not: LabOrderStatus.CANCELLED } },
          include: {
            labProvider: { select: { name: true } },
            items: true
          },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        clinicalEvolutions: {
          where: { annulledAt: null },
          include: {
            professional: { select: { firstName: true, lastName: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 100
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    if (dto.type === "LAB_ORDER" && !plan.labOrders.length) {
      throw new BadRequestException("No hay una orden de laboratorio vinculada.");
    }
    if (dto.type !== "LAB_ORDER" && dto.type !== "ODONTOGRAM" && !plan.items.length) {
      throw new BadRequestException("Treatment plan requires at least one active item to print documents");
    }
    if (dto.budgetId && !plan.budgets.length) throw new NotFoundException("Budget not found");
    if (
      (dto.type === "BUDGET_COMPLETE" ||
        dto.type === "BUDGET_TOTAL_ONLY" ||
        dto.type === "BUDGET_NO_DETAIL") &&
      !plan.budgets.length
    ) {
      throw new BadRequestException("Primero genera un presupuesto.");
    }

    const [logoImage, odontogram] = await Promise.all([
      this.resolveTreatmentPlanDocumentLogo(plan),
      dto.type === "ODONTOGRAM"
        ? this.buildTreatmentPlanDocumentOdontogram(plan.patientId)
        : Promise.resolve(null)
    ]);
    if (dto.type === "ODONTOGRAM" && !odontogram?.records.length) {
      throw new BadRequestException("El paciente no tiene registros de odontograma.");
    }

    const input = this.buildTreatmentPlanDocumentInput(plan, dto, { logoImage, odontogram });
    const document = await buildTreatmentPlanDocumentPdf(input);
    await this.audit(actor, "TreatmentPlanDocument", id, mode === "preview" ? "preview" : "generate", {}, {
      treatmentPlanId: id,
      documentType: dto.type,
      budgetId: dto.budgetId ?? plan.budgets[0]?.id ?? null,
      branchId: plan.branchId,
      patientId: plan.patientId
    } as Prisma.InputJsonValue);
    return document;
  }

  private buildTreatmentPlanDocumentInput(
    plan: any,
    dto: PrintTreatmentPlanDocumentDto,
    extras: {
      logoImage?: TreatmentPlanDocumentImage | null;
      odontogram?: TreatmentPlanDocumentOdontogram | null;
    } = {}
  ): TreatmentPlanDocumentInput {
    const items = plan.items.map((item: any) => this.mapTreatmentPlanDocumentItem(item));
    const subtotal = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.subtotal, 0);
    const discount = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.discount, 0);
    const total = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.total, 0);
    const paid = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.paid, 0);
    const budget = plan.budgets[0];
    const clinicAddress = [
      plan.branch.address,
      plan.branch.exteriorNumber,
      plan.branch.interiorNumber,
      plan.branch.neighborhood,
      plan.branch.municipality,
      plan.branch.city,
      plan.branch.state
    ]
      .filter(Boolean)
      .join(", ");

    return {
      documentType: dto.type,
      planId: plan.id,
      planNumber: this.documentNumericId(plan.id),
      planName: plan.name,
      status: plan.status,
      generatedAt: budget?.createdAt ?? plan.createdAt,
      printedAt: new Date(),
      clinicName: plan.organization.name,
      clinicAddress: clinicAddress || plan.organization.address || plan.branch.name,
      clinicPhone: plan.branch.phone || plan.organization.phone || "",
      logoImage: extras.logoImage ?? null,
      patient: {
        id: this.documentNumericId(plan.patient.id),
        name: `${plan.patient.firstName} ${plan.patient.lastName}`.trim(),
        documentNumber: plan.patient.documentNumber || "",
        birthDate: plan.patient.birthDate,
        email: plan.patient.email,
        phone: plan.patient.phone,
        occupation: plan.patient.occupation,
        gender: plan.patient.gender,
        createdAt: plan.patient.createdAt
      },
      professional: {
        name: `${plan.professional.firstName} ${plan.professional.lastName}`.trim(),
        specialty:
          plan.specialtySnapshotName ||
          plan.specialty?.name ||
          plan.professional.specialties?.[0]?.specialty?.name ||
          "General",
        licenseNumber: plan.professional.licenseNumber || "-"
      },
      branchName: plan.branch.name,
      agreementName: plan.patient.agreement?.name || "Sin convenio",
      items,
      odontogram: extras.odontogram ?? null,
      clinicalEvolutions: plan.clinicalEvolutions.map((evolution: any) => ({
        createdAt: evolution.createdAt,
        professionalName: `${evolution.professional.firstName} ${evolution.professional.lastName}`.trim(),
        summary:
          this.plainText(evolution.notes) ||
          this.plainText(evolution.assessment) ||
          this.plainText(evolution.objective) ||
          this.plainText(evolution.plan) ||
          this.plainText(evolution.subjective)
      })),
      labOrder: plan.labOrders?.[0]
        ? {
            id: this.documentNumericId(plan.labOrders[0].id),
            status: plan.labOrders[0].status,
            labProviderName: plan.labOrders[0].labProvider?.name ?? "Laboratorio sin nombre",
            sentAt: plan.labOrders[0].sentAt,
            expectedAt: plan.labOrders[0].expectedAt,
            receivedAt: plan.labOrders[0].receivedAt,
            notes: plan.labOrders[0].notes,
            items: (plan.labOrders[0].items ?? []).map((item: any) => ({
              toothNumber: item.toothNumber ? this.toothPrintLabel(item.toothNumber, null) : null,
              workType: item.description,
              material: null,
              shade: null,
              instructions: item.notes
            }))
          }
        : null,
      totals: {
        subtotal,
        discount,
        total,
        paid,
        balance: Math.max(total - paid, 0)
      }
    };
  }

  private async buildTreatmentPlanDocumentOdontogram(
    patientId: string
  ): Promise<TreatmentPlanDocumentOdontogram> {
    const records = await this.prisma.odontogramRecord.findMany({
      where: {
        patientId,
        status: { not: ToothProcedureStatus.CANCELLED }
      },
      include: {
        professional: { select: { firstName: true, lastName: true } },
        procedure: { select: { code: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const mappedRecords = records.map((record: any) => this.mapTreatmentPlanDocumentOdontogramRecord(record));
    const hasTemporalOnly =
      mappedRecords.length > 0 &&
      mappedRecords.every((record) => ["5", "6", "7", "8"].includes(record.toothNumber[0]));

    return {
      dentition: hasTemporalOnly ? "temporal" : "permanent",
      recordedAt: mappedRecords[0]?.createdAt ?? null,
      records: mappedRecords
    };
  }

  private mapTreatmentPlanDocumentOdontogramRecord(record: any): TreatmentPlanDocumentOdontogramRecord {
    return {
      id: record.id,
      createdAt: record.createdAt,
      toothNumber: record.toothNumber,
      toothLabel: this.toothPrintLabel(record.toothNumber, null),
      surface: record.surface,
      surfaceLabel: this.surfacePrintLabel(record.surface),
      condition: record.condition,
      diagnosis: record.diagnosis,
      odontogramSymbol: record.odontogramSymbol,
      status: record.status,
      procedureCode: record.procedure?.code ?? null,
      procedureName: record.procedure?.name ?? null,
      professionalName:
        `${record.professional?.firstName ?? ""} ${record.professional?.lastName ?? ""}`.trim() || "-"
    };
  }

  private async resolveTreatmentPlanDocumentLogo(plan: any): Promise<TreatmentPlanDocumentImage | null> {
    const logoUrl = plan.branch?.brand?.logoUrl || plan.organization?.logoUrl;
    if (!logoUrl) return null;
    return this.loadTreatmentPlanDocumentImage(logoUrl);
  }

  private async loadTreatmentPlanDocumentImage(value: string): Promise<TreatmentPlanDocumentImage | null> {
    const source = value.trim();
    if (!source) return null;

    const dataMatch = source.match(/^data:(image\/(?:png|jpe?g));base64,(.+)$/i);
    if (dataMatch) {
      return {
        mimeType: this.normalizeDocumentImageMime(dataMatch[1]),
        base64: dataMatch[2]
      };
    }

    if (source.startsWith("/")) {
      const localPath = this.resolveTreatmentPlanDocumentPublicAssetPath(source);
      return this.readTreatmentPlanDocumentImage(localPath, source);
    }

    if (/^https?:\/\//i.test(source)) {
      try {
        const response = await fetch(source);
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type") ?? "";
        if (!/^image\/(?:png|jpe?g)/i.test(contentType)) return null;
        return {
          mimeType: this.normalizeDocumentImageMime(contentType),
          base64: Buffer.from(await response.arrayBuffer()).toString("base64")
        };
      } catch {
        return null;
      }
    }

    return this.readTreatmentPlanDocumentImage(path.resolve(process.cwd(), source), source);
  }

  private resolveTreatmentPlanDocumentPublicAssetPath(source: string) {
    const relativePath = path.join("apps", "web", "public", source.replace(/^\/+/, ""));
    const candidates = [
      path.resolve(process.cwd(), relativePath),
      path.resolve(process.cwd(), "..", "..", relativePath),
      path.resolve(__dirname, "..", "..", "..", "..", "..", relativePath)
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  private async readTreatmentPlanDocumentImage(
    localPath: string,
    source: string
  ): Promise<TreatmentPlanDocumentImage | null> {
    try {
      const bytes = await readFile(localPath);
      const extension = path.extname(source).toLowerCase();
      if (extension !== ".png" && extension !== ".jpg" && extension !== ".jpeg") return null;
      return {
        mimeType: extension === ".png" ? "image/png" : "image/jpeg",
        base64: bytes.toString("base64")
      };
    } catch {
      return null;
    }
  }

  private normalizeDocumentImageMime(value: string): "image/png" | "image/jpeg" {
    return value.toLowerCase().includes("png") ? "image/png" : "image/jpeg";
  }

  private ensurePrintPermission(actor: AuthUser, documentType: string) {
    const permission = TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE[documentType];
    if (!permission) throw new BadRequestException("Unsupported treatment plan document type");
    if (!this.hasAnyPermission(actor, [permission, ...this.legacyPrintPermissions(documentType)])) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }

  private hasAnyPermission(actor: AuthUser, permissions: string[]) {
    if (actor.permissions.includes("system.manage_all")) return true;
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  private legacyPrintPermissions(documentType: string) {
    if (documentType === "ODONTOGRAM") return ["clinical.odontogram.read"];
    if (documentType === "CLINICAL_HISTORY") return ["clinical.read"];
    if (documentType === "LAB_ORDER") return ["lab_orders.read"];
    return ["budgets.print"];
  }

  private mapTreatmentPlanDocumentItem(item: any): TreatmentPlanDocumentItem {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const subtotal = quantity * unitPrice;
    const discount = Number(item.discount) || 0;
    const total = Number(item.total) || 0;
    const paid = this.resolveProcedurePayment(item).paidAmount.toNumber();

    return {
      id: item.id,
      status: this.treatmentPlanItemStatusLabel(item.status),
      procedureCode: item.procedure?.code || item.priceSnapshotCode || "-",
      procedureName: item.procedure?.name || item.priceSnapshotName || "Procedimiento sin nombre",
      sectionName: item.section?.name ?? null,
      toothLabel: this.toothPrintLabel(item.toothNumber, item.surface),
      surfaceLabel: this.surfacePrintLabel(item.surface),
      quantity,
      subtotal,
      discount,
      total,
      paid,
      plannedAt: item.plannedAt,
      completedAt: item.completedAt,
      notes: item.notes
    };
  }

  private treatmentPlanItemStatusLabel(status: TreatmentPlanItemStatus) {
    const labels: Record<TreatmentPlanItemStatus, string> = {
      [TreatmentPlanItemStatus.PLANNED]: "Pendiente",
      [TreatmentPlanItemStatus.ACCEPTED]: "Aceptado",
      [TreatmentPlanItemStatus.PAID]: "Pagado",
      [TreatmentPlanItemStatus.IN_PROGRESS]: "En atencion",
      [TreatmentPlanItemStatus.COMPLETED]: "Realizado",
      [TreatmentPlanItemStatus.CANCELLED]: "Cancelado"
    };
    return labels[status] ?? status;
  }

  private toothPrintLabel(toothNumber?: string | null, surface?: string | null) {
    if (!toothNumber) return "-";
    const normalized = toothNumber.length >= 2 ? `${toothNumber[0]}.${toothNumber[1]}` : toothNumber;
    const surfaceCode = surface?.trim().toUpperCase();
    if (!surfaceCode || surfaceCode === "ALL") return normalized;
    return `${normalized}:${surfaceCode.toLowerCase()}`;
  }

  private surfacePrintLabel(surface?: string | null) {
    const value = surface?.trim().toUpperCase();
    if (!value) return "-";
    if (value === "ALL") return "Pieza completa";
    const labels: Record<string, string> = {
      P: "Palatina",
      M: "Mesial",
      B: "Vestibular",
      V: "Vestibular",
      D: "Distal",
      O: "Oclusal",
      L: "Lingual",
      I: "Incisal"
    };
    return value
      .split(",")
      .map((part) => labels[part.trim()] || part.trim())
      .filter(Boolean)
      .join(", ");
  }

  private documentNumericId(id: string) {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = id.charCodeAt(index) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 1000000)
      .toString()
      .padStart(6, "0");
  }

  private plainText(value?: string | null) {
    return (value ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private mapProcedureListItem(
    plan: { professional: { id: string; firstName: string; lastName: string }; status: TreatmentPlanStatus },
    item: any,
    userDiscountCapability: UserDiscountCapability
  ) {
    const payment = this.resolveProcedurePayment(item);
    const basePrice = new Prisma.Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2);
    const completionPercentage = this.resolveItemCompletionPercentage(
      item.status,
      item.completionPercentage,
      item.completionPercentage
    );
    const procedureMaximum = item.allowsDiscountSnapshot
      ? new Prisma.Decimal(item.maximumDiscountPercentSnapshot ?? 0)
      : new Prisma.Decimal(0);
    const effectiveMaximum = Prisma.Decimal.min(
      userDiscountCapability.effectiveMaximumPercent,
      procedureMaximum
    );

    return {
      id: item.id,
      code: item.procedure?.code ?? "",
      name: item.procedure?.name ?? "",
      description: item.procedure?.description ?? null,
      priceListName: item.priceSnapshotName,
      sectionId: item.sectionId,
      sectionName: item.section?.name ?? null,
      professional: {
        id: plan.professional.id,
        name: `${plan.professional.firstName} ${plan.professional.lastName}`.trim()
      },
      dentalScope: {
        type: item.toothNumber
          ? item.surface && item.surface !== "ALL"
            ? "SURFACES"
            : "WHOLE_TOOTH"
          : "GENERAL",
        toothNumber: item.toothNumber,
        surfaces:
          item.surface && item.surface !== "ALL"
            ? item.surface.split(",").map((surface: string) => surface.trim())
            : []
      },
      discount: {
        type: item.discountType ?? "AMOUNT",
        value: (item.discountValue ?? item.discount).toString(),
        amount: (item.discountAmount ?? item.discount).toString(),
        percent: (item.appliedDiscountPercent ?? 0).toString(),
        reason: item.discountReason ?? null,
        authorizedById: item.discountAuthorizedBy ?? null,
        appliedAt: item.discountedAt ?? null
      },
      pricing: {
        basePrice: (item.originalPrice ?? basePrice).toString(),
        finalPrice: (item.finalPrice ?? item.total).toString(),
        allowsDiscount: item.allowsDiscountSnapshot ?? true,
        userMaximumDiscountPercent: userDiscountCapability.effectiveMaximumPercent.toFixed(2),
        procedureMaximumDiscountPercent: procedureMaximum.toFixed(2),
        effectiveMaximumDiscountPercent: effectiveMaximum.toFixed(2),
        currency: "MXN"
      },
      payment: {
        paidAmount: payment.paidAmount.toString(),
        balance: payment.balance.toString(),
        status: payment.status
      },
      progress: {
        percentage: completionPercentage,
        status: item.status,
        lastEvolutionAt: item.completedAt,
        performedBy: null
      },
      future: {
        isFuture: Boolean(item.plannedAt),
        scheduledAt: item.plannedAt
      },
      status: item.status,
      capabilities: {
        canEdit: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) && payment.paidAmount.lt(item.total),
        canEvolve:
          !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) &&
          item.status !== TreatmentPlanItemStatus.COMPLETED,
        canUnperform:
          !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) && item.status !== TreatmentPlanItemStatus.PLANNED,
        canCollect: payment.balance.gt(0),
        canDelete:
          !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) &&
          payment.paidAmount.eq(0) &&
          !item.budgetItems?.some((budgetItem: any) => budgetItem.budget?.status !== BudgetStatus.DRAFT)
      }
    };
  }

  private resolveProcedurePayment(item: {
    total: Prisma.Decimal;
    paymentAllocations?: Array<{
      amount: Prisma.Decimal;
      settlementDiscountAmount?: Prisma.Decimal;
      payment?: { status?: PaymentStatus } | null;
    }>;
  }) {
    const paidAmount = (item.paymentAllocations ?? []).reduce((sum, allocation) => {
      if (allocation.payment?.status === PaymentStatus.VOIDED) return sum;
      return sum.plus(allocation.amount).plus(allocation.settlementDiscountAmount ?? 0);
    }, new Prisma.Decimal(0));
    const balance = new Prisma.Decimal(item.total).minus(paidAmount).toDecimalPlaces(2);
    let status: "UNPAID" | "PARTIAL" | "PAID" | "CREDIT" = "UNPAID";
    if (paidAmount.gt(item.total)) status = "CREDIT";
    else if (paidAmount.gte(item.total)) status = "PAID";
    else if (paidAmount.gt(0)) status = "PARTIAL";
    return {
      paidAmount: paidAmount.toDecimalPlaces(2),
      balance: balance.gt(0) ? balance : new Prisma.Decimal(0),
      status
    };
  }

  private buildItemData(
    treatmentPlanId: string,
    dto: TreatmentPlanItemBuildInput,
    agreement: TreatmentAgreementSnapshot = null,
    discountedById?: string
  ): Prisma.TreatmentPlanItemUncheckedCreateInput {
    const allowsDiscount = dto.allowsDiscountSnapshot ?? true;
    if (!allowsDiscount && dto.discount > 0) {
      throw new BadRequestException(
        "Procedure does not allow discounts according to its price list snapshot"
      );
    }
    let finalDiscount = dto.discount;
    let agreementCoverage = 0;
    if (allowsDiscount && dto.agreementPricing) {
      finalDiscount =
        finalDiscount + dto.agreementPricing.discountAmount + dto.agreementPricing.coverageAmount;
      agreementCoverage = dto.agreementPricing.coverageAmount;
    } else if (allowsDiscount && agreement && agreement.isActive && Number(agreement.discountPercent) > 0) {
      agreementCoverage = Number(
        (dto.quantity * dto.unitPrice * (Number(agreement.discountPercent) / 100)).toFixed(2)
      );
      finalDiscount = finalDiscount + agreementCoverage;
    }
    const total = this.computeTotal(dto.quantity, dto.unitPrice, finalDiscount);
    const originalPrice = this.roundMoney(
      dto.quantity * (dto.agreementPricing?.normalPrice ?? dto.unitPrice)
    );
    const discountAmount = this.roundMoney(finalDiscount);
    const manualAuthorization = dto.manualDiscountAuthorization;
    return {
      treatmentPlanId,
      sectionId: dto.sectionId,
      procedureId: dto.procedureId,
      toothNumber: dto.toothNumber?.trim(),
      surface: dto.surface?.trim().toUpperCase(),
      odontogramSymbol: dto.odontogramSymbol?.trim() || null,
      quantity: this.decimal(dto.quantity),
      unitPrice: this.decimal(dto.agreementPricing?.normalPrice ?? dto.unitPrice),
      discount: this.decimal(finalDiscount),
      total: this.decimal(total),
      originalPrice: this.decimal(originalPrice),
      allowsDiscountSnapshot: allowsDiscount,
      maximumDiscountPercentSnapshot: this.decimal(dto.maximumDiscountPercentSnapshot ?? 0),
      discountType: discountAmount > 0 ? "AMOUNT" : null,
      discountValue: discountAmount > 0 ? this.decimal(discountAmount) : null,
      discountAmount: this.decimal(discountAmount),
      finalPrice: this.decimal(total),
      discountAuthorizedBy: discountAmount > 0 ? (discountedById ?? null) : null,
      discountedAt: discountAmount > 0 ? new Date() : null,
      discountReason: dto.discount > 0 ? dto.discountReason?.trim() || null : null,
      appliedDiscountPercent: manualAuthorization?.requestedPercent.toDecimalPlaces(2) ?? 0,
      userMaximumDiscountSnapshot: manualAuthorization?.userMaximumPercent ?? 0,
      effectiveMaximumDiscountSnapshot: manualAuthorization?.effectiveMaximumPercent ?? 0,
      status: TreatmentPlanItemStatus.PLANNED,
      priceListId: dto.priceListId,
      priceListItemId: dto.priceListItemId,
      priceSource: dto.priceSource,
      priceSnapshotName: dto.priceSnapshotName,
      priceSnapshotCode: dto.priceSnapshotCode,
      priceSnapshotCategory: dto.priceSnapshotCategory,
      priceResolvedAt: dto.priceResolvedAt,
      priceListVersionId: dto.priceListVersionId,
      priceListVersionNumber: dto.priceListVersionNumber,
      priceListVersionItemId: dto.priceListVersionItemId,
      priceCurrency: dto.priceCurrency,
      laboratoryCostSnapshot: this.decimal(dto.laboratoryCostSnapshot ?? 0),
      internalCostSnapshot: this.decimal(dto.internalCostSnapshot ?? 0),
      pricingRuleSnapshot: dto.pricingRuleSnapshot,
      pricedById: dto.pricedById,
      procedureCodeSnapshot: dto.priceSnapshotCode,
      procedureNameSnapshot: dto.procedureNameSnapshot,
      procedureCategorySnapshot: dto.priceSnapshotCategory,
      priceListNameSnapshot: dto.priceSnapshotName,
      notes: dto.notes?.trim(),
      plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : null,
      agreementId: dto.agreementPricing?.agreementId ?? agreement?.id ?? null,
      agreementVersionId: dto.agreementPricing?.agreementVersionId ?? null,
      agreementVersionNumber: dto.agreementPricing?.agreementVersionNumber ?? null,
      agreementSnapshot: dto.agreementPricing?.snapshot,
      agreementNormalPrice: dto.agreementPricing ? this.decimal(dto.agreementPricing.normalPrice) : null,
      agreementAppliedPrice: dto.agreementPricing ? this.decimal(dto.agreementPricing.appliedPrice) : null,
      agreementDiscountAmount: dto.agreementPricing
        ? this.decimal(dto.agreementPricing.discountAmount)
        : null,
      agreementCoverage: this.decimal(agreementCoverage)
    };
  }

  private computeTotal(quantity: number, unitPrice: number, discount: number) {
    if (quantity <= 0) throw new BadRequestException("quantity must be greater than 0");
    if (unitPrice < 0) throw new BadRequestException("unitPrice cannot be negative");
    if (discount < 0) throw new BadRequestException("discount cannot be negative");
    const total = Number((quantity * unitPrice - discount).toFixed(2));
    if (total < 0) throw new BadRequestException("discount cannot exceed quantity * unitPrice");
    return total;
  }

  private decimal(value: number) {
    return new Prisma.Decimal(value);
  }

  private performedAmountForProgress(total: Prisma.Decimal | number | string, percentage: number) {
    return new Prisma.Decimal(total).mul(percentage).div(100).toDecimalPlaces(2);
  }

  private resolveItemCompletionPercentage(
    status: TreatmentPlanItemStatus,
    currentPercentage: number,
    requestedPercentage?: number
  ) {
    if (requestedPercentage !== undefined) {
      if (![0, 25, 50, 75, 100].includes(requestedPercentage)) {
        throw new BadRequestException("completionPercentage must be one of 0, 25, 50, 75 or 100");
      }
      return requestedPercentage;
    }
    if (status === TreatmentPlanItemStatus.COMPLETED) return 100;
    if (status === TreatmentPlanItemStatus.IN_PROGRESS) return currentPercentage > 0 ? currentPercentage : 25;
    if (status === TreatmentPlanItemStatus.PLANNED || status === TreatmentPlanItemStatus.ACCEPTED) return 0;
    return currentPercentage;
  }

  private async resolveItemPayload(
    actor: AuthUser,
    branchId: string,
    patient: TreatmentPatientForPricing,
    dto: UpdateTreatmentPlanItemDto & { procedureId: string },
    agreement: TreatmentAgreementSnapshot = null
  ): Promise<TreatmentPlanItemBuildInput> {
    const quantity = dto.quantity ?? 1;
    const discount = dto.discount ?? 0;
    if (discount > 0) {
      this.ensureCanApplyTreatmentDiscount(actor);
    }
    const resolved = await this.resolveProcedurePriceSnapshot(
      actor,
      branchId,
      agreement ? { agreement } : patient,
      dto.procedureId
    );
    let unitPrice = resolved.unitPrice;
    let priceSource = resolved.priceSource;

    if (dto.unitPrice !== undefined) {
      if (this.sameMoney(dto.unitPrice, resolved.unitPrice)) {
        unitPrice = dto.unitPrice;
      } else {
        if (!this.canOverrideManualPrices(actor)) {
          throw new BadRequestException(
            "Manual price overrides require price_lists.override_manual permission"
          );
        }
        unitPrice = dto.unitPrice;
        priceSource = TreatmentPriceSource.MANUAL;
      }
    }

    const agreementPricing = await this.resolveAgreementItemPricing(
      actor,
      branchId,
      dto.procedureId,
      quantity,
      unitPrice,
      agreement
    );
    let manualDiscountAuthorization: ManualDiscountAuthorization | null = null;
    if (discount > 0) {
      if (agreementPricing && (agreementPricing.discountAmount > 0 || agreementPricing.coverageAmount > 0)) {
        throw new BadRequestException({
          code: "DISCOUNT_COMBINATION_POLICY_REQUIRED",
          message:
            "No se puede combinar un descuento manual con beneficios de convenio sin una política explícita."
        });
      }
      const base = new Prisma.Decimal(quantity).mul(unitPrice);
      const requestedPercent = base.eq(0)
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(discount).mul(100).div(base);
      manualDiscountAuthorization = await this.validateManualDiscount(
        actor,
        resolved.allowsDiscountSnapshot ?? false,
        resolved.maximumDiscountPercentSnapshot ?? 0,
        requestedPercent
      );
    }
    if (!resolved.allowsDiscountSnapshot && discount > 0) {
      throw new BadRequestException(
        "Procedure does not allow discounts according to its price list snapshot"
      );
    }
    return {
      ...dto,
      procedureId: dto.procedureId,
      quantity,
      unitPrice: agreementPricing?.normalPrice ?? unitPrice,
      discount,
      priceListId: resolved.priceListId,
      priceListItemId: resolved.priceListItemId,
      priceSource,
      priceSnapshotName: resolved.priceSnapshotName,
      priceSnapshotCode: resolved.priceSnapshotCode,
      priceSnapshotCategory: resolved.priceSnapshotCategory,
      priceResolvedAt: resolved.priceResolvedAt,
      priceListVersionId: resolved.priceListVersionId,
      priceListVersionNumber: resolved.priceListVersionNumber,
      priceListVersionItemId: resolved.priceListVersionItemId,
      priceCurrency: resolved.priceCurrency,
      laboratoryCostSnapshot: resolved.laboratoryCostSnapshot,
      internalCostSnapshot: resolved.internalCostSnapshot,
      pricingRuleSnapshot: resolved.pricingRuleSnapshot,
      pricedById: resolved.pricedById,
      procedureNameSnapshot: resolved.procedureNameSnapshot,
      allowsDiscountSnapshot: resolved.allowsDiscountSnapshot,
      maximumDiscountPercentSnapshot: resolved.maximumDiscountPercentSnapshot,
      manualDiscountAuthorization,
      agreementPricing
    };
  }

  private async resolveProcedurePriceSnapshot(
    actor: AuthUser,
    branchId: string,
    patient: TreatmentPatientForPricing,
    procedureId: string
  ): Promise<ProcedurePriceSnapshot> {
    if (process.env.PRICE_LISTS_V2_ENABLED === "true" && this.pricing) {
      const result = await this.pricing.resolve(actor, {
        branchId,
        procedureId,
        agreementId: patient.agreement?.id ?? undefined,
        currency: "MXN"
      });
      return {
        unitPrice: Number(result.basePrice),
        priceListId: result.priceList.id,
        priceListItemId: null,
        priceListVersionId: result.version.id,
        priceListVersionNumber: result.version.number,
        priceListVersionItemId: result.version.itemId,
        priceSource:
          result.rule.source === "MANUAL" ? TreatmentPriceSource.MANUAL : TreatmentPriceSource.PRICE_LIST,
        priceSnapshotName: result.priceList.name,
        priceSnapshotCode: result.procedure.code,
        priceSnapshotCategory: result.procedure.category,
        procedureNameSnapshot: result.procedure.name,
        priceResolvedAt: result.pricedAt,
        priceCurrency: result.currency,
        laboratoryCostSnapshot: Number(result.laboratoryCost),
        internalCostSnapshot: Number(result.internalCost),
        pricingRuleSnapshot: result.rule as Prisma.InputJsonValue,
        pricedById: result.pricedById,
        allowsDiscountSnapshot: result.allowDiscount,
        maximumDiscountPercentSnapshot: Number(result.maxDiscountPercent)
      };
    }
    const preferredPriceListId = patient.agreement?.priceListId;
    const hasBranchScopedLists = await this.prisma.branchPriceList.count({
      where: {
        organizationId: actor.organizationId,
        branchId,
        isActive: true,
        priceList: { isActive: true }
      }
    });

    if (preferredPriceListId) {
      const agreementPrice = await this.findPriceListItemSnapshot({
        procedureId,
        priceListId: preferredPriceListId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          ...(hasBranchScopedLists
            ? {
                branchAssignments: {
                  some: { branchId, isActive: true }
                }
              }
            : {})
        }
      });
      if (agreementPrice) return agreementPrice;
    }

    if (hasBranchScopedLists) {
      const branchDefaultPrice = await this.findPriceListItemSnapshot({
        procedureId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          branchAssignments: {
            some: { branchId, isActive: true, isDefault: true }
          }
        }
      });
      if (branchDefaultPrice) return branchDefaultPrice;

      const branchPrice = await this.findPriceListItemSnapshot({
        procedureId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          branchAssignments: {
            some: { branchId, isActive: true }
          }
        }
      });
      if (branchPrice) return branchPrice;
    }

    const defaultPrice = await this.findPriceListItemSnapshot({
      procedureId,
      priceList: {
        organizationId: actor.organizationId,
        isActive: true,
        isDefault: true
      }
    });
    if (defaultPrice) return defaultPrice;

    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true },
      include: { category: true }
    });
    if (!procedure) throw new BadRequestException("Invalid procedureId");

    return {
      unitPrice: 0,
      priceListId: null,
      priceListItemId: null,
      priceSource: TreatmentPriceSource.UNPRICED,
      priceSnapshotName: null,
      priceSnapshotCode: procedure.code,
      priceSnapshotCategory: procedure.category?.name ?? null,
      priceResolvedAt: new Date(),
      allowsDiscountSnapshot: false,
      maximumDiscountPercentSnapshot: 0
    };
  }

  private async findPriceListItemSnapshot(where: Prisma.PriceListItemWhereInput) {
    const row = await this.prisma.priceListItem.findFirst({
      where,
      include: {
        priceList: { select: { id: true, name: true } },
        priceListCategory: { select: { name: true } },
        procedure: { select: { code: true, name: true, category: { select: { name: true } } } }
      }
    });
    if (!row) return null;

    return {
      unitPrice: Number(row.price),
      priceListId: row.priceListId,
      priceListItemId: row.id,
      priceSource: TreatmentPriceSource.PRICE_LIST,
      priceSnapshotName: row.priceList.name,
      priceSnapshotCode: row.procedure.code,
      priceSnapshotCategory: row.priceListCategory?.name ?? row.procedure.category.name,
      priceResolvedAt: new Date(),
      allowsDiscountSnapshot: row.allowsDiscount,
      maximumDiscountPercentSnapshot: Number(row.maxDiscountPercent)
    };
  }

  private async resolveAgreementItemPricing(
    actor: AuthUser,
    branchId: string,
    procedureId: string,
    quantity: number,
    normalPrice: number,
    agreement: TreatmentAgreementSnapshot
  ): Promise<AgreementItemPricing | null> {
    if (!agreement?.id || !agreement.version) return null;
    const now = new Date();
    if (!agreement.isActive || agreement.status !== "ACTIVE") return null;
    if ((agreement.startsAt && agreement.startsAt > now) || (agreement.endsAt && agreement.endsAt < now))
      return null;
    const version = await this.prisma.agreementVersion.findFirst({
      where: { agreementId: agreement.id, organizationId: actor.organizationId, version: agreement.version },
      include: { branches: true, categoryRules: true, procedureRules: true }
    });
    if (!version) return null;
    if (!version.branches.some((branch) => branch.branchId === branchId)) {
      throw new BadRequestException("Agreement is not valid for this branch");
    }
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true },
      select: { categoryId: true }
    });
    if (!procedure) return null;
    const procedureRule = version.procedureRules.find((row) => row.procedureId === procedureId);
    const categoryRule = version.categoryRules.find(
      (row) => row.procedureCategoryId === procedure.categoryId
    );
    const rule = procedureRule ?? categoryRule;
    if (version.categoryRules.length && !categoryRule && !procedureRule)
      throw new BadRequestException("Procedure category is not eligible for this agreement");
    if (rule && !rule.isEligible)
      throw new BadRequestException("Procedure is not eligible for this agreement");
    const preferredPrice =
      rule?.preferredPrice === null || rule?.preferredPrice === undefined
        ? normalPrice
        : Number(rule.preferredPrice);
    const discountPercent = Number(rule?.discountPercent ?? version.discountPercent);
    const appliedPrice = Number((preferredPrice * (1 - discountPercent / 100)).toFixed(2));
    const coveragePercent = Number(rule?.coveragePercent ?? version.coveragePercent);
    const copayAmount = Number(rule?.copayAmount ?? version.copayAmount);
    const rawCoverage = Number(
      (Math.max(0, appliedPrice * quantity - copayAmount) * (coveragePercent / 100)).toFixed(2)
    );
    const coverageLimit = rule?.coverageLimitAmount ?? version.coverageLimitAmount;
    const coverageAmount = coverageLimit ? Math.min(rawCoverage, Number(coverageLimit)) : rawCoverage;
    const discountAmount = Number(((normalPrice - appliedPrice) * quantity).toFixed(2));
    return {
      agreementId: agreement.id,
      agreementVersionId: version.id,
      agreementVersionNumber: version.version,
      snapshot: {
        agreementId: agreement.id,
        agreementVersionId: version.id,
        agreementVersion: version.version,
        normalPrice,
        appliedPrice,
        discountAmount,
        coverageAmount,
        copayAmount,
        coverageRules: rule?.coverageRules ?? version.coverageRules ?? null
      } as Prisma.InputJsonValue,
      normalPrice,
      appliedPrice,
      discountAmount,
      coverageAmount: Number(coverageAmount.toFixed(2))
    };
  }

  private snapshotFromCurrentItem(item: {
    priceListId?: string | null;
    priceListItemId?: string | null;
    priceSource?: TreatmentPriceSource | null;
    priceSnapshotName?: string | null;
    priceSnapshotCode?: string | null;
    priceSnapshotCategory?: string | null;
    priceResolvedAt?: Date | null;
    allowsDiscountSnapshot?: boolean | null;
    maximumDiscountPercentSnapshot?: Prisma.Decimal | number | null;
  }): ProcedurePriceSnapshot {
    return {
      unitPrice: 0,
      priceListId: item.priceListId ?? null,
      priceListItemId: item.priceListItemId ?? null,
      priceSource: item.priceSource ?? TreatmentPriceSource.MANUAL,
      priceSnapshotName: item.priceSnapshotName ?? null,
      priceSnapshotCode: item.priceSnapshotCode ?? null,
      priceSnapshotCategory: item.priceSnapshotCategory ?? null,
      priceResolvedAt: item.priceResolvedAt ?? null,
      allowsDiscountSnapshot: item.allowsDiscountSnapshot ?? true,
      maximumDiscountPercentSnapshot: Number(item.maximumDiscountPercentSnapshot ?? 0)
    };
  }

  private snapshotFromResolvedPayload(payload: ProcedurePriceSnapshot): ProcedurePriceSnapshot {
    return {
      unitPrice: payload.unitPrice,
      priceListId: payload.priceListId,
      priceListItemId: payload.priceListItemId,
      priceSource: payload.priceSource,
      priceSnapshotName: payload.priceSnapshotName,
      priceSnapshotCode: payload.priceSnapshotCode,
      priceSnapshotCategory: payload.priceSnapshotCategory,
      priceResolvedAt: payload.priceResolvedAt,
      priceListVersionId: payload.priceListVersionId,
      priceListVersionNumber: payload.priceListVersionNumber,
      priceListVersionItemId: payload.priceListVersionItemId,
      priceCurrency: payload.priceCurrency,
      laboratoryCostSnapshot: payload.laboratoryCostSnapshot,
      internalCostSnapshot: payload.internalCostSnapshot,
      pricingRuleSnapshot: payload.pricingRuleSnapshot,
      pricedById: payload.pricedById,
      procedureNameSnapshot: payload.procedureNameSnapshot,
      allowsDiscountSnapshot: payload.allowsDiscountSnapshot,
      maximumDiscountPercentSnapshot: payload.maximumDiscountPercentSnapshot
    };
  }

  private async getDiscountCapability(actor: AuthUser): Promise<UserDiscountCapability> {
    if (!this.discountAuthorization) {
      return {
        userId: actor.id,
        active: true,
        hasPermission: false,
        configuredMaximumPercent: new Prisma.Decimal(0),
        effectiveMaximumPercent: new Prisma.Decimal(0),
        policyVersion: null,
        permissionKeys: []
      };
    }
    return this.discountAuthorization.getUserCapability(actor);
  }

  private async validateManualDiscount(
    actor: AuthUser,
    procedureAllowsDiscount: boolean,
    procedureMaximumPercent: Prisma.Decimal.Value,
    requestedPercent: Prisma.Decimal.Value
  ): Promise<ManualDiscountAuthorization> {
    if (!this.discountAuthorization) {
      throw new ForbiddenException({
        code: "DISCOUNT_POLICY_UNAVAILABLE",
        message: "La política de descuentos no está disponible."
      });
    }
    return this.discountAuthorization.validateRequestedDiscount({
      actor,
      procedureAllowsDiscount,
      procedureMaximumPercent,
      requestedPercent
    });
  }

  private ensureCanApplyTreatmentDiscount(actor: AuthUser) {
    if (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("treatment_discount.apply") ||
      actor.permissions.includes("treatment_discount.override")
    ) {
      return;
    }
    throw new ForbiddenException("Insufficient permissions to apply treatment discounts");
  }

  private canOverrideManualPrices(actor: AuthUser) {
    return (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("price_lists.override_manual")
    );
  }

  private sameMoney(left: number, right: number) {
    return this.roundMoney(left) === this.roundMoney(right);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private normalizeToothNumber(value: string) {
    const toothNumber = value.trim();
    if (!/^([1-4][1-8]|[5-8][1-5])$/.test(toothNumber)) {
      throw new BadRequestException("Invalid toothNumber for FDI notation");
    }
    return toothNumber;
  }

  private normalizeSurface(value?: string) {
    if (!value) return undefined;
    const surface = value.trim().toUpperCase();
    const allowedSingle = new Set(["O", "I", "M", "D", "B", "L", "P", "C"]);
    const allowedLegacy = new Set(["MO", "DO", "MOD", "ALL"]);
    if (allowedSingle.has(surface) || allowedLegacy.has(surface)) return surface;

    const preferredOrder = ["P", "M", "B", "D", "O", "I", "L", "C"];
    const parts = [
      ...new Set(
        surface
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      )
    ];
    if (!parts.length || parts.some((part) => !allowedSingle.has(part)))
      throw new BadRequestException("Invalid tooth surface");
    parts.sort((left, right) => preferredOrder.indexOf(left) - preferredOrder.indexOf(right));
    return parts.join(",");
  }

  private mapItemStatusToToothProcedureStatus(status: TreatmentPlanItemStatus) {
    if (status === TreatmentPlanItemStatus.IN_PROGRESS) return ToothProcedureStatus.IN_PROGRESS;
    if (status === TreatmentPlanItemStatus.COMPLETED) return ToothProcedureStatus.COMPLETED;
    if (status === TreatmentPlanItemStatus.CANCELLED) return ToothProcedureStatus.CANCELLED;
    if (status === TreatmentPlanItemStatus.ACCEPTED || status === TreatmentPlanItemStatus.PAID)
      return ToothProcedureStatus.ACCEPTED;
    return ToothProcedureStatus.PLANNED;
  }

  private mapItemProgressToToothProcedureStatus(
    status: TreatmentPlanItemStatus,
    completionPercentage?: number
  ) {
    if (status === TreatmentPlanItemStatus.CANCELLED) return ToothProcedureStatus.CANCELLED;
    if (completionPercentage === 100 || status === TreatmentPlanItemStatus.COMPLETED)
      return ToothProcedureStatus.COMPLETED;
    if ((completionPercentage ?? 0) > 0 || status === TreatmentPlanItemStatus.IN_PROGRESS)
      return ToothProcedureStatus.IN_PROGRESS;
    return this.mapItemStatusToToothProcedureStatus(status);
  }

  private async syncTreatmentItemOdontogram(
    tx: Prisma.TransactionClient,
    plan: { id: string; patientId: string; professionalId: string },
    item: {
      id: string;
      procedureId: string;
      toothNumber: string | null;
      surface: string | null;
      odontogramSymbol: string | null;
      status: TreatmentPlanItemStatus;
      notes: string | null;
    },
    notes?: string
  ) {
    if (!item.toothNumber) return;

    const toothNumber = this.normalizeToothNumber(item.toothNumber);
    const surface = this.normalizeSurface(item.surface ?? undefined);
    const status = this.mapItemStatusToToothProcedureStatus(item.status);
    const odontogramSymbol = item.odontogramSymbol?.trim() || null;
    const diagnosis = odontogramSymbol ?? notes ?? item.notes?.trim() ?? null;
    const current = await tx.toothProcedure.findUnique({
      where: { treatmentPlanItemId: item.id },
      include: { odontogramRecord: true }
    });

    const recordPayload = {
      patientId: plan.patientId,
      professionalId: plan.professionalId,
      toothNumber,
      surface,
      condition: "TOOTH_PROCEDURE",
      diagnosis,
      odontogramSymbol,
      procedureId: item.procedureId,
      status,
      notes: diagnosis
    };

    if (current) {
      if (current.odontogramRecordId) {
        await tx.odontogramRecord.update({
          where: { id: current.odontogramRecordId },
          data: recordPayload
        });
      } else {
        const record = await tx.odontogramRecord.create({ data: recordPayload });
        await tx.toothProcedure.update({
          where: { id: current.id },
          data: { odontogramRecordId: record.id }
        });
      }

      await tx.toothProcedure.update({
        where: { id: current.id },
        data: {
          patientId: plan.patientId,
          professionalId: plan.professionalId,
          procedureId: item.procedureId,
          treatmentPlanId: plan.id,
          treatmentPlanItemId: item.id,
          toothNumber,
          surface,
          diagnosis,
          odontogramSymbol,
          status,
          notes: diagnosis,
          completedAt: status === ToothProcedureStatus.COMPLETED ? (current.completedAt ?? new Date()) : null
        }
      });
      return;
    }

    const record = await tx.odontogramRecord.create({ data: recordPayload });
    await tx.toothProcedure.create({
      data: {
        patientId: plan.patientId,
        professionalId: plan.professionalId,
        procedureId: item.procedureId,
        treatmentPlanId: plan.id,
        treatmentPlanItemId: item.id,
        odontogramRecordId: record.id,
        toothNumber,
        surface,
        diagnosis,
        odontogramSymbol,
        status,
        notes: diagnosis,
        completedAt: status === ToothProcedureStatus.COMPLETED ? new Date() : null
      }
    });
  }

  private async syncTreatmentItemProcedureStatus(
    itemId: string,
    itemStatus: TreatmentPlanItemStatus,
    completionPercentage?: number
  ) {
    const status = this.mapItemProgressToToothProcedureStatus(itemStatus, completionPercentage);
    const current = await this.prisma.toothProcedure.findUnique({
      where: { treatmentPlanItemId: itemId },
      select: { id: true, odontogramRecordId: true, completedAt: true }
    });
    if (!current) return;

    const completedAt =
      status === ToothProcedureStatus.COMPLETED ? (current.completedAt ?? new Date()) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.toothProcedure.update({
        where: { id: current.id },
        data: { status, completedAt }
      });
      if (current.odontogramRecordId) {
        await tx.odontogramRecord.update({
          where: { id: current.odontogramRecordId },
          data: { status }
        });
      }
    });
  }

  private ensureTreatmentPlanCanMutate(plan: { status: TreatmentPlanStatus }, action = "modify") {
    if (CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status)) {
      throw new BadRequestException(`Cannot ${action} a cancelled or rejected treatment plan`);
    }
  }

  private canViewPrivateEvolutions(actor: AuthUser) {
    return (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("orthodontics.private_evolutions.view")
    );
  }

  private orthodonticEvolutionInclude() {
    return {
      fields: { orderBy: { sortOrder: "asc" as const } },
      materials: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } }
      },
      professional: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } }
    };
  }

  private mapOrthodonticSummary(plan: any, canViewPrivate: boolean) {
    const profile = plan.orthodonticProfile;
    const evolutions = plan.clinicalEvolutions ?? [];
    const now = new Date();
    const calendar = this.resolveOrthodonticCalendar(plan, now);
    const controls = plan.orthodonticControls ?? [];
    const hygieneSeries = this.resolveOrthodonticHygieneSeries(plan, evolutions);
    const hygieneScores = hygieneSeries.map((item: any) => Number(item.score));
    const latestHygiene = hygieneSeries[hygieneSeries.length - 1] ?? null;
    const latestEvolution = evolutions[0] ? this.mapOrthodonticEvolution(evolutions[0]) : null;
    const completedControls = controls.length || this.legacyCompletedOrthodonticControls(evolutions);
    const plannedControls = profile?.estimatedControls ?? profile?.estimatedMonths ?? 0;
    const realPercentage = plannedControls ? (completedControls / plannedControls) * 100 : 0;
    const nextAppointment = plan.appointments?.[0] ?? null;
    const financialSummary = this.resolveOrthodonticFinancialSummary(plan.items ?? []);
    const deviations = this.resolveOrthodonticDeviation(
      calendar,
      realPercentage,
      completedControls,
      plannedControls,
      profile
    );

    return {
      treatmentPlanId: plan.id,
      status: calendar.status,
      startedAt: profile?.startDate ?? null,
      completedAt: profile?.actualEndDate ?? plan.completedAt ?? null,
      calendarProgress: calendar,
      calendarProgressPercent: calendar.percentage,
      calendarProgressLabel: calendar.label,
      elapsedActiveDays: calendar.activeDays,
      elapsedPausedDays: calendar.pausedDays,
      elapsedMonths: calendar.elapsedMonths,
      estimatedEndAt: calendar.estimatedEndAt,
      monthsExceeded: calendar.monthsExceeded,
      realProgress: {
        percentage: realPercentage,
        displayPercentage: Math.min(100, Math.max(0, realPercentage)),
        completedControls,
        plannedControls,
        status: deviations.status,
        label: deviations.label,
        calculationMethod: plannedControls ? "COMPLETED_ORTHODONTIC_CONTROLS" : "INSUFFICIENT_PLANNING",
        additionalControls: plannedControls ? Math.max(0, completedControls - plannedControls) : 0,
        deviationPercentage: deviations.percentage
      },
      realProgressPercent: realPercentage,
      realProgressLabel: this.resolveControlsProgressLabel(
        realPercentage,
        completedControls,
        plannedControls
      ),
      realProgressStatus: deviations.status,
      realControlsCount: completedControls,
      estimatedControls: plannedControls || null,
      estimatedMonths: profile?.estimatedMonths ?? null,
      isPaused: calendar.status === "PAUSED",
      pauseStartDate: calendar.pauseStartDate,
      plan: {
        id: plan.id,
        patientId: plan.patientId,
        name: plan.name,
        status: calendar.status,
        rawStatus: plan.status,
        startedAt: profile?.startDate ?? null,
        completedAt: plan.completedAt,
        plannedDurationMonths: profile?.estimatedMonths ?? null,
        professional: {
          id: plan.professional.id,
          name: this.professionalName(plan.professional)
        },
        branch: plan.branch
      },
      planning: {
        plannedMonths: profile?.estimatedMonths ?? null,
        plannedControls: plannedControls || null,
        completedControls,
        controlFrequencyValue: profile?.controlFrequencyValue ?? null,
        controlFrequencyUnit: profile?.controlFrequencyUnit ?? null
      },
      currentClinicalState: this.resolveLatestOrthodonticClinicalState(evolutions),
      hygiene: {
        latestScore: latestHygiene?.score ?? null,
        maximumScore: latestHygiene?.maximumScore ?? 7,
        latestRecordedAt: latestHygiene?.date ?? null,
        average: hygieneScores.length
          ? Number(
              (
                hygieneScores.reduce((sum: number, score: number) => sum + score, 0) / hygieneScores.length
              ).toFixed(2)
            )
          : null,
        trend: this.resolveHygieneTrend(hygieneScores, latestHygiene?.higherIsBetter ?? true),
        series: hygieneSeries,
        points: hygieneSeries.map((point: any) => ({
          evolutionId: point.evolutionId,
          value: point.score,
          maximumScore: point.maximumScore ?? 7,
          minimumScore: point.minimumScore ?? 1,
          recordedAt: point.date,
          professionalName: point.professionalName,
          label: point.label ?? null,
          controlId: point.controlId ?? null
        }))
      },
      appointment: nextAppointment
        ? {
            id: nextAppointment.id,
            startAt: nextAppointment.startAt,
            endAt: nextAppointment.endAt,
            status: nextAppointment.status,
            professional: {
              id: nextAppointment.professional?.id ?? nextAppointment.professionalId,
              name: this.professionalName(nextAppointment.professional)
            }
          }
        : null,
      milestones: this.resolveOrthodonticMilestones(plan.orthodonticMilestones ?? [], now),
      finances: financialSummary,
      latestEvolution,
      recentEvolutions: evolutions
        .slice(0, 5)
        .map((evolution: any) => this.mapOrthodonticEvolution(evolution)),
      capabilities: {
        canStart: !profile?.startDate && !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canPause: Boolean(profile?.startDate) && calendar.status === "ACTIVE",
        canResume: calendar.status === "PAUSED",
        canComplete: Boolean(profile?.startDate) && !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canEdit: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canCreateEvolution: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canViewPrivateEvolutions: canViewPrivate
      }
    };
  }

  private resolveOrthodonticCalendar(plan: any, now: Date) {
    const profile = plan.orthodonticProfile;
    const startDate = profile?.startDate ?? null;
    const activePause = (plan.pauses ?? []).find((pause: any) => !pause.endDate);
    const estimatedMonths = profile?.estimatedMonths ?? null;

    if (!startDate) {
      return {
        percentage: 0,
        status: "NOT_STARTED",
        label: "Sin iniciar",
        startedAt: null,
        estimatedEndAt: null,
        activeDays: 0,
        pausedDays: 0,
        pauseStartDate: null,
        elapsedMonths: 0,
        estimatedMonths,
        monthsExceeded: 0,
        displayPercentage: 0
      };
    }

    const finishedAt = profile?.actualEndDate ?? plan.completedAt ?? null;
    const evaluationDate = finishedAt ?? activePause?.startDate ?? now;
    let pausedDays = 0;
    for (const pause of plan.pauses ?? []) {
      const pauseEnd = pause.endDate ?? evaluationDate;
      pausedDays += Math.max(0, Math.floor((pauseEnd.getTime() - pause.startDate.getTime()) / 86400000));
    }
    const activeDays = Math.max(
      0,
      Math.floor((evaluationDate.getTime() - startDate.getTime()) / 86400000) - pausedDays
    );
    const elapsedMonths = this.completeMonthsBetween(startDate, evaluationDate);
    const percentage = estimatedMonths && estimatedMonths > 0 ? (elapsedMonths / estimatedMonths) * 100 : 0;
    const estimatedEndAt = estimatedMonths ? this.addMonths(startDate, estimatedMonths) : null;
    const monthsExceeded = estimatedMonths ? Math.max(0, elapsedMonths - estimatedMonths) : 0;
    const status =
      plan.status === TreatmentPlanStatus.COMPLETED ? "COMPLETED" : activePause ? "PAUSED" : "ACTIVE";

    return {
      percentage,
      displayPercentage: Math.min(100, Math.max(0, percentage)),
      status,
      label:
        monthsExceeded > 0
          ? `Plazo estimado superado por ${monthsExceeded} ${monthsExceeded === 1 ? "mes" : "meses"}`
          : activePause
            ? "Calendario detenido"
            : `${elapsedMonths} de ${estimatedMonths ?? 0} meses transcurridos`,
      startedAt: startDate,
      estimatedEndAt,
      activeDays,
      pausedDays,
      pauseStartDate: activePause?.startDate ?? null,
      elapsedMonths,
      estimatedMonths,
      monthsExceeded
    };
  }

  private completeMonthsBetween(startDate: Date, endDate: Date) {
    if (endDate <= startDate) return 0;
    let months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth();
    if (endDate.getDate() < startDate.getDate()) months -= 1;
    return Math.max(0, months);
  }

  private addMonths(startDate: Date, months: number) {
    const target = new Date(startDate);
    target.setMonth(target.getMonth() + months);
    return target;
  }

  private resolveLatestOrthodonticClinicalState(evolutions: any[]) {
    const source = (label: string) => this.latestFieldSource(evolutions, label);
    return {
      upperArchMaterial: source("arco superior material"),
      upperArchSize: source("arco superior tamano"),
      lowerArchMaterial: source("arco inferior material"),
      lowerArchSize: source("arco inferior tamano"),
      upperAligner: source("alineador superior"),
      lowerAligner: source("alineador inferior"),
      elasticsType: source("tipo de elasticos"),
      elasticsConfig: source("configuracion elasticos"),
      elasticType: source("tipo de elasticos"),
      elasticConfiguration: source("configuracion elasticos"),
      nextControl: source("proximo control"),
      alert: source("alerta"),
      nextSessionInstructions: source("indicaciones proxima sesion"),
      radiographicControl: source("control radiografico"),
      intraoralPhotos: source("fotografias intraorales"),
      extraoralPhotos: source("fotografias extraorales")
    };
  }

  private latestFieldSource(evolutions: any[], label: string) {
    for (const evolution of evolutions) {
      const field = this.findEvolutionField(evolution, label);
      if (field?.value?.trim()) {
        return {
          value: field.value,
          recordedAt: evolution.createdAt,
          evolutionId: evolution.id,
          professionalName: this.professionalName(evolution.professional)
        };
      }
    }
    return null;
  }

  private mapOrthodonticEvolution(evolution: any) {
    const professionalName = this.professionalName(evolution.professional);
    const plainText = this.plainEvolutionComment(evolution);
    return {
      id: evolution.id,
      createdAt: evolution.createdAt,
      recordedAt: evolution.createdAt,
      professionalName,
      createdByName: evolution.createdBy ? this.userName(evolution.createdBy) : null,
      notes: evolution.notes,
      plainText,
      professional: {
        id: evolution.professional?.id,
        name: professionalName
      },
      comment: plainText,
      isPrivate: evolution.isPrivate,
      fields: (evolution.fields ?? []).map((field: any) => ({
        label: field.label,
        value: field.value,
        group: field.group ?? null,
        sortOrder: field.sortOrder ?? 0
      })),
      hygiene: this.fieldInt(evolution, "higiene"),
      orthodonticControl: {
        radiographicControl: this.fieldBoolean(evolution, "control radiografico"),
        intraoralPhotos: this.fieldBoolean(evolution, "fotografias intraorales"),
        extraoralPhotos: this.fieldBoolean(evolution, "fotografias extraorales"),
        upperArchMaterial: this.fieldValue(evolution, "arco superior material"),
        upperArchSize: this.fieldValue(evolution, "arco superior tamano"),
        lowerArchMaterial: this.fieldValue(evolution, "arco inferior material"),
        lowerArchSize: this.fieldValue(evolution, "arco inferior tamano"),
        upperAligner: this.fieldValue(evolution, "alineador superior"),
        lowerAligner: this.fieldValue(evolution, "alineador inferior"),
        elasticType: this.fieldValue(evolution, "tipo de elasticos"),
        elasticConfiguration: this.fieldValue(evolution, "configuracion elasticos"),
        nextControl: this.fieldValue(evolution, "proximo control"),
        alert: this.fieldValue(evolution, "alerta"),
        nextSessionInstructions: this.fieldValue(evolution, "indicaciones proxima sesion"),
        hygieneScore: this.fieldInt(evolution, "higiene")
      },
      materials: (evolution.materials ?? []).map((material: any) => ({
        productId: material.inventoryItemId,
        name: material.nameSnapshot || material.inventoryItem?.name || "Material clinico",
        quantity: Number(material.quantity),
        unit: material.unitSnapshot || material.inventoryItem?.unit || null
      })),
      createdBy: evolution.createdBy
        ? { id: evolution.createdBy.id, name: this.userName(evolution.createdBy) }
        : null
    };
  }

  private findEvolutionField(evolution: any, label: string) {
    const target = this.normalizeClinicalFieldLabel(label);
    return (evolution.fields ?? []).find((field: any) =>
      this.normalizeClinicalFieldLabel(field.label).includes(target)
    );
  }

  private fieldValue(evolution: any, label: string) {
    return this.findEvolutionField(evolution, label)?.value || null;
  }

  private fieldBoolean(evolution: any, label: string) {
    const value = this.fieldValue(evolution, label);
    if (!value) return false;
    return ["si", "sí", "true", "1"].includes(this.normalizeClinicalFieldLabel(value));
  }

  private fieldInt(evolution: any, label: string) {
    const value = this.fieldValue(evolution, label);
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private resolveOrthodonticHygieneSeries(plan: any, evolutions: any[]) {
    const assessments = plan.orthodonticHygieneAssessments ?? [];
    if (assessments.length) {
      return assessments
        .filter(
          (assessment: any) => assessment.numericValue !== null && assessment.numericValue !== undefined
        )
        .map((assessment: any) => ({
          assessmentId: assessment.id,
          evolutionId: assessment.evolutionId ?? null,
          controlId: assessment.controlId ?? null,
          date: assessment.clinicalDate,
          score: Number(assessment.numericValue),
          maximumScore: assessment.scale?.maxValue ?? null,
          minimumScore: assessment.scale?.minValue ?? null,
          higherIsBetter: assessment.scale?.higherIsBetter ?? true,
          label: assessment.option?.label ?? null,
          professionalName: null,
          observations: assessment.observations ?? null,
          recommendations: assessment.recommendations ?? null
        }));
    }

    return evolutions
      .slice()
      .reverse()
      .map((evolution: any) => {
        const score = this.fieldInt(evolution, "higiene");
        if (score === null) return null;
        return {
          assessmentId: null,
          evolutionId: evolution.id,
          controlId: null,
          date: evolution.createdAt,
          score,
          maximumScore: 7,
          minimumScore: 1,
          higherIsBetter: true,
          label: null,
          professionalName: this.professionalName(evolution.professional),
          observations: null,
          recommendations: null
        };
      })
      .filter(Boolean);
  }

  private legacyCompletedOrthodonticControls(evolutions: any[]) {
    return evolutions.filter((evolution) => {
      return Boolean(
        this.fieldBoolean(evolution, "control realizado") ||
        this.fieldValue(evolution, "higiene") ||
        this.fieldValue(evolution, "arco superior") ||
        this.fieldValue(evolution, "arco inferior") ||
        this.fieldValue(evolution, "tipo de elasticos") ||
        this.fieldValue(evolution, "configuracion elasticos")
      );
    }).length;
  }

  private resolveOrthodonticFinancialSummary(items: any[]) {
    return items.reduce(
      (summary, item) => {
        if (item.status === TreatmentPlanItemStatus.CANCELLED) return summary;
        const total = new Prisma.Decimal(item.total ?? 0);
        const discount = new Prisma.Decimal(item.discount ?? 0);
        const paid = (item.paymentAllocations ?? []).reduce((sum: Prisma.Decimal, allocation: any) => {
          if (allocation.payment?.status === PaymentStatus.VOIDED) return sum;
          return sum.plus(allocation.amount ?? 0).plus(allocation.settlementDiscountAmount ?? 0);
        }, new Prisma.Decimal(0));
        const completionPercentage = Math.min(100, Math.max(0, Number(item.completionPercentage ?? 0)));
        const performed = total.mul(completionPercentage).div(100);
        summary.budgetTotal = summary.budgetTotal.plus(total);
        summary.discountTotal = summary.discountTotal.plus(discount);
        summary.performedTotal = summary.performedTotal.plus(performed);
        summary.paidTotal = summary.paidTotal.plus(paid);
        summary.balance = summary.balance.plus(Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid)));
        return summary;
      },
      {
        budgetTotal: new Prisma.Decimal(0),
        discountTotal: new Prisma.Decimal(0),
        performedTotal: new Prisma.Decimal(0),
        paidTotal: new Prisma.Decimal(0),
        balance: new Prisma.Decimal(0)
      }
    );
  }

  private resolveOrthodonticDeviation(
    calendar: { percentage: number; monthsExceeded?: number },
    realPercentage: number,
    completedControls: number,
    plannedControls: number,
    profile: any
  ) {
    if (!profile?.startDate || !profile?.estimatedMonths || !plannedControls) {
      return {
        status: "SIN_DATOS_SUFICIENTES",
        percentage: 0,
        label: "Sin datos suficientes para comparar calendario y controles"
      };
    }
    if ((calendar.monthsExceeded ?? 0) > 0 && realPercentage < 100) {
      return {
        status: "PLAZO_EXCEDIDO",
        percentage: realPercentage - calendar.percentage,
        label: `Plazo estimado superado por ${calendar.monthsExceeded} ${calendar.monthsExceeded === 1 ? "mes" : "meses"}`
      };
    }
    const percentage = realPercentage - calendar.percentage;
    if (percentage < -15) {
      return {
        status: "POR_DEBAJO_DEL_RITMO",
        percentage,
        label: `Seguimiento ${Math.abs(Math.round(percentage))} puntos por debajo del calendario`
      };
    }
    if (percentage > 15) {
      const additional = Math.max(0, completedControls - plannedControls);
      return {
        status: "POR_ENCIMA_DEL_RITMO",
        percentage,
        label: additional
          ? `${additional} ${additional === 1 ? "control adicional" : "controles adicionales"} sobre la planificacion`
          : `Seguimiento ${Math.round(percentage)} puntos por encima del calendario`
      };
    }
    return {
      status: "EN_RITMO",
      percentage,
      label: "Seguimiento en ritmo operativo"
    };
  }

  private resolveControlsProgressLabel(
    realProgress: number,
    completedControls: number,
    plannedControls: number
  ) {
    if (!plannedControls) return "Sin controles planificados";
    const additional = Math.max(0, completedControls - plannedControls);
    if (additional > 0) {
      return `${additional} ${additional === 1 ? "control adicional" : "controles adicionales"}`;
    }
    return `${completedControls} de ${plannedControls} controles realizados (${Math.round(realProgress)}%)`;
  }

  private resolveOrthodonticMilestones(milestones: any[], now: Date) {
    return milestones.map((milestone) => {
      let status = milestone.status;
      if (status === OrthodonticMilestoneStatus.PENDING) {
        const daysUntil = Math.ceil((milestone.plannedAt.getTime() - now.getTime()) / 86400000);
        if (daysUntil < 0) status = OrthodonticMilestoneStatus.OVERDUE;
        else if (daysUntil <= 14) status = OrthodonticMilestoneStatus.UPCOMING;
      }
      return {
        id: milestone.id,
        type: milestone.type,
        label: milestone.label,
        plannedAt: milestone.plannedAt,
        completedAt: milestone.completedAt,
        status,
        professionalId: milestone.professionalId,
        evolutionId: milestone.evolutionId,
        fileAttachmentId: milestone.fileAttachmentId,
        notes: milestone.notes,
        findings: milestone.findings
      };
    });
  }

  private resolveHygieneTrend(scores: number[], higherIsBetter = true) {
    if (scores.length < 2) return "INSUFFICIENT_DATA";
    const first = scores[0];
    const last = scores[scores.length - 1];
    if (last === first) return "STABLE";
    const improved = higherIsBetter ? last > first : last < first;
    if (improved) return "IMPROVING";
    return "DECLINING";
  }

  private plainEvolutionComment(evolution: any) {
    return [evolution.notes, evolution.assessment, evolution.objective, evolution.plan, evolution.subjective]
      .filter(Boolean)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  private professionalName(professional?: { firstName?: string | null; lastName?: string | null } | null) {
    return [professional?.firstName, professional?.lastName].filter(Boolean).join(" ") || "Sin profesional";
  }

  private userName(user?: { firstName?: string | null; lastName?: string | null } | null) {
    return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Usuario";
  }

  private normalizeClinicalFieldLabel(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .toLowerCase()
      .trim();
  }

  private async ensureTreatmentPlan(actor: AuthUser, treatmentPlanId: string) {
    const row = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        agreement: true,
        patient: { include: { agreement: true } }
      }
    });
    if (!row) throw new NotFoundException("Treatment plan not found");
    return row;
  }

  private async ensureOrthodonticTreatmentPlan(actor: AuthUser, treatmentPlanId: string) {
    const row = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    if (row.kind !== TreatmentPlanKind.ORTHODONTICS) {
      throw new BadRequestException("Orthodontic data can only be updated on orthodontic treatment plans");
    }
    return row;
  }

  private withTreatmentPlanDerivedState<
    T extends {
      status: TreatmentPlanStatus;
      items?: Array<{ status: TreatmentPlanItemStatus; completionPercentage?: number | null }>;
      kind: TreatmentPlanKind;
      orthodonticProfile?: {
        startDate: Date | null;
        estimatedMonths: number | null;
        estimatedControls: number | null;
      } | null;
      clinicalEvolutions?: Array<{
        id: string;
        createdAt: Date;
        notes: string | null;
        objective: string | null;
        assessment: string | null;
        plan: string | null;
      }>;
      pauses?: Array<{ startDate: Date; endDate: Date | null }>;
    }
  >(plan: T, extra: Record<string, unknown> = {}) {
    const clinicalProgress = calculateTreatmentPlanClinicalProgress(plan.items ?? []);
    return {
      ...plan,
      ...extra,
      clinicalProgress,
      clinicalStatus: resolveTreatmentPlanClinicalStatus(plan.status, clinicalProgress),
      orthodonticSummary: this.buildOrthodonticSummary(plan)
    };
  }

  private async syncTreatmentPlanStatusFromItems(tx: Prisma.TransactionClient, treatmentPlanId: string) {
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { status: true }
    });
    if (!plan) return null;

    const items = await tx.treatmentPlanItem.findMany({
      where: { treatmentPlanId },
      select: { status: true, completionPercentage: true }
    });
    const clinicalProgress = calculateTreatmentPlanClinicalProgress(items);
    const nextStatus = resolveTreatmentPlanStatusFromClinicalProgress(plan.status, clinicalProgress);
    if (nextStatus !== plan.status) {
      await tx.treatmentPlan.update({
        where: { id: treatmentPlanId },
        data: { status: nextStatus }
      });
    }

    return { clinicalProgress, previousStatus: plan.status, status: nextStatus };
  }

  private buildOrthodonticSummary(plan: {
    kind: TreatmentPlanKind;
    orthodonticProfile?: {
      startDate: Date | null;
      estimatedMonths: number | null;
      estimatedControls: number | null;
    } | null;
    clinicalEvolutions?: Array<{
      id: string;
      createdAt: Date;
      notes: string | null;
      objective: string | null;
      assessment: string | null;
      plan: string | null;
    }>;
    orthodonticControls?: Array<{ id: string }>;
    pauses?: Array<{ startDate: Date; endDate: Date | null }>;
  }) {
    if (plan.kind !== TreatmentPlanKind.ORTHODONTICS) return null;

    const startDate = plan.orthodonticProfile?.startDate;
    const estimatedMonths = plan.orthodonticProfile?.estimatedMonths ?? 0;
    const estimatedControls = plan.orthodonticProfile?.estimatedControls ?? estimatedMonths;
    const pauses = plan.pauses ?? [];

    let calendarProgress = 0;
    let isPaused = false;
    let pauseStartDate: Date | null = null;
    let totalPauseDays = 0;

    const now = new Date();

    for (const pause of pauses) {
      if (!pause.endDate) {
        isPaused = true;
        pauseStartDate = pause.startDate;
        // Pause active, calculate days up to now
        const diffMs = now.getTime() - pause.startDate.getTime();
        totalPauseDays += Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      } else {
        const diffMs = pause.endDate.getTime() - pause.startDate.getTime();
        totalPauseDays += Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      }
    }

    if (startDate && estimatedMonths > 0) {
      // Calculate total elapsed days
      const totalElapsedMs = now.getTime() - startDate.getTime();
      const totalElapsedDays = Math.max(0, totalElapsedMs / (1000 * 60 * 60 * 24));

      const effectiveElapsedDays = Math.max(0, totalElapsedDays - totalPauseDays);
      const effectiveElapsedMonths = effectiveElapsedDays / 30.436875; // Average days in month

      calendarProgress = (effectiveElapsedMonths / estimatedMonths) * 100;
    }

    const realControlsCount = plan.orthodonticControls?.length ?? plan.clinicalEvolutions?.length ?? 0;
    let realProgress = 0;
    if (estimatedControls > 0) {
      realProgress = (realControlsCount / estimatedControls) * 100;
    }

    return {
      calendarProgress,
      realProgress,
      realControlsCount,
      estimatedControls,
      isPaused,
      pauseStartDate,
      latestEvolution: plan.clinicalEvolutions?.[0] ?? null
    };
  }

  private orthodonticProfileCatalogInclude() {
    return {
      fieldValues: {
        include: {
          field: true,
          option: true
        }
      },
      optionValues: {
        include: {
          field: true,
          option: true
        },
        orderBy: { createdAt: "asc" as const }
      }
    };
  }

  private orthodonticDiagnosisInclude() {
    return {
      fieldValues: {
        include: {
          field: { include: { section: true } },
          option: true
        },
        orderBy: { createdAt: "asc" as const }
      },
      multiOptionValues: {
        include: {
          field: { include: { section: true } },
          option: true
        },
        orderBy: { createdAt: "asc" as const }
      }
    };
  }

  private async ensureOrthodonticDiagnosisCatalogSeed(actorId?: string) {
    await this.prisma.$transaction(async (tx) => {
      for (const sectionSeed of ORTHODONTIC_DIAGNOSIS_SECTION_SEEDS) {
        const section = await (tx as any).orthodonticDiagnosisSection.upsert({
          where: { code: sectionSeed.code },
          create: {
            code: sectionSeed.code,
            name: sectionSeed.name,
            sortOrder: sectionSeed.sortOrder,
            isActive: true
          },
          update: {
            name: sectionSeed.name,
            sortOrder: sectionSeed.sortOrder,
            isActive: true
          }
        });
        for (const [fieldIndex, fieldSeed] of sectionSeed.fields.entries()) {
          const field = await (tx as any).orthodonticDiagnosisField.upsert({
            where: { sectionId_code: { sectionId: section.id, code: fieldSeed.code } },
            create: {
              sectionId: section.id,
              code: fieldSeed.code,
              name: fieldSeed.name,
              inputType: fieldSeed.inputType,
              allowsMultiple: Boolean(fieldSeed.allowsMultiple),
              isRequired: false,
              isHighlighted: Boolean(fieldSeed.isHighlighted),
              isFavorite: false,
              includeInSummary: Boolean(fieldSeed.includeInSummary),
              unitType: fieldSeed.unitType,
              sortOrder: fieldIndex,
              isConfigurable: Boolean(fieldSeed.options?.length),
              isActive: true
            },
            update: {
              name: fieldSeed.name,
              inputType: fieldSeed.inputType,
              allowsMultiple: Boolean(fieldSeed.allowsMultiple),
              isHighlighted: Boolean(fieldSeed.isHighlighted),
              includeInSummary: Boolean(fieldSeed.includeInSummary),
              unitType: fieldSeed.unitType,
              sortOrder: fieldIndex,
              isConfigurable: Boolean(fieldSeed.options?.length),
              isActive: true
            }
          });
          for (const [optionIndex, label] of (fieldSeed.options ?? []).entries()) {
            const normalizedLabel = this.normalizeOptionLabel(label);
            await (tx as any).orthodonticDiagnosisFieldOption.upsert({
              where: { fieldId_normalizedLabel: { fieldId: field.id, normalizedLabel } },
              create: {
                fieldId: field.id,
                code: `${fieldSeed.code}_${this.optionCode(label) || optionIndex}`,
                label,
                normalizedLabel,
                sortOrder: optionIndex,
                createdById: actorId,
                updatedById: actorId
              },
              update: {
                sortOrder: optionIndex,
                updatedById: actorId
              }
            });
          }
        }
      }
    });
  }

  private async findOrthodonticDiagnosisCatalog(includeInactive: boolean) {
    const sections = await (this.prisma as any).orthodonticDiagnosisSection.findMany({
      where: { isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            options: {
              where: includeInactive ? {} : { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return sections.map((section: any) => ({
      id: section.id,
      code: section.code,
      name: section.name,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field: any) => ({
        id: field.id,
        sectionId: field.sectionId,
        code: field.code,
        name: field.name,
        inputType: field.inputType,
        allowsMultiple: field.allowsMultiple,
        isRequired: field.isRequired,
        isHighlighted: field.isHighlighted,
        isFavorite: field.isFavorite,
        includeInSummary: field.includeInSummary,
        unitType: field.unitType,
        sortOrder: field.sortOrder,
        isConfigurable: field.isConfigurable,
        isActive: field.isActive,
        options: field.options.map((option: any) => ({
          id: option.id,
          code: option.code,
          label: option.label,
          sortOrder: option.sortOrder,
          isActive: option.isActive,
          usageCount: option.usageCount,
          version: option.version
        }))
      }))
    }));
  }

  private async findCurrentOrthodonticDiagnosis(treatmentPlanId: string) {
    const draft = await (this.prisma as any).orthodonticDiagnosis.findFirst({
      where: { treatmentPlanId, status: OrthodonticDiagnosisStatus.DRAFT },
      include: this.orthodonticDiagnosisInclude(),
      orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]
    });
    if (draft) return draft;
    return (this.prisma as any).orthodonticDiagnosis.findFirst({
      where: { treatmentPlanId, status: OrthodonticDiagnosisStatus.ACTIVE },
      include: this.orthodonticDiagnosisInclude(),
      orderBy: [{ versionNumber: "desc" }, { activatedAt: "desc" }]
    });
  }

  private hasOrthodonticDiagnosisResponses(diagnosis: any) {
    return Boolean(
      (diagnosis?.fieldValues?.length ?? 0) > 0 || (diagnosis?.multiOptionValues?.length ?? 0) > 0
    );
  }

  private mapOrthodonticDiagnosisResult(plan: any, diagnosis: any) {
    if (!diagnosis || !this.hasOrthodonticDiagnosisResponses(diagnosis)) {
      return {
        treatmentPlanId: plan.id,
        status: "EMPTY",
        diagnosis: null,
        summaryItems: [],
        sectionsWithData: []
      };
    }
    const summaryItems: Array<{ fieldCode: string; fieldName: string; sectionName: string; value: string }> =
      [];
    const sectionsWithData = new Map<string, { code: string; name: string; count: number }>();
    const valueRows = diagnosis.fieldValues ?? [];
    for (const value of valueRows) {
      const field = value.field;
      const section = field?.section;
      const displayValue = this.formatOrthodonticDiagnosisValue(value);
      if (!displayValue) continue;
      if (section) {
        const current = sectionsWithData.get(section.code) ?? {
          code: section.code,
          name: section.name,
          count: 0
        };
        current.count += 1;
        sectionsWithData.set(section.code, current);
      }
      if (field?.includeInSummary) {
        summaryItems.push({
          fieldCode: field.code,
          fieldName: field.name,
          sectionName: section?.name ?? "",
          value: displayValue
        });
      }
    }
    const groupedMulti = new Map<string, any[]>();
    for (const row of diagnosis.multiOptionValues ?? []) {
      groupedMulti.set(row.fieldId, [...(groupedMulti.get(row.fieldId) ?? []), row]);
    }
    for (const rows of groupedMulti.values()) {
      const first = rows[0];
      const field = first.field;
      const section = field?.section;
      const displayValue = rows
        .map((row) => row.optionLabelSnapshot ?? row.option?.label)
        .filter(Boolean)
        .join(", ");
      if (!displayValue) continue;
      if (section) {
        const current = sectionsWithData.get(section.code) ?? {
          code: section.code,
          name: section.name,
          count: 0
        };
        current.count += 1;
        sectionsWithData.set(section.code, current);
      }
      if (field?.includeInSummary) {
        summaryItems.push({
          fieldCode: field.code,
          fieldName: field.name,
          sectionName: section?.name ?? "",
          value: displayValue
        });
      }
    }
    return {
      treatmentPlanId: plan.id,
      status: diagnosis.status,
      diagnosis: {
        id: diagnosis.id,
        status: diagnosis.status,
        versionNumber: diagnosis.versionNumber,
        previousVersionId: diagnosis.previousVersionId,
        clinicalDate: diagnosis.clinicalDate,
        activatedAt: diagnosis.activatedAt,
        changeReason: diagnosis.changeReason,
        values: [
          ...valueRows.map((value: any) => ({
            fieldCode: value.field?.code,
            fieldId: value.fieldId,
            valueText: value.valueText,
            valueNumber: value.valueNumber,
            valueDate: value.valueDate,
            valueBoolean: value.valueBoolean,
            unitId: value.unitId,
            optionId: value.optionId,
            optionLabelSnapshot: value.optionLabelSnapshot
          })),
          ...Array.from(groupedMulti.values()).map((rows: any[]) => ({
            fieldCode: rows[0]?.field?.code,
            fieldId: rows[0]?.fieldId,
            optionIds: rows.map((row) => row.optionId).filter(Boolean),
            optionLabelsSnapshot: rows
              .map((row) => row.optionLabelSnapshot ?? row.option?.label)
              .filter(Boolean)
          }))
        ]
      },
      summaryItems,
      sectionsWithData: Array.from(sectionsWithData.values())
    };
  }

  private formatOrthodonticDiagnosisValue(value: any) {
    if (value.optionLabelSnapshot || value.option?.label)
      return value.optionLabelSnapshot ?? value.option?.label;
    if (value.valueText) return String(value.valueText);
    if (value.valueNumber !== null && value.valueNumber !== undefined) return String(value.valueNumber);
    if (value.valueDate) return new Date(value.valueDate).toISOString();
    if (value.valueBoolean !== null && value.valueBoolean !== undefined)
      return value.valueBoolean ? "Si" : "No";
    return "";
  }

  private async saveOrthodonticDiagnosisWorkflow(
    actor: AuthUser,
    id: string,
    dto: SaveOrthodonticDiagnosisDto,
    targetStatus: "DRAFT" | "ACTIVE"
  ) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "save orthodontic diagnosis for");
    await this.ensureOrthodonticDiagnosisCatalogSeed(actor.id);

    const cleanValues = this.cleanOrthodonticDiagnosisValues(dto.values ?? []);
    if (targetStatus === OrthodonticDiagnosisStatus.ACTIVE && cleanValues.length === 0) {
      throw new BadRequestException("Cannot activate an empty orthodontic diagnosis");
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const fields = await (tx as any).orthodonticDiagnosisField.findMany({
        where: { code: { in: cleanValues.map((value) => value.fieldCode) }, isActive: true },
        include: { options: true, section: true }
      });
      const fieldsByCode = new Map<string, any>(fields.map((field: any) => [field.code, field]));
      for (const value of cleanValues) {
        if (!fieldsByCode.has(value.fieldCode)) {
          throw new BadRequestException(`Unknown orthodontic diagnosis field: ${value.fieldCode}`);
        }
      }

      let diagnosis = await (tx as any).orthodonticDiagnosis.findFirst({
        where: { treatmentPlanId: plan.id, status: OrthodonticDiagnosisStatus.DRAFT },
        orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]
      });
      const activeDiagnosis = await (tx as any).orthodonticDiagnosis.findFirst({
        where: { treatmentPlanId: plan.id, status: OrthodonticDiagnosisStatus.ACTIVE },
        orderBy: [{ versionNumber: "desc" }, { activatedAt: "desc" }]
      });

      if (!diagnosis || targetStatus === OrthodonticDiagnosisStatus.ACTIVE) {
        if (targetStatus === OrthodonticDiagnosisStatus.ACTIVE && diagnosis) {
          await (tx as any).orthodonticDiagnosis.update({
            where: { id: diagnosis.id },
            data: { status: OrthodonticDiagnosisStatus.VOIDED, voidedById: actor.id, voidedAt: new Date() }
          });
          diagnosis = null;
        }
        if (!diagnosis) {
          diagnosis = await (tx as any).orthodonticDiagnosis.create({
            data: {
              treatmentPlanId: plan.id,
              patientId: plan.patientId,
              professionalId: plan.professionalId,
              branchId: plan.branchId,
              status: targetStatus,
              versionNumber: activeDiagnosis ? activeDiagnosis.versionNumber + 1 : 1,
              previousVersionId: activeDiagnosis?.id ?? null,
              clinicalDate: this.optionalDate(dto.clinicalDate) ?? null,
              changeReason: this.optionalString(dto.changeReason),
              createdById: actor.id,
              activatedById: targetStatus === OrthodonticDiagnosisStatus.ACTIVE ? actor.id : null,
              activatedAt: targetStatus === OrthodonticDiagnosisStatus.ACTIVE ? new Date() : null
            }
          });
        }
      }

      await (tx as any).orthodonticDiagnosisFieldValue.deleteMany({ where: { diagnosisId: diagnosis.id } });
      await (tx as any).orthodonticDiagnosisMultiOptionValue.deleteMany({
        where: { diagnosisId: diagnosis.id }
      });

      for (const value of cleanValues) {
        const field = fieldsByCode.get(value.fieldCode);
        const optionsById = new Map<string, { id: string; label: string }>(
          (field.options ?? []).map((option: any) => [option.id, option])
        );
        if (field.allowsMultiple) {
          const optionIds = [...new Set(value.optionIds ?? [])];
          if (optionIds.length === 0) continue;
          const options = optionIds.map((optionId) => optionsById.get(optionId));
          if (options.some((option) => !option))
            throw new BadRequestException(`Invalid option for ${field.name}`);
          await (tx as any).orthodonticDiagnosisMultiOptionValue.createMany({
            data: options.map((option: any) => ({
              diagnosisId: diagnosis.id,
              fieldId: field.id,
              optionId: option.id,
              optionLabelSnapshot: option.label
            })),
            skipDuplicates: true
          });
          continue;
        }

        const option = value.optionId ? optionsById.get(value.optionId) : null;
        if (value.optionId && !option) throw new BadRequestException(`Invalid option for ${field.name}`);
        await (tx as any).orthodonticDiagnosisFieldValue.create({
          data: {
            diagnosisId: diagnosis.id,
            fieldId: field.id,
            valueText: value.valueText ?? null,
            valueNumber: value.valueNumber ?? null,
            valueDate: value.valueDate ? new Date(value.valueDate) : null,
            valueBoolean: value.valueBoolean ?? null,
            unitId: value.unitId ?? null,
            optionId: option?.id ?? null,
            optionLabelSnapshot: option?.label ?? null
          }
        });
      }

      if (targetStatus === OrthodonticDiagnosisStatus.ACTIVE) {
        if (activeDiagnosis) {
          await (tx as any).orthodonticDiagnosis.update({
            where: { id: activeDiagnosis.id },
            data: { status: OrthodonticDiagnosisStatus.AMENDED }
          });
        }
        await (tx as any).orthodonticDiagnosis.update({
          where: { id: diagnosis.id },
          data: {
            status: OrthodonticDiagnosisStatus.ACTIVE,
            activatedById: actor.id,
            activatedAt: new Date(),
            clinicalDate: this.optionalDate(dto.clinicalDate) ?? new Date(),
            changeReason: this.optionalString(dto.changeReason),
            version: { increment: 1 }
          }
        });
      } else {
        await (tx as any).orthodonticDiagnosis.update({
          where: { id: diagnosis.id },
          data: {
            clinicalDate: this.optionalDate(dto.clinicalDate) ?? undefined,
            changeReason: this.optionalString(dto.changeReason),
            version: { increment: 1 }
          }
        });
      }

      return (tx as any).orthodonticDiagnosis.findUnique({
        where: { id: diagnosis.id },
        include: this.orthodonticDiagnosisInclude()
      });
    });

    await this.audit(
      actor,
      "OrthodonticDiagnosis",
      saved.id,
      targetStatus === "ACTIVE" ? "activate" : "save_draft",
      {},
      {
        treatmentPlanId: plan.id,
        status: targetStatus,
        valueCount: cleanValues.length
      } as Prisma.InputJsonValue
    );
    return this.mapOrthodonticDiagnosisResult(plan, saved);
  }

  private cleanOrthodonticDiagnosisValues(values: SaveOrthodonticDiagnosisDto["values"]) {
    return (values ?? [])
      .map((value) => ({
        fieldCode: value.fieldCode,
        valueText: this.optionalString(value.valueText),
        valueNumber:
          value.valueNumber === null || value.valueNumber === undefined ? null : Number(value.valueNumber),
        valueDate: value.valueDate || null,
        valueBoolean: value.valueBoolean ?? null,
        unitId: this.optionalString(value.unitId),
        optionId: this.optionalString(value.optionId),
        optionIds: [...new Set((value.optionIds ?? []).filter(Boolean))]
      }))
      .filter((value) => {
        if (!value.fieldCode) return false;
        if (value.valueText) return true;
        if (value.valueNumber !== null && !Number.isNaN(value.valueNumber)) return true;
        if (value.valueDate) return true;
        if (value.valueBoolean !== null) return true;
        if (value.optionId) return true;
        return value.optionIds.length > 0;
      });
  }

  private async findOrthodonticDiagnosisOption(optionId: string) {
    const option = await (this.prisma as any).orthodonticDiagnosisFieldOption.findUnique({
      where: { id: optionId },
      include: { field: true }
    });
    if (!option) throw new NotFoundException("Orthodontic diagnosis option not found");
    return option;
  }

  private async countOrthodonticDiagnosisOptionUsage(optionId: string) {
    const [singleCount, multipleCount] = await Promise.all([
      (this.prisma as any).orthodonticDiagnosisFieldValue.count({ where: { optionId } }),
      (this.prisma as any).orthodonticDiagnosisMultiOptionValue.count({ where: { optionId } })
    ]);
    return singleCount + multipleCount;
  }

  private async ensureOrthodonticCatalogSeed(organizationId: string, actorId?: string) {
    const existing = await (this.prisma as any).orthodonticOptionField.count({ where: { organizationId } });
    if (existing > 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const [fieldIndex, seed] of ORTHODONTIC_PLAN_FIELD_SEEDS.entries()) {
        const field = await (tx as any).orthodonticOptionField.upsert({
          where: { organizationId_code: { organizationId, code: seed.code } },
          create: {
            organizationId,
            code: seed.code,
            name: seed.name,
            inputType: seed.inputType,
            allowsMultiple: seed.allowsMultiple,
            isConfigurable: true,
            isActive: true
          },
          update: {
            name: seed.name,
            inputType: seed.inputType,
            allowsMultiple: seed.allowsMultiple,
            isActive: true
          }
        });
        for (const [optionIndex, label] of seed.options.entries()) {
          const normalizedLabel = this.normalizeOptionLabel(label);
          await (tx as any).orthodonticFieldOption.upsert({
            where: { fieldId_normalizedLabel: { fieldId: field.id, normalizedLabel } },
            create: {
              fieldId: field.id,
              code: `${seed.code}_${this.optionCode(label) || fieldIndex}_${optionIndex}`,
              label,
              normalizedLabel,
              sortOrder: optionIndex,
              createdById: actorId,
              updatedById: actorId
            },
            update: {
              sortOrder: optionIndex
            }
          });
        }
      }
    });
  }

  private async findOrthodonticOptionFields(organizationId: string, includeInactive: boolean) {
    const fields = await (this.prisma as any).orthodonticOptionField.findMany({
      where: { organizationId, isActive: true },
      include: {
        options: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
        }
      },
      orderBy: { name: "asc" }
    });
    return fields.map((field: OrthodonticCatalogFieldRow) => ({
      id: field.id,
      code: field.code,
      name: field.name,
      inputType: field.inputType,
      allowsMultiple: field.allowsMultiple,
      isConfigurable: field.isConfigurable,
      isActive: field.isActive,
      options: field.options.map((option) => ({
        id: option.id,
        code: option.code,
        label: option.label,
        sortOrder: option.sortOrder,
        isActive: option.isActive,
        version: option.version
      }))
    }));
  }

  private async findOrthodonticOptionForActor(actor: AuthUser, optionId: string) {
    const option = await (this.prisma as any).orthodonticFieldOption.findFirst({
      where: { id: optionId, field: { organizationId: actor.organizationId } },
      include: { field: true }
    });
    if (!option) throw new NotFoundException("Orthodontic option not found");
    return option;
  }

  private async countOrthodonticOptionUsage(optionId: string) {
    const [singleCount, multipleCount] = await Promise.all([
      (this.prisma as any).orthodonticPlanFieldValue.count({ where: { optionId } }),
      (this.prisma as any).orthodonticPlanOptionValue.count({ where: { optionId } })
    ]);
    return singleCount + multipleCount;
  }

  private async replaceOrthodonticCatalogSelections(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    profileId: string,
    selections: Record<string, string[]>
  ) {
    const fields: Array<{
      id: string;
      code: string;
      allowsMultiple: boolean;
      options: Array<{ id: string; label: string }>;
    }> = await (tx as any).orthodonticOptionField.findMany({
      where: { organizationId: actor.organizationId, code: { in: Object.keys(selections) } },
      include: { options: true }
    });
    const fieldsByCode = new Map<string, (typeof fields)[number]>(fields.map((field) => [field.code, field]));

    for (const [fieldCode, rawOptionIds] of Object.entries(selections)) {
      const field = fieldsByCode.get(fieldCode);
      if (!field) throw new BadRequestException(`Unknown orthodontic field: ${fieldCode}`);
      const optionIds = [...new Set((rawOptionIds ?? []).filter(Boolean))];
      const options = field.options.filter((option: any) => optionIds.includes(option.id));
      if (options.length !== optionIds.length) {
        throw new BadRequestException(`Invalid option for orthodontic field: ${fieldCode}`);
      }

      if (field.allowsMultiple) {
        await (tx as any).orthodonticPlanOptionValue.deleteMany({
          where: { orthodonticProfileId: profileId, fieldId: field.id }
        });
        if (options.length) {
          await (tx as any).orthodonticPlanOptionValue.createMany({
            data: options.map((option: any) => ({
              orthodonticProfileId: profileId,
              fieldId: field.id,
              optionId: option.id,
              optionLabelSnapshot: option.label
            })),
            skipDuplicates: true
          });
        }
        continue;
      }

      const option = options[0] ?? null;
      if (!option) {
        await (tx as any).orthodonticPlanFieldValue.deleteMany({
          where: { orthodonticProfileId: profileId, fieldId: field.id }
        });
      } else {
        await (tx as any).orthodonticPlanFieldValue.upsert({
          where: { orthodonticProfileId_fieldId: { orthodonticProfileId: profileId, fieldId: field.id } },
          create: {
            orthodonticProfileId: profileId,
            fieldId: field.id,
            optionId: option.id,
            optionLabelSnapshot: option.label
          },
          update: {
            optionId: option.id,
            optionLabelSnapshot: option.label
          }
        });
      }
    }
  }

  private cleanOptionLabel(label: string) {
    const cleaned = label.trim().replace(/\s+/g, " ");
    if (!cleaned) throw new BadRequestException("Option label is required");
    if (cleaned.length > 120) throw new BadRequestException("Option label is too long");
    return cleaned;
  }

  private normalizeOptionLabel(label: string) {
    return this.cleanOptionLabel(label)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private optionCode(label: string) {
    return this.normalizeOptionLabel(label)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }

  private optionalDate(value?: string | null) {
    if (value === undefined) return undefined;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date");
    return date;
  }

  private optionalString(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const row = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });
    if (!row) throw new BadRequestException("Invalid branchId");
  }

  private async validatePatient(actor: AuthUser, patientId: string) {
    const trimmed = patientId.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    const row = await this.prisma.patient.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        deletedAt: null,
        ...(isNumeric
          ? { OR: [{ id: trimmed }, { patientNumber: parseInt(trimmed, 10) }] }
          : { id: trimmed })
      },
      include: { agreement: true }
    });
    if (!row) throw new BadRequestException("Invalid patientId");
    return row;
  }

  private async resolveTreatmentAgreement(actor: AuthUser, branchId: string, agreementId?: string | null) {
    if (!agreementId) return null;
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId: actor.organizationId },
      include: {
        priceList: { select: { id: true, name: true, isDefault: true } },
        versions: { include: { branches: true } }
      }
    });
    if (!agreement) throw new BadRequestException("Invalid agreementId");
    const now = new Date();
    if (!agreement.isActive || agreement.status !== "ACTIVE") {
      throw new BadRequestException("Agreement is not active");
    }
    if ((agreement.startsAt && agreement.startsAt > now) || (agreement.endsAt && agreement.endsAt < now)) {
      throw new BadRequestException("Agreement is outside its validity period");
    }
    const version = agreement.versions.find((row) => row.version === agreement.version);
    if (!version || !version.branches.some((branch) => branch.branchId === branchId)) {
      throw new BadRequestException("Agreement is not valid for this branch");
    }
    return agreement;
  }

  private treatmentAgreementSnapshot(agreement: {
    id: string;
    name: string;
    version: number;
    priceListId?: string | null;
    priceList?: { id: string; name: string } | null;
  }) {
    return {
      agreementId: agreement.id,
      agreementName: agreement.name,
      agreementVersion: agreement.version,
      priceListId: agreement.priceListId ?? agreement.priceList?.id ?? null,
      priceListName: agreement.priceList?.name ?? null
    } as Prisma.InputJsonValue;
  }

  private async validateProfessional(actor: AuthUser, professionalId: string, branchId?: string) {
    const now = new Date();
    const row = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        ...(branchId
          ? {
              branches: {
                some: {
                  branchId,
                  status: ProfessionalBranchStatus.ACTIVE,
                  startsAt: { lte: now },
                  OR: [{ endsAt: null }, { endsAt: { gt: now } }]
                }
              }
            }
          : {})
      }
    });
    if (!row) throw new BadRequestException("Invalid professionalId");
  }

  private async validateProfessionalPlanSpecialty(
    actor: AuthUser,
    professionalId: string,
    branchId: string | undefined,
    requestedKind?: TreatmentPlanKind
  ): Promise<ProfessionalPlanSpecialty> {
    const now = new Date();
    const row = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        ...(branchId
          ? {
              branches: {
                some: {
                  branchId,
                  status: ProfessionalBranchStatus.ACTIVE,
                  startsAt: { lte: now },
                  OR: [{ endsAt: null }, { endsAt: { gt: now } }]
                }
              }
            }
          : {})
      },
      include: {
        specialties: {
          include: {
            specialty: { select: { id: true, name: true, isActive: true } }
          }
        }
      }
    });
    if (!row) throw new BadRequestException("Invalid professionalId");

    const options = row.specialties
      .map(({ specialty }) => this.mapSpecialtyToPlanKind(specialty))
      .filter((option): option is ProfessionalPlanSpecialty => Boolean(option));

    if (!options.length) {
      throw new BadRequestException(
        "El profesional seleccionado no tiene una especialidad valida para planes de tratamiento"
      );
    }

    if (requestedKind) {
      const match = options.find((option) => option.kind === requestedKind);
      if (!match)
        throw new BadRequestException(
          "El profesional seleccionado no tiene la especialidad requerida para este plan"
        );
      return match;
    }

    const uniqueKinds = [...new Set(options.map((option) => option.kind))];
    if (uniqueKinds.length > 1) {
      throw new BadRequestException("Selecciona si el plan es general u ortodoncia para este profesional");
    }

    return options[0];
  }

  private mapSpecialtyToPlanKind(specialty: {
    id: string;
    name: string;
    isActive?: boolean | null;
  }): ProfessionalPlanSpecialty | null {
    if (specialty.isActive === false) return null;
    const allowedName = resolveAllowedSpecialtyName(specialty.name);
    if (!allowedName) return null;
    const kind = allowedName === "Ortodoncia" ? TreatmentPlanKind.ORTHODONTICS : TreatmentPlanKind.GENERAL;
    return { id: specialty.id, name: allowedName, kind };
  }

  private async validateProcedure(actor: AuthUser, procedureId: string) {
    const row = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private async validateProcedureInTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    procedureId: string
  ) {
    const row = await tx.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private async validateSection(treatmentPlanId: string, sectionId: string) {
    const row = await this.prisma.treatmentPlanSection.findFirst({
      where: { id: sectionId, treatmentPlanId }
    });
    if (!row) throw new BadRequestException("Invalid sectionId for treatment plan");
  }

  private async validateSectionInTransaction(
    tx: Prisma.TransactionClient,
    treatmentPlanId: string,
    sectionId: string
  ) {
    const row = await tx.treatmentPlanSection.findFirst({
      where: { id: sectionId, treatmentPlanId }
    });
    if (!row) throw new BadRequestException("Invalid sectionId for treatment plan");
  }

  private async audit(
    actor: AuthUser,
    entity: string,
    entityId: string | null,
    action: string,
    before: Prisma.InputJsonValue,
    after: Prisma.InputJsonValue
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity,
        entityId: entityId ?? undefined,
        action,
        before,
        after
      }
    });
  }

  async reactivateTreatmentPlan(actor: AuthUser, id: string, dto: ReactivateTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    if (plan.status !== "CANCELLED" && plan.status !== "REJECTED") {
      throw new BadRequestException("Only cancelled or rejected plans can be reactivated");
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        status: "DRAFT",
        description: dto.reason
          ? `${plan.description || ""}\nReactivated: ${dto.reason}`.trim()
          : plan.description
      }
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "reactivate",
      { status: plan.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async deactivateTreatmentPlan(actor: AuthUser, id: string, dto: DeactivateTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    if (plan.status === TreatmentPlanStatus.COMPLETED) {
      throw new BadRequestException("Completed treatment plans cannot be deactivated");
    }
    if (plan.status === TreatmentPlanStatus.CANCELLED) {
      return plan;
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        status: TreatmentPlanStatus.CANCELLED,
        description: dto.reason
          ? `${plan.description || ""}\nDeactivated: ${dto.reason}`.trim()
          : plan.description
      }
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "deactivate",
      { status: plan.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async duplicateTreatmentPlan(actor: AuthUser, id: string, dto: DuplicateTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    const branchId = dto.newBranchId || plan.branchId;
    const professionalId = dto.newProfessionalId || plan.professionalId;
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      professionalId,
      branchId,
      plan.kind
    );

    // Deep clone the plan, sections, and items
    return this.prisma.$transaction(async (tx) => {
      const newPlan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          patientId: plan.patientId,
          professionalId,
          kind: plan.kind,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name,
          name: `${plan.name} (Copy)`,
          description: dto.reason || plan.description,
          status: TreatmentPlanStatus.DRAFT
        }
      });

      if (plan.kind === TreatmentPlanKind.ORTHODONTICS) {
        await tx.orthodonticTreatmentProfile.create({
          data: plan.orthodonticProfile
            ? {
                treatmentPlanId: newPlan.id,
                startDate: plan.orthodonticProfile.startDate,
                estimatedMonths: plan.orthodonticProfile.estimatedMonths,
                lastUpperArch: plan.orthodonticProfile.lastUpperArch,
                lastLowerArch: plan.orthodonticProfile.lastLowerArch,
                nextControlAt: plan.orthodonticProfile.nextControlAt,
                nextRadiographyAt: plan.orthodonticProfile.nextRadiographyAt,
                hygieneStatus: plan.orthodonticProfile.hygieneStatus,
                alert: plan.orthodonticProfile.alert,
                indications: plan.orthodonticProfile.indications,
                elastics: plan.orthodonticProfile.elastics,
                diagnosis: plan.orthodonticProfile.diagnosis as Prisma.InputJsonValue,
                planNotes: plan.orthodonticProfile.planNotes
              }
            : { treatmentPlanId: newPlan.id }
        });
      }

      for (const section of plan.sections) {
        const newSection = await tx.treatmentPlanSection.create({
          data: {
            treatmentPlanId: newPlan.id,
            name: section.name,
            sortOrder: section.sortOrder
          }
        });

        const sectionItems = plan.items.filter((item) => item.sectionId === section.id);
        for (const item of sectionItems) {
          await tx.treatmentPlanItem.create({
            data: {
              treatmentPlanId: newPlan.id,
              sectionId: newSection.id,
              procedureId: item.procedureId,
              toothNumber: item.toothNumber,
              surface: item.surface,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
              originalPrice: item.originalPrice,
              allowsDiscountSnapshot: item.allowsDiscountSnapshot,
              maximumDiscountPercentSnapshot: item.maximumDiscountPercentSnapshot,
              discountType: item.discountType,
              discountValue: item.discountValue,
              discountAmount: item.discountAmount,
              finalPrice: item.finalPrice,
              discountReason: item.discountReason,
              discountAuthorizedBy: item.discountAuthorizedBy,
              discountedAt: item.discountedAt,
              appliedDiscountPercent: item.appliedDiscountPercent,
              userMaximumDiscountSnapshot: item.userMaximumDiscountSnapshot,
              effectiveMaximumDiscountSnapshot: item.effectiveMaximumDiscountSnapshot,
              priceListId: item.priceListId,
              priceListItemId: item.priceListItemId,
              priceListVersionId: item.priceListVersionId,
              priceListVersionNumber: item.priceListVersionNumber,
              priceListVersionItemId: item.priceListVersionItemId,
              priceSource: item.priceSource,
              priceSnapshotName: item.priceSnapshotName,
              priceSnapshotCode: item.priceSnapshotCode,
              priceSnapshotCategory: item.priceSnapshotCategory,
              procedureCodeSnapshot: item.procedureCodeSnapshot,
              procedureNameSnapshot: item.procedureNameSnapshot,
              procedureCategorySnapshot: item.procedureCategorySnapshot,
              priceListNameSnapshot: item.priceListNameSnapshot,
              priceResolvedAt: item.priceResolvedAt,
              priceCurrency: item.priceCurrency,
              laboratoryCostSnapshot: item.laboratoryCostSnapshot,
              internalCostSnapshot: item.internalCostSnapshot,
              pricingRuleSnapshot: item.pricingRuleSnapshot ?? undefined,
              pricedById: item.pricedById,
              agreementId: item.agreementId,
              agreementVersionId: item.agreementVersionId,
              agreementVersionNumber: item.agreementVersionNumber,
              agreementSnapshot: item.agreementSnapshot ?? undefined,
              agreementNormalPrice: item.agreementNormalPrice,
              agreementAppliedPrice: item.agreementAppliedPrice,
              agreementDiscountAmount: item.agreementDiscountAmount,
              agreementCoverage: item.agreementCoverage,
              notes: item.notes,
              status: TreatmentPlanItemStatus.PLANNED
            }
          });
        }
      }

      return newPlan;
    });
  }

  async referTreatmentPlan(actor: AuthUser, id: string, dto: ReferTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    const targetProfessionalId = dto.toProfessionalId || plan.professionalId;
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      targetProfessionalId,
      dto.toBranchId,
      plan.kind
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Create a referral record
      const referral = await tx.treatmentPlanReferral.create({
        data: {
          treatmentPlanId: id,
          organizationId: actor.organizationId,
          fromBranchId: plan.branchId,
          toBranchId: dto.toBranchId,
          fromProfessionalId: plan.professionalId,
          toProfessionalId: dto.toProfessionalId,
          reason: dto.reason,
          createdById: actor.id
        }
      });

      // 2. We can either transfer the current plan or duplicate it.
      // Usually "refer" implies transferring the plan, or duplicating it and cancelling the original.
      // We'll duplicate it and mark the original as cancelled for tracking.

      const newPlan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.toBranchId,
          patientId: plan.patientId,
          professionalId: targetProfessionalId,
          kind: plan.kind,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name,
          name: `${plan.name} (Referred)`,
          description: dto.reason,
          status: TreatmentPlanStatus.DRAFT
        }
      });

      if (plan.kind === TreatmentPlanKind.ORTHODONTICS) {
        await tx.orthodonticTreatmentProfile.create({
          data: plan.orthodonticProfile
            ? {
                treatmentPlanId: newPlan.id,
                startDate: plan.orthodonticProfile.startDate,
                estimatedMonths: plan.orthodonticProfile.estimatedMonths,
                lastUpperArch: plan.orthodonticProfile.lastUpperArch,
                lastLowerArch: plan.orthodonticProfile.lastLowerArch,
                nextControlAt: plan.orthodonticProfile.nextControlAt,
                nextRadiographyAt: plan.orthodonticProfile.nextRadiographyAt,
                hygieneStatus: plan.orthodonticProfile.hygieneStatus,
                alert: plan.orthodonticProfile.alert,
                indications: plan.orthodonticProfile.indications,
                elastics: plan.orthodonticProfile.elastics,
                diagnosis: plan.orthodonticProfile.diagnosis as Prisma.InputJsonValue,
                planNotes: plan.orthodonticProfile.planNotes
              }
            : { treatmentPlanId: newPlan.id }
        });
      }

      for (const section of plan.sections) {
        const newSection = await tx.treatmentPlanSection.create({
          data: {
            treatmentPlanId: newPlan.id,
            name: section.name,
            sortOrder: section.sortOrder
          }
        });

        const sectionItems = plan.items.filter((item) => item.sectionId === section.id);
        for (const item of sectionItems) {
          if (item.status === "COMPLETED") continue; // only refer pending work

          await tx.treatmentPlanItem.create({
            data: {
              treatmentPlanId: newPlan.id,
              sectionId: newSection.id,
              procedureId: item.procedureId,
              toothNumber: item.toothNumber,
              surface: item.surface,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
              originalPrice: item.originalPrice,
              allowsDiscountSnapshot: item.allowsDiscountSnapshot,
              maximumDiscountPercentSnapshot: item.maximumDiscountPercentSnapshot,
              discountType: item.discountType,
              discountValue: item.discountValue,
              discountAmount: item.discountAmount,
              finalPrice: item.finalPrice,
              discountReason: item.discountReason,
              discountAuthorizedBy: item.discountAuthorizedBy,
              discountedAt: item.discountedAt,
              appliedDiscountPercent: item.appliedDiscountPercent,
              userMaximumDiscountSnapshot: item.userMaximumDiscountSnapshot,
              effectiveMaximumDiscountSnapshot: item.effectiveMaximumDiscountSnapshot,
              priceListId: item.priceListId,
              priceListItemId: item.priceListItemId,
              priceListVersionId: item.priceListVersionId,
              priceListVersionNumber: item.priceListVersionNumber,
              priceListVersionItemId: item.priceListVersionItemId,
              priceSource: item.priceSource,
              priceSnapshotName: item.priceSnapshotName,
              priceSnapshotCode: item.priceSnapshotCode,
              priceSnapshotCategory: item.priceSnapshotCategory,
              procedureCodeSnapshot: item.procedureCodeSnapshot,
              procedureNameSnapshot: item.procedureNameSnapshot,
              procedureCategorySnapshot: item.procedureCategorySnapshot,
              priceListNameSnapshot: item.priceListNameSnapshot,
              priceResolvedAt: item.priceResolvedAt,
              priceCurrency: item.priceCurrency,
              laboratoryCostSnapshot: item.laboratoryCostSnapshot,
              internalCostSnapshot: item.internalCostSnapshot,
              pricingRuleSnapshot: item.pricingRuleSnapshot ?? undefined,
              pricedById: item.pricedById,
              agreementId: item.agreementId,
              agreementVersionId: item.agreementVersionId,
              agreementVersionNumber: item.agreementVersionNumber,
              agreementSnapshot: item.agreementSnapshot ?? undefined,
              agreementNormalPrice: item.agreementNormalPrice,
              agreementAppliedPrice: item.agreementAppliedPrice,
              agreementDiscountAmount: item.agreementDiscountAmount,
              agreementCoverage: item.agreementCoverage,
              notes: item.notes,
              status: TreatmentPlanItemStatus.PLANNED
            }
          });
        }
      }

      // Mark original plan as CANCELLED (referred) if we don't want them doing work on it
      await tx.treatmentPlan.update({
        where: { id },
        data: { status: "CANCELLED" }
      });

      return referral;
    });
  }

  async pauseTreatment(actor: AuthUser, id: string, dto: { reason?: string }) {
    const plan = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "pause");

    // Check if already paused
    const activePause = await this.prisma.treatmentPlanPause.findFirst({
      where: { treatmentPlanId: plan.id, endDate: null }
    });

    if (activePause) {
      throw new BadRequestException("Treatment is already paused");
    }

    return this.prisma.treatmentPlanPause.create({
      data: {
        treatmentPlanId: plan.id,
        startDate: new Date(),
        reason: dto.reason,
        createdById: actor.id
      }
    });
  }

  async resumeTreatment(actor: AuthUser, id: string) {
    const plan = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "resume");

    // Find active pause
    const activePause = await this.prisma.treatmentPlanPause.findFirst({
      where: { treatmentPlanId: plan.id, endDate: null }
    });

    if (!activePause) {
      throw new BadRequestException("Treatment is not currently paused");
    }

    return this.prisma.treatmentPlanPause.update({
      where: { id: activePause.id },
      data: { endDate: new Date() }
    });
  }
}
