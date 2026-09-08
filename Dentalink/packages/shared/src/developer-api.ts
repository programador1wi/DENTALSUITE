export const DEVELOPER_API_SCOPES = [
  "patients:read",
  "patients:write",
  "appointments:read",
  "appointments:write",
  "budgets:read",
  "pricing:read"
] as const;

export type DeveloperApiScope = (typeof DEVELOPER_API_SCOPES)[number];

export const DEVELOPER_API_PLANS = ["STANDARD", "PRO", "ENTERPRISE"] as const;
export type DeveloperApiPlan = (typeof DEVELOPER_API_PLANS)[number];

export const DEVELOPER_API_RATE_LIMITS: Record<DeveloperApiPlan, number> = {
  STANDARD: 60,
  PRO: 300,
  ENTERPRISE: 1200
};

export const DEVELOPER_API_SCOPE_DETAILS: Array<{
  value: DeveloperApiScope;
  label: string;
  description: string;
}> = [
  {
    value: "patients:read",
    label: "Lectura de pacientes",
    description: "Permite consultar datos de filiacion, identificadores y perfiles de pacientes."
  },
  {
    value: "patients:write",
    label: "Creacion y actualizacion de pacientes",
    description: "Permite registrar y modificar datos de pacientes respetando las reglas de validacion."
  },
  {
    value: "appointments:read",
    label: "Lectura de agenda y citas",
    description: "Permite consultar citas, estados de atencion y programacion de agendas."
  },
  {
    value: "appointments:write",
    label: "Creacion y gestion de citas",
    description: "Permite agendar, reprogramar y actualizar el estado de las citas."
  },
  {
    value: "budgets:read",
    label: "Lectura de presupuestos",
    description: "Permite consultar presupuestos y planes de tratamiento de pacientes."
  },
  {
    value: "pricing:read",
    label: "Lectura de aranceles y listas de precios",
    description: "Permite consultar aranceles, prestaciones y listas de precios vigentes."
  }
];

export function isDeveloperApiScope(value: string): value is DeveloperApiScope {
  return DEVELOPER_API_SCOPES.includes(value as DeveloperApiScope);
}

export function normalizeDeveloperApiScopes(scopes: readonly string[]): DeveloperApiScope[] {
  return Array.from(new Set(scopes)).filter(isDeveloperApiScope);
}
