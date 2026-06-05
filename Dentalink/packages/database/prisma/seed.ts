import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { APPOINTMENT_REASON_SEEDS_BY_SPECIALTY } from "./appointment-reasons";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const permissionDefinitions = [
  ["system.manage_all", "Manage all", "Global administration", "system"],
  ["dashboard.read", "Read dashboard", "View dashboard", "dashboard"],
  ["users.read", "Read users", "View users", "users"],
  ["users.create", "Create users", "Create users", "users"],
  ["users.update", "Update users", "Update users", "users"],
  ["users.deactivate", "Deactivate users", "Deactivate users", "users"],
  ["roles.read", "Read roles", "View roles", "roles"],
  ["roles.create", "Create roles", "Create roles", "roles"],
  ["roles.update", "Update roles", "Update roles", "roles"],
  ["roles.deactivate", "Deactivate roles", "Deactivate roles", "roles"],
  ["permissions.read", "Read permissions", "View permissions", "permissions"],
  ["permissions.create", "Create permissions", "Create permissions", "permissions"],
  ["permissions.update", "Update permissions", "Update permissions", "permissions"],
  ["permissions.deactivate", "Deactivate permissions", "Deactivate permissions", "permissions"],
  ["branches.read", "Read branches", "View branches", "branches"],
  ["branches.create", "Create branches", "Create branches", "branches"],
  ["branches.update", "Update branches", "Update branches", "branches"],
  ["branches.deactivate", "Deactivate branches", "Deactivate branches", "branches"],
  ["settings.read", "Read settings", "View settings", "settings"],
  ["settings.update", "Update settings", "Update settings", "settings"],
  ["specialties.read", "Read specialties", "View specialties", "specialties"],
  ["specialties.create", "Create specialties", "Create specialties", "specialties"],
  ["specialties.update", "Update specialties", "Update specialties", "specialties"],
  ["specialties.deactivate", "Deactivate specialties", "Deactivate specialties", "specialties"],
  ["professionals.read", "Read professionals", "View professionals", "professionals"],
  ["professionals.create", "Create professionals", "Create professionals", "professionals"],
  ["professionals.update", "Update professionals", "Update professionals", "professionals"],
  ["professionals.deactivate", "Deactivate professionals", "Deactivate professionals", "professionals"],
  ["schedules.read", "Read schedules", "View schedules", "schedules"],
  ["schedules.create", "Create schedules", "Create schedules", "schedules"],
  ["schedules.update", "Update schedules", "Update schedules", "schedules"],
  ["schedules.deactivate", "Deactivate schedules", "Deactivate schedules", "schedules"],
  ["chairs.read", "Read chairs", "View chairs", "chairs"],
  ["chairs.create", "Create chairs", "Create chairs", "chairs"],
  ["chairs.update", "Update chairs", "Update chairs", "chairs"],
  ["chairs.deactivate", "Deactivate chairs", "Deactivate chairs", "chairs"],
  ["payment_methods.read", "Read payment methods", "View payment methods", "payment_methods"],
  ["payment_methods.create", "Create payment methods", "Create payment methods", "payment_methods"],
  ["payment_methods.update", "Update payment methods", "Update payment methods", "payment_methods"],
  [
    "payment_methods.deactivate",
    "Deactivate payment methods",
    "Deactivate payment methods",
    "payment_methods"
  ],
  [
    "procedure_categories.read",
    "Read procedure categories",
    "View procedure categories",
    "procedure_categories"
  ],
  [
    "procedure_categories.create",
    "Create procedure categories",
    "Create procedure categories",
    "procedure_categories"
  ],
  [
    "procedure_categories.update",
    "Update procedure categories",
    "Update procedure categories",
    "procedure_categories"
  ],
  [
    "procedure_categories.deactivate",
    "Deactivate procedure categories",
    "Deactivate procedure categories",
    "procedure_categories"
  ],
  ["procedures.read", "Read procedures", "View procedures", "procedures"],
  ["procedures.create", "Create procedures", "Create procedures", "procedures"],
  ["procedures.update", "Update procedures", "Update procedures", "procedures"],
  ["procedures.deactivate", "Deactivate procedures", "Deactivate procedures", "procedures"],
  ["price_lists.read", "Read price lists", "View price lists", "price_lists"],
  ["price_lists.create", "Create price lists", "Create price lists", "price_lists"],
  ["price_lists.update", "Update price lists", "Update price lists", "price_lists"],
  ["price_lists.deactivate", "Deactivate price lists", "Deactivate price lists", "price_lists"],
  ["patients.read", "Read patients", "View patients", "patients"],
  ["patients.create", "Create patients", "Create patients", "patients"],
  ["patients.update", "Update patients", "Update patients", "patients"],
  ["patients.deactivate", "Deactivate patients", "Deactivate patients", "patients"],
  ["patients.notes.create", "Create patient notes", "Create patient notes", "patients"],
  ["patients.alerts.create", "Create patient alerts", "Create patient alerts", "patients"],
  ["appointments.read", "Read appointments", "View appointments", "appointments"],
  ["appointments.create", "Create appointments", "Create appointments", "appointments"],
  ["appointments.update", "Update appointments", "Update appointments", "appointments"],
  ["appointments.cancel", "Cancel appointments", "Cancel appointments", "appointments"],
  ["appointments.status.update", "Update appointment status", "Update appointment status", "appointments"],
  ["appointments.overbook", "Overbook appointments", "Allow appointment overbooking", "appointments"],
  ["appointments.block", "Block appointment slots", "Block appointment slots", "appointments"],
  ["clinical.read", "Read clinical record", "View clinical record", "clinical"],
  ["clinical.history.update", "Update medical history", "Update medical history", "clinical"],
  ["clinical.evolutions.create", "Create clinical evolutions", "Create clinical evolutions", "clinical"],
  ["clinical.evolutions.sign", "Sign clinical evolutions", "Sign clinical evolutions", "clinical"],
  ["clinical.prescriptions.create", "Create prescriptions", "Create prescriptions", "clinical"],
  ["clinical.documents.create", "Create clinical documents", "Create clinical documents", "clinical"],
  [
    "clinical.templates.manage",
    "Manage clinical templates",
    "Manage clinical document templates",
    "clinical"
  ],
  ["clinical.odontogram.read", "Read odontogram", "View odontogram and tooth history", "clinical"],
  ["clinical.odontogram.write", "Write odontogram", "Create and update odontogram records", "clinical"],
  [
    "clinical.periodontogram.read",
    "Read periodontogram",
    "View periodontal charts and comparisons",
    "clinical"
  ],
  ["clinical.periodontogram.write", "Write periodontogram", "Create periodontal charts", "clinical"],
  ["treatment_plans.read", "Read treatment plans", "View treatment plans", "treatment_plans"],
  ["treatment_plans.create", "Create treatment plans", "Create treatment plans", "treatment_plans"],
  ["treatment_plans.update", "Update treatment plans", "Update treatment plans", "treatment_plans"],
  [
    "treatment_plans.status.update",
    "Update treatment plan item status",
    "Update treatment plan item status",
    "treatment_plans"
  ],
  [
    "treatment_plans.alternatives.manage",
    "Manage treatment plan alternatives",
    "Manage treatment plan alternatives",
    "treatment_plans"
  ],
  ["budgets.read", "Read budgets", "View budgets", "budgets"],
  ["budgets.create", "Create budgets", "Generate budgets", "budgets"],
  ["budgets.update", "Update budgets", "Update budgets", "budgets"],
  ["budgets.send", "Send budgets", "Send budgets to patients", "budgets"],
  ["budgets.accept", "Accept budgets", "Accept budget and treatment plan", "budgets"],
  ["budgets.reject", "Reject budgets", "Reject budget", "budgets"],
  ["budgets.print", "Print budgets", "Print budget document", "budgets"],
  ["payments.read", "Read payments", "View payments and collections", "payments"],
  ["payments.create", "Create payments", "Register patient payments", "payments"],
  ["payments.allocate", "Allocate payments", "Allocate payments to treatment items", "payments"],
  ["payments.refund", "Refund payments", "Register payment refunds", "payments"],
  [
    "payments.override.closed_cash",
    "Override closed cash register",
    "Allow receiving payments without open cash register",
    "payments"
  ],
  ["payment_links.create", "Create payment links", "Create simulated online payment links", "payments"],
  ["installments.read", "Read installments", "View installment plans and installments", "installments"],
  ["installments.create", "Create installments", "Create installment plans", "installments"],
  ["installments.pay", "Pay installments", "Register installment payments", "installments"],
  ["cash_register.read", "Read cash register", "View cash register shifts and balances", "cash_register"],
  ["cash_register.open", "Open cash register", "Open cash register shift", "cash_register"],
  ["cash_register.close", "Close cash register", "Close cash register shift", "cash_register"],
  [
    "cash_register.close_any",
    "Close any cash register",
    "Close another user's cash register",
    "cash_register"
  ],
  ["cash_register.move", "Create cash movement", "Register manual cash movements", "cash_register"],
  [
    "accounts_receivable.read",
    "Read accounts receivable",
    "View outstanding balances and overdue installments",
    "accounts_receivable"
  ],
  ["collections.read", "Read collections", "View collection cases", "collections"],
  ["collections.create", "Create collections", "Create collection cases", "collections"],
  ["collections.detect", "Detect collections", "Detect overdue installments and create cases", "collections"],
  ["collections.update", "Update collections", "Update case status and assignment", "collections"],
  [
    "collections.activities.create",
    "Create collection activities",
    "Register collection calls/messages",
    "collections"
  ],
  ["files.read", "Read files", "View patient files and attachments", "documents"],
  ["files.upload", "Upload files", "Upload patient files and attachments", "documents"],
  ["consent_templates.read", "Read consent templates", "View consent templates", "documents"],
  ["consent_templates.create", "Create consent templates", "Create consent templates", "documents"],
  ["consent_templates.update", "Update consent templates", "Update consent templates", "documents"],
  [
    "consent_templates.deactivate",
    "Deactivate consent templates",
    "Deactivate consent templates",
    "documents"
  ],
  ["consents.read", "Read consents", "View generated consents", "documents"],
  ["consents.create", "Create consents", "Generate consents for patients", "documents"],
  ["consents.sign", "Sign consents", "Sign and lock consents", "documents"],
  ["consents.pdf", "Download consent PDF", "Download signed consent snapshot", "documents"],
  ["reports.read", "Read reports", "View dashboards and reports", "reports"],
  ["reports.export", "Export reports", "Export reports in CSV/XLSX", "reports"],
  ["lab_providers.read", "Read lab providers", "View laboratory providers", "labs"],
  ["lab_providers.create", "Create lab providers", "Create laboratory providers", "labs"],
  ["lab_providers.update", "Update lab providers", "Update laboratory providers", "labs"],
  ["lab_providers.deactivate", "Deactivate lab providers", "Deactivate laboratory providers", "labs"],
  ["lab_orders.read", "Read lab orders", "View laboratory orders", "labs"],
  ["lab_orders.create", "Create lab orders", "Create laboratory orders", "labs"],
  ["lab_orders.update", "Update lab orders", "Update laboratory order status", "labs"],
  ["lab_orders.cost.update", "Update lab order cost", "Update laboratory order costs", "labs"],
  ["lab_profitability.read", "Read lab profitability", "View treatment profitability with lab costs", "labs"],
  ["suppliers.read", "Read suppliers", "View suppliers", "inventory"],
  ["suppliers.create", "Create suppliers", "Create suppliers", "inventory"],
  ["suppliers.update", "Update suppliers", "Update suppliers", "inventory"],
  ["suppliers.deactivate", "Deactivate suppliers", "Deactivate suppliers", "inventory"],
  ["inventory.read", "Read inventory", "View inventory items", "inventory"],
  ["inventory.create", "Create inventory items", "Create inventory items", "inventory"],
  ["inventory.update", "Update inventory items", "Update inventory items", "inventory"],
  ["inventory.deactivate", "Deactivate inventory items", "Deactivate inventory items", "inventory"],
  ["inventory.movements.read", "Read inventory movements", "View inventory movements", "inventory"],
  ["inventory.movements.create", "Create inventory movements", "Create inventory movements", "inventory"],
  ["inventory.alerts.read", "Read inventory alerts", "View minimum stock alerts", "inventory"]
] as const;

