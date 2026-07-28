import { Link, useLocation } from "react-router-dom";

const mapName: Record<string, string> = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  day: "Dia",
  week: "Semana",
  month: "Mes",
  "waiting-room": "Sala de espera",
  patients: "Pacientes",
  new: "Nuevo",
  settings: "Configuracion",
  profile: "Perfil",
  organization: "Organizacion",
  branches: "Sucursales",
  professionals: "Profesionales",
  specialties: "Especialidades",
  schedules: "Horarios",
  chairs: "Sillones",
  "payment-methods": "Metodos de pago",
  "payment-settlements": "Recepciones programadas",
  procedures: "Procedimientos",
  "price-lists": "Listas de precios",
  "consent-templates": "Plantillas consentimiento",
  "treatment-plans": "Planes",
  budgets: "Presupuestos",
  "cash-register": "Caja",
  "accounts-receivable": "Cuentas por cobrar",
  installments: "Cuotas",
  collections: "Morosidad",
  users: "Usuarios",
  roles: "Roles",
  login: "Login",
  "register-organization": "Registro",
  clinical: "Clinico",
  history: "Historia",
  evolutions: "Evoluciones",
  prescriptions: "Recetas",
  documents: "Documentos",
  odontogram: "Odontograma",
  periodontogram: "Periodontograma",
  appointments: "Citas",
  treatments: "Tratamientos",
  payments: "Pagos",
  consents: "Consentimientos",
  files: "Archivos"
};

export function Breadcrumbs() {
  const location = useLocation();
  const pieces = location.pathname.split("/").filter(Boolean);

  const paths = pieces.map((piece, index) => {
    const to = `/${pieces.slice(0, index + 1).join("/")}`;
    return {
      to,
      label: mapName[piece] ?? piece
    };
  });

  return (
    <nav className="text-sm text-slate-500">
      <ol className="flex items-center gap-2">
        <li>
          <Link to="/dashboard" className="hover:text-slate-700">
            Inicio
          </Link>
        </li>
        {paths.map((path) => (
          <li key={path.to} className="flex items-center gap-2">
            <span>/</span>
            <Link to={path.to} className="hover:text-slate-700">
              {path.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
