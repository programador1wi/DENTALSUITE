import { Navigate, useParams } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";

export function PatientClinicalPage() {
  const { id = "" } = useParams();
  return <Navigate to={APP_ROUTES.patients.clinicalHistory(id)} replace />;
}