const roleDefinitions = [
  {
    name: "SUPER_ADMIN",
    description: "Full platform access",
    permissionKeys: permissionDefinitions.map(([key]) => key)
  },
  {
    name: "ADMIN",
    description: "Administrative access",
    permissionKeys: permissionDefinitions.map(([key]) => key).filter((key) => key !== "system.manage_all")
  },
  {
    name: "RECEPTIONIST",
    description: "Reception operations",
    permissionKeys: [
      "dashboard.read",
      "users.read",
      "branches.read",
      "professionals.read",
      "schedules.read",
      "patients.read",
      "patients.create",
      "patients.update",
      "patients.notes.create",
      "patients.alerts.create",
      "appointments.read",
      "appointments.create",
      "appointments.update",
      "appointments.cancel",
      "appointments.status.update",
      "appointments.block",
      "clinical.read",
      "clinical.history.update",
      "clinical.evolutions.create",
      "clinical.prescriptions.create",
      "clinical.documents.create",
      "clinical.odontogram.read",
      "clinical.periodontogram.read",
      "treatment_plans.read",
      "treatment_plans.create",
      "treatment_plans.update",
      "budgets.read",
      "budgets.create",
      "budgets.send",
      "budgets.print",
      "payments.read",
      "payments.create",
      "payments.allocate",
      "payment_links.create",
      "installments.read",
      "accounts_receivable.read",
      "collections.read",
      "collections.create",
      "collections.detect",
      "collections.activities.create",
      "files.read",
      "files.upload",
      "consent_templates.read",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "lab_providers.read",
      "lab_orders.read",
      "lab_orders.create",
      "inventory.read",
      "inventory.movements.read"
    ]
  },
  {
    name: "DENTIST",
    description: "Clinical professional access",
    permissionKeys: [
      "dashboard.read",
      "procedures.read",
      "price_lists.read",
      "patients.read",
      "patients.notes.create",
      "patients.alerts.create",
      "appointments.read",
      "appointments.status.update",
      "clinical.read",
      "clinical.history.update",
      "clinical.evolutions.create",
      "clinical.evolutions.sign",
      "clinical.prescriptions.create",
      "clinical.documents.create",
      "clinical.odontogram.read",
      "clinical.odontogram.write",
      "clinical.periodontogram.read",
      "clinical.periodontogram.write",
      "treatment_plans.read",
      "treatment_plans.create",
      "treatment_plans.update",
      "treatment_plans.status.update",
      "treatment_plans.alternatives.manage",
      "budgets.read",
      "budgets.create",
      "budgets.update",
      "budgets.send",
      "budgets.accept",
      "budgets.reject",
      "budgets.print",
      "payments.read",
      "payments.allocate",
      "accounts_receivable.read",
      "installments.read",
      "files.read",
      "files.upload",
      "consent_templates.read",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "lab_providers.read",
      "lab_orders.read",
      "lab_orders.create",
      "lab_orders.update",
      "lab_orders.cost.update",
      "lab_profitability.read",
      "inventory.read",
      "inventory.movements.read",
      "inventory.alerts.read"
    ]
  },
  {
    name: "CASHIER",
    description: "Cash operations",
    permissionKeys: [
      "dashboard.read",
      "payment_methods.read",
      "price_lists.read",
      "patients.read",
      "appointments.read",
      "payments.read",
      "payments.create",
      "payments.allocate",
      "payments.refund",
      "payment_links.create",
      "installments.read",
      "installments.create",
      "installments.pay",
      "cash_register.read",
      "cash_register.open",
      "cash_register.close",
      "cash_register.move",
      "accounts_receivable.read",
      "collections.read",
      "collections.create",
      "collections.detect",
      "collections.update",
      "collections.activities.create",
      "files.read",
      "files.upload",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "inventory.read",
      "inventory.movements.read",
      "inventory.movements.create",
      "inventory.alerts.read"
    ]
  },
  {
    name: "CEYE",
    description: "Sterilization and clinical supply control",
    permissionKeys: [
      "dashboard.read",
      "branches.read",
      "patients.read",
      "appointments.read",
      "clinical.read",
      "professionals.read",
      "schedules.read",
      "chairs.read",
      "lab_providers.read",
      "lab_orders.read",
      "lab_orders.update",
      "suppliers.read",
      "inventory.read",
      "inventory.update",
      "inventory.movements.read",
      "inventory.movements.create",
      "inventory.alerts.read",
      "reports.read"
    ]
  },
  {
    name: "MANAGER",
    description: "Branch management",
    permissionKeys: [
      "dashboard.read",
      "users.read",
      "roles.read",
      "branches.read",
      "settings.read",
      "specialties.read",
      "professionals.read",
      "schedules.read",
      "chairs.read",
      "payment_methods.read",
      "procedure_categories.read",
      "procedures.read",
      "price_lists.read",
      "patients.read",
      "patients.create",
      "patients.update",
      "patients.deactivate",
      "patients.notes.create",
      "patients.alerts.create",
      "appointments.read",
      "appointments.create",
      "appointments.update",
      "appointments.cancel",
      "appointments.status.update",
      "appointments.overbook",
      "appointments.block",
      "clinical.read",
      "clinical.history.update",
      "clinical.evolutions.create",
      "clinical.evolutions.sign",
      "clinical.prescriptions.create",
      "clinical.documents.create",
      "clinical.templates.manage",
      "clinical.odontogram.read",
      "clinical.odontogram.write",
      "clinical.periodontogram.read",
      "clinical.periodontogram.write",
      "treatment_plans.read",
      "treatment_plans.create",
      "treatment_plans.update",
      "treatment_plans.status.update",
      "treatment_plans.alternatives.manage",
      "budgets.read",
      "budgets.create",
      "budgets.update",
      "budgets.send",
      "budgets.accept",
      "budgets.reject",
      "budgets.print",
      "payments.read",
      "payments.create",
      "payments.allocate",
      "payments.refund",
      "payment_links.create",
      "installments.read",
      "installments.create",
      "installments.pay",
      "cash_register.read",
      "cash_register.open",
      "cash_register.close",
      "cash_register.move",
      "accounts_receivable.read",
      "collections.read",
      "collections.create",
      "collections.detect",
      "collections.update",
      "collections.activities.create",
      "files.read",
      "files.upload",
      "consent_templates.read",
      "consent_templates.create",
      "consent_templates.update",
      "consent_templates.deactivate",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "reports.export",
      "lab_providers.read",
      "lab_providers.create",
      "lab_providers.update",
      "lab_providers.deactivate",
      "lab_orders.read",
      "lab_orders.create",
      "lab_orders.update",
      "lab_orders.cost.update",
      "lab_profitability.read",
      "suppliers.read",
      "suppliers.create",
      "suppliers.update",
      "suppliers.deactivate",
      "inventory.read",
      "inventory.create",
      "inventory.update",
      "inventory.deactivate",
      "inventory.movements.read",
      "inventory.movements.create",
      "inventory.alerts.read"
    ]
  }
] as const;

