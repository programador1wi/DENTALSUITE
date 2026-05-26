import { Navigate, useParams } from "react-router-dom";

export function PatientClinicalPage() {
  const { id = "" } = useParams();
  return <Navigate to={`/patients/${id}/clinical/history`} replace />;
}
