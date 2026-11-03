import { useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Select } from "@/components/ui/select";
import { usePatientFinancialDocuments } from "@/features/payments/hooks/use-payments";
import { dateOnly, money } from "./shared-helpers";

const documentTypes = [
  ["", "Todos los tipos"],
  ["PAYMENT_RECEIPT", "Comprobante de pago"],
  ["INVOICE", "Factura"],
  ["SALES_RECEIPT", "Boleta / recibo"],
  ["CREDIT_NOTE", "Nota de credito"],
  ["DEBIT_NOTE", "Nota de debito"],
  ["PAYMENT_COMPLEMENT", "Complemento de pago"],
  ["REFUND_RECEIPT", "Comprobante de devolucion"],
  ["ACCOUNT_STATEMENT", "Estado de cuenta"],
  ["OTHER", "Otro"]
];

const documentStatuses = [
  ["", "Todos los estados"],
  ["DRAFT", "Borrador"],
  ["ISSUING", "Emitiendo"],
  ["ISSUED", "Emitido"],
  ["ACCEPTED", "Aceptado"],
  ["REJECTED", "Rechazado"],
  ["CANCEL_REQUESTED", "Cancelacion solicitada"],
  ["CANCELLED", "Cancelado"],
  ["REPLACED", "Reemplazado"],
  ["FAILED", "Fallido"]
];

export function IssuedDocumentsView() {
  const { id = "" } = useParams();
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const documents = usePatientFinancialDocuments(id, {
    ...(type ? { type } : {}),
    ...(status ? { status } : {})
  });

  if (documents.isLoading) return <LoadingState message="Cargando documentos emitidos..." />;
  if (documents.isError) return <ErrorState message={documents.error.message} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Documentos emitidos</h2>
        <p className="text-sm text-slate-500">Documentos financieros y fiscales vinculados al paciente.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Select className="w-64" value={type} onChange={(event) => setType(event.target.value)}>
          {documentTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select className="w-64" value={status} onChange={(event) => setStatus(event.target.value)}>
          {documentStatuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        rows={documents.data ?? []}
        empty={
          <EmptyState
            title="El paciente no cuenta con documentos financieros emitidos."
            description="No hay documentos financieros para los filtros seleccionados."
          />
        }
        columns={[
          { key: "type", title: "Tipo", render: (row) => documentLabel(row.type) },
          { key: "folio", title: "Serie / folio", render: (row) => row.folio ?? `#${row.id.slice(-6).toUpperCase()}` },
          { key: "issuedAt", title: "Fecha", render: (row) => dateOnly(row.issuedAt ?? row.createdAt) },
          { key: "id", title: "Receptor", render: () => "Paciente" },
          { key: "payment", title: "Relacion", render: (row) => relationLabel(row) },
          { key: "subtotal", title: "Subtotal", render: (row) => money(row.subtotal) },
          { key: "taxes", title: "Impuestos", render: (row) => money(row.taxes) },
          { key: "total", title: "Total", render: (row) => money(row.total) },
          { key: "status", title: "Estado", render: (row) => <Badge value={statusLabel(row.status)} tone={documentTone(row.status)} /> },
          { key: "files", title: "Envio", render: (row) => (row.files?.length ? "Con archivo" : "Sin archivo") }
        ]}
      />
    </div>
  );
}

function documentLabel(type: string) {
  return documentTypes.find(([value]) => value === type)?.[1] ?? type;
}

function statusLabel(status: string) {
  return documentStatuses.find(([value]) => value === status)?.[1] ?? status;
}

function relationLabel(row: { payment?: { paymentNumber?: number | string | null } | null; refund?: { id: string } | null; treatmentPlan?: { name: string } | null }) {
  if (row.payment) return `Pago #${row.payment.paymentNumber ?? "-"}`;
  if (row.refund) return `Devolucion #${row.refund.id.slice(-6).toUpperCase()}`;
  if (row.treatmentPlan) return row.treatmentPlan.name;
  return "-";
}

function documentTone(status: string) {
  if (["ISSUED", "ACCEPTED"].includes(status)) return "success";
  if (["REJECTED", "CANCELLED", "FAILED"].includes(status)) return "danger";
  return "warning";
}
