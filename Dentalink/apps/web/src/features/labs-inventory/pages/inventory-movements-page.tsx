import { Navigate } from "react-router-dom";

export function InventoryMovementsPage() {
  return <Navigate to="/inventory?view=movements" replace />;
}