const predefinedBranches = [
  {
    code: "TUXTLA",
    name: "Dental + Suc. Tuxtla",
    phone: "+52 961 000 1012",
    email: "tuxtla@warnersuite.local",
    address: "Blvd. Belisario Dominguez 1024",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "TAPACHULA",
    name: "Dental + Suc. Tapachula",
    phone: "+52 962 000 1001",
    email: "tapachula@warnersuite.local",
    address: "Av. Central 245, Col. Centro",
    city: "Tapachula",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "ATLIXCO",
    name: "Dental + Suc. Atlixco",
    phone: "+52 244 000 1002",
    email: "atlixco@warnersuite.local",
    address: "Blvd. Atlixco 112, Col. Centro",
    city: "Atlixco",
    state: "Puebla",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "CAMPECHE",
    name: "Dental + Suc. Campeche",
    phone: "+52 981 000 1003",
    email: "campeche@warnersuite.local",
    address: "Calle 59 187, Zona Centro",
    city: "Campeche",
    state: "Campeche",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "COMITAN",
    name: "Dental + Suc. Comitán",
    phone: "+52 963 000 1004",
    email: "comitan@warnersuite.local",
    address: "Av. Primera Sur 508, Centro",
    city: "Comitán",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "CORDOBA_VER",
    name: "Dental + Suc. Córdoba Veracruz",
    phone: "+52 271 000 1005",
    email: "cordoba@warnersuite.local",
    address: "Av. 3 915, Centro",
    city: "Córdoba",
    state: "Veracruz",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "GUADALAJARA",
    name: "Dental + Suc. Guadalajara",
    phone: "+52 33 0000 1006",
    email: "guadalajara@warnersuite.local",
    address: "Av. Chapultepec 395, Americana",
    city: "Guadalajara",
    state: "Jalisco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "MERIDA",
    name: "Dental + Suc. Mérida",
    phone: "+52 999 000 1007",
    email: "merida@warnersuite.local",
    address: "Paseo de Montejo 278, Centro",
    city: "Mérida",
    state: "Yucatán",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "PACHUCA",
    name: "Dental + Suc. Pachuca",
    phone: "+52 771 000 1008",
    email: "pachuca@warnersuite.local",
    address: "Blvd. Felipe Angeles 401, Centro",
    city: "Pachuca",
    state: "Hidalgo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "SAN_CRISTOBAL",
    name: "Dental + Suc. San Cristóbal",
    phone: "+52 967 000 1009",
    email: "sancristobal@warnersuite.local",
    address: "Real de Guadalupe 142, Centro",
    city: "San Cristóbal de las Casas",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "TONALA",
    name: "Dental + Suc. Tonalá",
    phone: "+52 33 0000 1010",
    email: "tonala@warnersuite.local",
    address: "Av. Tonaltecas 510, Centro",
    city: "Tonalá",
    state: "Jalisco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "TUXPAN",
    name: "Dental + Suc. Tuxpan",
    phone: "+52 783 000 1011",
    email: "tuxpan@warnersuite.local",
    address: "Av. Juarez 620, Centro",
    city: "Tuxpan",
    state: "Veracruz",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "VILLAHERMOSA",
    name: "Dental + Suc. Villahermosa",
    phone: "+52 993 000 1013",
    email: "villahermosa@warnersuite.local",
    address: "Av. Universidad 336, Atasta",
    city: "Villahermosa",
    state: "Tabasco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "XALAPA",
    name: "Dental + Suc. Xalapa",
    phone: "+52 228 000 1014",
    email: "xalapa@warnersuite.local",
    address: "Av. Lazaro Cardenas 891, Centro",
    city: "Xalapa",
    state: "Veracruz",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "DXRAY_TUXTLA",
    name: "Dx-Ray Tuxtla",
    phone: "+52 961 000 1015",
    email: "dxray-tuxtla@warnersuite.local",
    address: "Periferico Sur 120, Tuxtla",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DX_RAY",
    zoneCode: "SUR"
  },
  {
    code: "AGUASCALIENTES",
    name: "Dental + Suc. Aguascalientes",
    phone: "+52 000 000 1016",
    email: "aguascalientes@warnersuite.local",
    address: "Sucursal Aguascalientes",
    city: "Aguascalientes",
    state: "Aguascalientes",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "CANCUN",
    name: "Dental + Suc. Cancún",
    phone: "+52 000 000 1017",
    email: "cancun@warnersuite.local",
    address: "Sucursal Cancún",
    city: "Cancún",
    state: "Quintana Roo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "CONDESA",
    name: "Dental + Suc. Condesa",
    phone: "+52 000 000 1018",
    email: "condesa@warnersuite.local",
    address: "Sucursal Condesa",
    city: "Ciudad de México",
    state: "Ciudad de México",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "DURANGO",
    name: "Dental + Suc. Durango",
    phone: "+52 000 000 1019",
    email: "durango@warnersuite.local",
    address: "Sucursal Durango",
    city: "Durango",
    state: "Durango",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "LEON",
    name: "Dental + Suc. León",
    phone: "+52 000 000 1020",
    email: "leon@warnersuite.local",
    address: "Sucursal León",
    city: "León",
    state: "Guanajuato",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "LEON_VALLE",
    name: "Dental + Suc. León Valle",
    phone: "+52 000 000 1021",
    email: "leon-valle@warnersuite.local",
    address: "Sucursal León Valle",
    city: "León",
    state: "Guanajuato",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "MEXICALI",
    name: "Dental + Suc. Mexicali",
    phone: "+52 000 000 1022",
    email: "mexicali@warnersuite.local",
    address: "Sucursal Mexicali",
    city: "Mexicali",
    state: "Baja California",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "PLAYA_DEL_CARMEN",
    name: "Dental + Suc. Playa Del Carmen",
    phone: "+52 000 000 1023",
    email: "playa-del-carmen@warnersuite.local",
    address: "Sucursal Playa Del Carmen",
    city: "Playa Del Carmen",
    state: "Quintana Roo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "PUERTO_VALLARTA",
    name: "Dental + Suc. Puerto Vallarta",
    phone: "+52 000 000 1024",
    email: "puerto-vallarta@warnersuite.local",
    address: "Sucursal Puerto Vallarta",
    city: "Puerto Vallarta",
    state: "Jalisco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "SAN_LUIS_POTOSI",
    name: "Dental + Suc. San Luis Potosí",
    phone: "+52 000 000 1025",
    email: "san-luis-potosi@warnersuite.local",
    address: "Sucursal San Luis Potosí",
    city: "San Luis Potosí",
    state: "San Luis Potosí",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "SAN_LUIS_RIO",
    name: "Dental + Suc. San Luis Río",
    phone: "+52 000 000 1026",
    email: "san-luis-rio@warnersuite.local",
    address: "Sucursal San Luis Río",
    city: "San Luis Río",
    state: "Sonora",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "JWARNER_9NA_SUR",
    name: "Dental J.Warner 9na Sur",
    phone: "+52 000 000 1027",
    email: "jwarner-9na-sur@warnersuite.local",
    address: "9na Sur",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "REAL_DEL_BOSQUE",
    name: "Dental + Real Del Bosque",
    phone: "+52 000 000 1028",
    email: "real-del-bosque@warnersuite.local",
    address: "Real Del Bosque",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "LAURELES",
    name: "Dental + Suc Laureles",
    phone: "+52 000 000 1029",
    email: "laureles@warnersuite.local",
    address: "Sucursal Laureles",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "VILLAFLORES",
    name: "Dental + Suc. Villaflores",
    phone: "+52 000 000 1030",
    email: "villaflores@warnersuite.local",
    address: "Sucursal Villaflores",
    city: "Villaflores",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "JWARNER_ESPECIALIDADES_TUXTLA",
    name: "Dental J.Warner Especialidades Tuxtla",
    phone: "+52 000 000 1031",
    email: "jwarner-especialidades-tuxtla@warnersuite.local",
    address: "Especialidades Tuxtla",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "JWARNER_PAULINO_NAVARRO",
    name: "Dental J.Warner Paulino Navarro",
    phone: "+52 000 000 1032",
    email: "jwarner-paulino-navarro@warnersuite.local",
    address: "Paulino Navarro",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "JWARNER_VILLAHERMOSA",
    name: "Dental J.Warner Villahermosa",
    phone: "+52 000 000 1033",
    email: "jwarner-villahermosa@warnersuite.local",
    address: "Sucursal Villahermosa",
    city: "Villahermosa",
    state: "Tabasco",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "PACHUCA_SELECT",
    name: "Dental+ Pachuca Select",
    phone: "+52 000 000 1034",
    email: "pachuca-select@warnersuite.local",
    address: "Pachuca Select",
    city: "Pachuca",
    state: "Hidalgo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  }
] as const;

const predefinedBranchBrands = [
  { code: "DENTAL_PLUS", name: "Dental+" },
  { code: "DX_RAY", name: "Dx-Ray" },
  { code: "DENTAL_JWARNER", name: "Dental J.Warner" }
] as const;

const predefinedBranchZones = [
  { code: "NORTE", name: "Norte" },
  { code: "SUR", name: "Sur" }
] as const;

const baseArancelCategories = [
  "APARATOLOGIA 2026",
  "CIRUGIA 2026",
  "ENDODONCIA 2026",
  "ESTETICO 2026",
  "ESTUDIOS DENTALES 2026",
  "EXODONCIA 2026",
  "ODONTOPEDIATRIA 2026",
  "OPERATORIA 2026",
  "ORTODONCIA 2026",
  "PERIODONCIA 2026",
  "POLIZA DENTAL 2026",
  "PREVENTIVO BASICO 2026",
  "PRODUCTOR GUM 2026",
  "PROMOCION INTERNA 2026",
  "PROTESIS FIJA 20266",
  "PROTESIS REMOVIBLE 20266",
  "REDES SOCIALES 2026"
] as const;

const polizaDentalCategories = [
  "APARATOLOGIA 2026",
  "CIRUGIA 2026",
  "ENDODONCIA 2026",
  "ESTETICO 2026",
  "ESTUDIOS DENTALES 2026",
  "EXODONCIA 2026",
  "ODONTOPEDIATRIA 2026",
  "OPERATORIA",
  "ORTODONCIA 2026",
  "PERIODONCIA2026",
  "POLIZA DENTAL 2026",
  "PREVENTIVO BASICO 2026",
  "PRODUCTOS GUM 2026",
  "PROMOCIONES INTERNAS 2026",
  "PROTESIS FIJA 20266",
  "PROTESIS REMOVIBLE 20266",
  "REDES SOCIALES 2026"
] as const;

const seededPriceLists = [
  {
    name: "ARANCEL BASE SUR 2026",
    description: "Arancel base para sucursales zona Sur 2026",
    zoneCode: "SUR",
    type: "BASE",
    isDefault: true,
    categories: baseArancelCategories
  },
  {
    name: "POLIZA DENTAL SUR 2026",
    description: "Poliza dental para sucursales zona Sur 2026",
    zoneCode: "SUR",
    type: "POLIZA",
    isDefault: false,
    categories: polizaDentalCategories
  },
  {
    name: "ARANCEL BASE NORTE 2026",
    description: "Arancel base para sucursales zona Norte 2026",
    zoneCode: "NORTE",
    type: "BASE",
    isDefault: false,
    categories: baseArancelCategories
  },
  {
    name: "POLIZA DENTAL NORTE 2026",
    description: "Poliza dental para sucursales zona Norte 2026",
    zoneCode: "NORTE",
    type: "POLIZA",
    isDefault: false,
    categories: polizaDentalCategories
  }
] as const;

const allowedSpecialtySeeds = [
  { name: "Odontología General (Integral)", aliases: ["Odontología General y Estética", "Odontología General"] },
  { name: "Ortodoncia", aliases: [] }
] as const;

function normalizeCode(name: string) {
  return name.toLowerCase();
}

function normalizeSpecialtyKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSeedAllowedSpecialtyName(value: string) {
  const normalized = normalizeSpecialtyKey(value);
  for (const specialty of allowedSpecialtySeeds) {
    if (normalizeSpecialtyKey(specialty.name) === normalized) return specialty.name;
    if (specialty.aliases.some((alias) => normalizeSpecialtyKey(alias) === normalized)) return specialty.name;
  }
  if (normalized === "general" || normalized === "integral" || normalized === "general integral") {
    return allowedSpecialtySeeds[0].name;
  }
  return null;
}

async function seedSpecialtyAppointmentReasons(specialtyIdsByName: Map<string, string>) {
  for (const [specialtyName, reasons] of Object.entries(APPOINTMENT_REASON_SEEDS_BY_SPECIALTY)) {
    const specialtyId = specialtyIdsByName.get(specialtyName);
    if (!specialtyId) continue;

    for (const reason of reasons) {
      for (const legacyName of reason.legacyNames ?? []) {
        const existingReason = await (prisma as any).specialtyAppointmentReason.findUnique({
          where: {
            specialtyId_name: {
              specialtyId,
              name: legacyName
            }
          }
        });

        if (!existingReason) continue;

        const targetReason = await (prisma as any).specialtyAppointmentReason.findUnique({
          where: {
            specialtyId_name: {
              specialtyId,
              name: reason.name
            }
          }
        });

        if (targetReason) {
          await (prisma as any).specialtyAppointmentReason.update({
            where: { id: existingReason.id },
            data: { isActive: false }
          });
        } else {
          await (prisma as any).specialtyAppointmentReason.update({
            where: { id: existingReason.id },
            data: {
              name: reason.name,
              durationMinutes: reason.durationMinutes,
              color: reason.color,
              isActive: true
            }
          });
        }
      }

      await (prisma as any).specialtyAppointmentReason.upsert({
        where: {
          specialtyId_name: {
            specialtyId,
            name: reason.name
          }
        },
        update: {
          durationMinutes: reason.durationMinutes,
          color: reason.color,
          isActive: true
        },
        create: {
          specialtyId,
          name: reason.name,
          durationMinutes: reason.durationMinutes,
          color: reason.color,
          isActive: true
        }
      });
    }
  }
}

async function main() {
  const orgSlug = process.env.SEED_ORGANIZATION_SLUG ?? "dentalwarner";

  const organization = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {
      name: process.env.SEED_ORGANIZATION_NAME ?? "Dentalwarner Corporate",
      isActive: true,
      status: "ACTIVE"
    },
    create: {
      name: process.env.SEED_ORGANIZATION_NAME ?? "Dentalwarner Corporate",
      legalName: process.env.SEED_ORGANIZATION_NAME ?? "Dentalwarner Corporate",
      slug: orgSlug,
      isActive: true,
      status: "ACTIVE"
    }
  });

  const branchCatalog = new Map(predefinedBranches.map((branch) => [branch.code, branch]));
  const requestedDefaultBranchCode = process.env.SEED_DEFAULT_BRANCH_CODE ?? "TUXTLA";
  const defaultBranchCode = branchCatalog.has(requestedDefaultBranchCode) ? requestedDefaultBranchCode : "TUXTLA";
  const defaultBranchName = process.env.SEED_DEFAULT_BRANCH_NAME ?? "Dental + Suc. Tuxtla";
  if (!branchCatalog.has(defaultBranchCode)) {
    branchCatalog.set(defaultBranchCode, {
      code: defaultBranchCode,
      name: defaultBranchName,
      phone: "+52 000 000 0000",
      email: `${defaultBranchCode.toLowerCase()}@warnersuite.local`,
      address: "Direccion principal",
      city: "Ciudad",
      state: "Estado"
    });
  }

  const activeBranchCodes = [...branchCatalog.keys()];
  await prisma.userBranch.deleteMany({
    where: {
      branch: {
        organizationId: organization.id,
        code: { notIn: activeBranchCodes }
      }
    }
  });
  await prisma.branch.updateMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      code: { notIn: activeBranchCodes }
    },
    data: {
      status: "INACTIVE",
      isActive: false,
      deletedAt: new Date()
    }
  });

  const branchBrands = new Map<string, string>();
  for (const brandSeed of predefinedBranchBrands) {
    const brand = await prisma.branchBrand.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: brandSeed.code
        }
      },
      update: {
        name: brandSeed.name,
        isActive: true
      },
      create: {
        organizationId: organization.id,
        code: brandSeed.code,
        name: brandSeed.name
      }
    });
    branchBrands.set(brand.code, brand.id);
  }

  const branchZones = new Map<string, string>();
  for (const zoneSeed of predefinedBranchZones) {
    const zone = await prisma.branchZone.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: zoneSeed.code
        }
      },
      update: {
        name: zoneSeed.name,
        isActive: true
      },
      create: {
        organizationId: organization.id,
        code: zoneSeed.code,
        name: zoneSeed.name
      }
    });
    branchZones.set(zone.code, zone.id);
  }

  for (const branchSeed of branchCatalog.values()) {
    const brandId = "brandCode" in branchSeed ? branchBrands.get(branchSeed.brandCode) : undefined;
    const zoneCode = "zoneCode" in branchSeed ? branchSeed.zoneCode : "SUR";
    const zoneId = branchZones.get(zoneCode);

    await prisma.branch.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: branchSeed.code
        }
      },
      update: {
        brandId,
        zoneId,
        name: branchSeed.name,
        phone: branchSeed.phone,
        email: branchSeed.email,
        address: branchSeed.address,
        city: branchSeed.city,
        state: branchSeed.state,
        country: "MX",
        timezone: "America/Mexico_City",
        agendaStartHour: 10,
        agendaEndHour: 19,
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        brandId,
        zoneId,
        code: branchSeed.code,
        name: branchSeed.name,
        phone: branchSeed.phone,
        email: branchSeed.email,
        address: branchSeed.address,
        city: branchSeed.city,
        state: branchSeed.state,
        country: "MX",
        timezone: "America/Mexico_City",
        agendaStartHour: 10,
        agendaEndHour: 19,
        isActive: true,
        status: "ACTIVE"
      }
    });
  }

  for (const [key, name, description, module] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { key },
      update: {
        name,
        description,
        module,
        code: key,
        action: key.split(".")[1] ?? "read",
        resource: key.split(".")[0] ?? module,
        isActive: true,
        isSystem: true
      },
      create: {
        key,
        name,
        description,
        module,
        code: key,
        action: key.split(".")[1] ?? "read",
        resource: key.split(".")[0] ?? module,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const roleDefinition of roleDefinitions) {
    const roleCode = normalizeCode(roleDefinition.name);
    const existingRole = await prisma.role.findFirst({
      where: {
        organizationId: organization.id,
        OR: [{ name: roleDefinition.name }, { code: roleCode }]
      }
    });

    const role = existingRole
      ? await prisma.role.update({
          where: { id: existingRole.id },
          data: {
            name: roleDefinition.name,
            description: roleDefinition.description,
            isSystem: true,
            isActive: true,
            code: roleCode
          }
        })
      : await prisma.role.create({
          data: {
            organizationId: organization.id,
            name: roleDefinition.name,
            description: roleDefinition.description,
            isSystem: true,
            isActive: true,
            code: roleCode
          }
        });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...roleDefinition.permissionKeys] } },
      select: { id: true }
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true
    });
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "SUPER_ADMIN"
      }
    }
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@dentalwarner.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      organizationId: organization.id,
      firstName: "System",
      lastName: "Admin",
      passwordHash,
      roleId: superAdminRole.id,
      isActive: true,
      status: "ACTIVE"
    },
    create: {
      organizationId: organization.id,
      firstName: "System",
      lastName: "Admin",
      email: adminEmail,
      passwordHash,
      roleId: superAdminRole.id,
      isActive: true,
      status: "ACTIVE"
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id }
  });

  const branches = await prisma.branch.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      status: "ACTIVE"
    },
    select: { id: true, code: true }
  });

  for (const assignedBranch of branches) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: admin.id, branchId: assignedBranch.id } },
      update: { isPrimary: assignedBranch.code === defaultBranchCode },
      create: {
        userId: admin.id,
        branchId: assignedBranch.id,
        isPrimary: assignedBranch.code === defaultBranchCode
      }
    });
  }

  const existingSpecialties = await prisma.specialty.findMany({
    where: { organizationId: organization.id }
  });
  const allowedSpecialties: Array<{ id: string; name: string }> = [];
  for (const specialtySeed of allowedSpecialtySeeds) {
    const matchingSpecialties = existingSpecialties.filter(
      (specialty) => resolveSeedAllowedSpecialtyName(specialty.name) === specialtySeed.name
    );
    const existing = matchingSpecialties.find((specialty) => specialty.name === specialtySeed.name) ?? matchingSpecialties[0];
    const specialty = existing
      ? await prisma.specialty.update({
          where: { id: existing.id },
          data: { name: specialtySeed.name, isActive: true }
        })
      : await prisma.specialty.create({
          data: { organizationId: organization.id, name: specialtySeed.name, isActive: true }
        });
    allowedSpecialties.push(specialty);
  }

  await prisma.specialty.updateMany({
    where: {
      organizationId: organization.id,
      id: { notIn: allowedSpecialties.map((specialty) => specialty.id) }
    },
    data: { isActive: false }
  });

  await seedSpecialtyAppointmentReasons(new Map(allowedSpecialties.map((specialty) => [specialty.name, specialty.id])));

  await prisma.branchPriceList.deleteMany({ where: { organizationId: organization.id } });
  await prisma.priceListItem.deleteMany({ where: { priceList: { organizationId: organization.id } } });
  await prisma.priceListCategory.deleteMany({ where: { organizationId: organization.id } });
  await prisma.agreement.updateMany({
    where: { organizationId: organization.id, priceListId: { not: null } },
    data: { priceListId: null }
  });
  await prisma.priceList.deleteMany({ where: { organizationId: organization.id } });

  for (const priceListSeed of seededPriceLists) {
    const priceList = await prisma.priceList.create({
      data: {
        organizationId: organization.id,
        name: priceListSeed.name,
        description: priceListSeed.description,
        isDefault: priceListSeed.isDefault,
        isActive: true
      }
    });

    for (const [index, categoryName] of priceListSeed.categories.entries()) {
      const procedureCategory = await prisma.procedureCategory.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: categoryName
          }
        },
        update: {
          sortOrder: index + 1,
          isActive: true
        },
        create: {
          organizationId: organization.id,
          name: categoryName,
          sortOrder: index + 1,
          isActive: true
        }
      });

      await prisma.priceListCategory.create({
        data: {
          organizationId: organization.id,
          priceListId: priceList.id,
          procedureCategoryId: procedureCategory.id,
          name: categoryName,
          sortOrder: index + 1,
          isActive: true
        }
      });
    }

    const assignedBranches = await prisma.branch.findMany({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        status: "ACTIVE",
        zone: { code: priceListSeed.zoneCode }
      },
      select: { id: true }
    });

    if (assignedBranches.length) {
      await prisma.branchPriceList.createMany({
        data: assignedBranches.map((branch) => ({
          organizationId: organization.id,
          branchId: branch.id,
          priceListId: priceList.id,
          type: priceListSeed.type,
          isDefault: priceListSeed.type === "BASE",
          isActive: true
        }))
      });
    }
  }

  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "Usuario123!";
  const staffPasswordHash = await bcrypt.hash(staffPassword, 12);
  const defaultStaffBranch = branches.find((branch) => branch.code === defaultBranchCode) ?? branches[0];
  if (!defaultStaffBranch) {
    throw new Error("No active branch found for staff users");
  }

  const staffDefinitions = [
    {
      email: "recepcion.matriz@dentalwarner.local",
      firstName: "Recepcion",
      lastName: "Matriz",
      phone: "+520000000101",
      roleName: "RECEPTIONIST"
    },
    {
      email: "caja.matriz@dentalwarner.local",
      firstName: "Caja",
      lastName: "Matriz",
      phone: "+520000000102",
      roleName: "CASHIER"
    },
    {
      email: "ceye.matriz@dentalwarner.local",
      firstName: "CEYE",
      lastName: "Matriz",
      phone: "+520000000103",
      roleName: "CEYE"
    }
  ] as const;

  for (const staff of staffDefinitions) {
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: staff.roleName
        }
      }
    });

    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        organizationId: organization.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
        passwordHash: staffPasswordHash,
        roleId: role.id,
        permissionsOverride: false,
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        passwordHash: staffPasswordHash,
        roleId: role.id,
        permissionsOverride: false,
        isActive: true,
        status: "ACTIVE"
      }
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await prisma.userPermission.deleteMany({ where: { userId: user.id } });
    await prisma.userBranch.deleteMany({ where: { userId: user.id } });
    await prisma.userBranch.create({
      data: {
        userId: user.id,
        branchId: defaultStaffBranch.id,
        isPrimary: true
      }
    });
  }

  console.log(`Seed completed. Admin: ${adminEmail}. Staff password: ${staffPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
