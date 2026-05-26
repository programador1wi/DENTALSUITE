import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import {
  useCreatePaymentMethod,
  useDeactivatePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod
} from "../hooks/use-payment-methods";

const methodOptions = [
  { label: "Efectivo", value: "CASH" },
  { label: "Tarjeta", value: "CARD" },
  { label: "Transferencia", value: "TRANSFER" },
  { label: "Deposito", value: "DEPOSIT" },
  { label: "Online", value: "ONLINE" },
  { label: "Credito", value: "CREDIT" },
  { label: "Otro", value: "OTHER" }
];

export function PaymentMethodsSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const methods = usePaymentMethods(search || undefined, active || undefined);
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deactivateMethod = useDeactivatePaymentMethod();

  return (
    <SimpleCrudPage
      title="Metodos de pago"
      description="Configuracion financiera operativa"
      rows={methods.data}
      loading={methods.isLoading}
      error={methods.error?.message}
      search={search}
      setSearch={setSearch}
      active={active}
      setActive={setActive}
      fields={[
        { key: "name", label: "Nombre", type: "text" },
        { key: "type", label: "Tipo", type: "select", options: methodOptions }
      ]}
      columns={[
        { key: "name", title: "Nombre" },
        { key: "type", title: "Tipo" },
        {
          key: "isActive",
          title: "Estado",
          render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
        }
      ]}
      actions={{
        create: async (payload) => createMethod.mutateAsync(payload as never),
        update: async (id, payload) => updateMethod.mutateAsync({ id, payload: payload as never }),
        deactivate: async (id) => deactivateMethod.mutateAsync(id),
        mapToForm: (row) => ({ name: row.name, type: row.type }),
        getId: (row) => row.id
      }}
    />
  );
}
