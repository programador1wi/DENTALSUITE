import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

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
    code: "TAPACHULA",
    name: "Tapachula",
    phone: "+52 962 000 1001",
    email: "tapachula@warnersuite.local",
    address: "Av. Central 245, Col. Centro",
    city: "Tapachula",
    state: "Chiapas"
  },
  {
    code: "ATLIXCO",
    name: "Atlixco",
    phone: "+52 244 000 1002",
    email: "atlixco@warnersuite.local",
    address: "Blvd. Atlixco 112, Col. Centro",
    city: "Atlixco",
    state: "Puebla"
  },
  {
    code: "CAMPECHE",
    name: "Campeche",
    phone: "+52 981 000 1003",
    email: "campeche@warnersuite.local",
    address: "Calle 59 187, Zona Centro",
    city: "Campeche",
    state: "Campeche"
  },
  {
    code: "COMITAN",
    name: "Comitan",
    phone: "+52 963 000 1004",
    email: "comitan@warnersuite.local",
    address: "Av. Primera Sur 508, Centro",
    city: "Comitan",
    state: "Chiapas"
  },
  {
    code: "CORDOBA_VER",
    name: "Cordoba Veracruz",
    phone: "+52 271 000 1005",
    email: "cordoba@warnersuite.local",
    address: "Av. 3 915, Centro",
    city: "Cordoba",
    state: "Veracruz"
  },
  {
    code: "GUADALAJARA",
    name: "Guadalajara",
    phone: "+52 33 0000 1006",
    email: "guadalajara@warnersuite.local",
    address: "Av. Chapultepec 395, Americana",
    city: "Guadalajara",
    state: "Jalisco"
  },
  {
    code: "MERIDA",
    name: "Merida",
    phone: "+52 999 000 1007",
    email: "merida@warnersuite.local",
    address: "Paseo de Montejo 278, Centro",
    city: "Merida",
    state: "Yucatan"
  },
  {
    code: "PACHUCA",
    name: "Pachuca",
    phone: "+52 771 000 1008",
    email: "pachuca@warnersuite.local",
    address: "Blvd. Felipe Angeles 401, Centro",
    city: "Pachuca",
    state: "Hidalgo"
  },
  {
    code: "SAN_CRISTOBAL",
    name: "San Cristobal",
    phone: "+52 967 000 1009",
    email: "sancristobal@warnersuite.local",
    address: "Real de Guadalupe 142, Centro",
    city: "San Cristobal de las Casas",
    state: "Chiapas"
  },
  {
    code: "TONALA",
    name: "Tonala",
    phone: "+52 33 0000 1010",
    email: "tonala@warnersuite.local",
    address: "Av. Tonaltecas 510, Centro",
    city: "Tonala",
    state: "Jalisco"
  },
  {
    code: "TUXPAN",
    name: "Tuxpan",
    phone: "+52 783 000 1011",
    email: "tuxpan@warnersuite.local",
    address: "Av. Juarez 620, Centro",
    city: "Tuxpan",
    state: "Veracruz"
  },
  {
    code: "TUXTLA",
    name: "Tuxtla",
    phone: "+52 961 000 1012",
    email: "tuxtla@warnersuite.local",
    address: "Blvd. Belisario Dominguez 1024",
    city: "Tuxtla Gutierrez",
    state: "Chiapas"
  },
  {
    code: "VILLAHERMOSA",
    name: "Villahermosa",
    phone: "+52 993 000 1013",
    email: "villahermosa@warnersuite.local",
    address: "Av. Universidad 336, Atasta",
    city: "Villahermosa",
    state: "Tabasco"
  },
  {
    code: "XALAPA",
    name: "Xalapa",
    phone: "+52 228 000 1014",
    email: "xalapa@warnersuite.local",
    address: "Av. Lazaro Cardenas 891, Centro",
    city: "Xalapa",
    state: "Veracruz"
  },
  {
    code: "DXRAY_TUXTLA",
    name: "Dx-Ray Tuxtla",
    phone: "+52 961 000 1015",
    email: "dxray-tuxtla@warnersuite.local",
    address: "Periferico Sur 120, Tuxtla",
    city: "Tuxtla Gutierrez",
    state: "Chiapas"
  }
] as const;

function normalizeCode(name: string) {
  return name.toLowerCase();
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

  const defaultBranchCode = process.env.SEED_DEFAULT_BRANCH_CODE ?? "MATRIZ";
  const defaultBranchName = process.env.SEED_DEFAULT_BRANCH_NAME ?? "Sucursal Matriz";

  const branchCatalog = new Map(predefinedBranches.map((branch) => [branch.code, branch]));
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

  for (const branchSeed of branchCatalog.values()) {
    await prisma.branch.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: branchSeed.code
        }
      },
      update: {
        name: branchSeed.name,
        phone: branchSeed.phone,
        email: branchSeed.email,
        address: branchSeed.address,
        city: branchSeed.city,
        state: branchSeed.state,
        country: "MX",
        timezone: "America/Mexico_City",
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        code: branchSeed.code,
        name: branchSeed.name,
        phone: branchSeed.phone,
        email: branchSeed.email,
        address: branchSeed.address,
        city: branchSeed.city,
        state: branchSeed.state,
        country: "MX",
        timezone: "America/Mexico_City",
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
