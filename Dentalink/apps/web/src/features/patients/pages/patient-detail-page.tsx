import { Navigate, useParams } from "react-router-dom";

export function PatientDetailPage() {
  const { id = "" } = useParams();
  return <Navigate to={`/patients/${id}/profile`} replace />;
}
