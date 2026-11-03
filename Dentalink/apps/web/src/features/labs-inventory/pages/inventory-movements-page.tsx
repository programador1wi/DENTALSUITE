import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";

export function InventoryMovementsPage() {
  return <Navigate to={`${APP_ROUTES.inventory.root}?view=movements`} replace />;
}
