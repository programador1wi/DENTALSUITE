import { Navigate, useParams } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";

export function PatientDetailPage() {
  const { id = "" } = useParams();
  return <Navigate to={APP_ROUTES.patients.profile(id)} replace />;
}
