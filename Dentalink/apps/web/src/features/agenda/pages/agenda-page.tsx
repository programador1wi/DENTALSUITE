import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";

export function AgendaPage() {
  return <Navigate to={APP_ROUTES.agenda.list} replace />;
}
