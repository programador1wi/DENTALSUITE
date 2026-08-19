import { type FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PayableTreatmentItem, Installment } from "../services/payments.service";

export type PaymentSelection =
  | {
      kind: "plan";
      id: string;
      label: string;
      amount: number;
      items: PayableTreatmentItem[];
    }
  | {
      kind: "item";
      id: string;
      label: string;
      amount: number;
      items: PayableTreatmentItem[];
    }
  | {
      kind: "installment";
      id: string;
      label: string;
      amount: number;
      installment: Installment;
    };

type PaymentDrawerProps = {
  selection: PaymentSelection | null;
  onClose: () => void;
  onSubmit: (data: { splits: Split[]; notes: string }) => void;
  isSubmitting: boolean;
  paymentMethods: any[];
  financialInstitutions: any[];
  hasOpenRegister: boolean;
};

type Split = {
  paymentMethodId: string;
  financialInstitutionId: string;
  amount: string;
  reference: string;
};

export function PaymentDrawer({
  selection,
  onClose,
  onSubmit,
  isSubmitting,
  paymentMethods,
  financialInstitutions,
  hasOpenRegister
}: PaymentDrawerProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (selection && paymentMethods.length > 0) {
      setSplits([{
        paymentMethodId: paymentMethods[0].id,
        financialInstitutionId: "",
        amount: String(selection.amount),
        reference: ""
      }]);
      setNotes("");
    }
  }, [selection, paymentMethods]);

  if (!selection) return null;

  const totalAmount = selection.amount;
  const currentTotal = splits.reduce((acc, split) => acc + (Number(split.amount) || 0), 0);
  const remainingAmount = Math.max(0, totalAmount - currentTotal);
  const diff = currentTotal - totalAmount;
  const isMatch = Math.abs(diff) < 0.01;

  const handleAddSplit = () => {
    if (remainingAmount > 0 && paymentMethods.length > 0) {
      setSplits([...splits, {
        paymentMethodId: paymentMethods[0].id,
        financialInstitutionId: "",
        amount: String(Math.round(remainingAmount * 100) / 100),
        reference: ""
      }]);
    } else {
      setSplits([...splits, {
        paymentMethodId: paymentMethods.length > 0 ? paymentMethods[0].id : "",
        financialInstitutionId: "",
        amount: "",
        reference: ""
      }]);
    }
  };

  const handleUpdateSplit = (index: number, field: keyof Split, value: string) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  const handleRemoveSplit = (index: number) => {
    const newSplits = [...splits];
    newSplits.splice(index, 1);
    setSplits(newSplits);
  };

  const canSubmit = hasOpenRegister && isMatch && splits.length > 0 && splits.every(s => s.paymentMethodId && Number(s.amount) > 0) && !isSubmitting;

  return (
    <Drawer open={Boolean(selection)} onClose={onClose} title="Registrar pago">
      <div className="flex h-full flex-col space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Concepto</h4>
          <p className="text-sm text-slate-600">{selection.label}</p>
          <div className="mt-2 text-2xl font-light text-slate-900">
            Monto a pagar: ${Number(totalAmount).toFixed(2)}
          </div>
        </div>

        {!hasOpenRegister && (
          <Alert variant="warning" size="sm">
            El formulario se habilitará cuando exista una caja abierta.
          </Alert>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Medios de pago</h4>
            <Button variant="secondary" size="sm" onClick={handleAddSplit} disabled={!hasOpenRegister || isMatch}>
              <Plus className="mr-1 h-3 w-3" /> Añadir otro
            </Button>
          </div>

          <div className="space-y-4">
            {splits.map((split, i) => (
              <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-4 relative">
                {splits.length > 1 && (
                  <button type="button" onClick={() => handleRemoveSplit(i)} className="absolute right-2 top-2 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">Método</label>
                    <Select value={split.paymentMethodId} onChange={(e) => handleUpdateSplit(i, "paymentMethodId", e.target.value)}>
                      <option value="">Seleccione...</option>
                      {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Monto</label>
                    <Input type="number" min="0" step="0.01" value={split.amount} onChange={(e) => handleUpdateSplit(i, "amount", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Banco / Entidad (Opcional)</label>
                    <Select value={split.financialInstitutionId} onChange={(e) => handleUpdateSplit(i, "financialInstitutionId", e.target.value)}>
                      <option value="">Ninguno</option>
                      {financialInstitutions.map(fi => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Referencia (Opcional)</label>
                    <Input placeholder="# Transferencia / Boleta" value={split.reference} onChange={(e) => handleUpdateSplit(i, "reference", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isMatch && (
            <div className={`mt-2 text-sm font-medium ${diff > 0 ? "text-red-600" : "text-amber-600"}`}>
              {diff > 0 
                ? `El total ingresado supera el saldo por $${diff.toFixed(2)}`
                : `Falta ingresar $${Math.abs(diff).toFixed(2)}`
              }
            </div>
          )}

          <div className="pt-4">
            <label className="text-xs font-semibold text-slate-900">Notas adicionales (Opcional)</label>
            <Input className="mt-1" placeholder="Ej. Pago realizado por un familiar" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button 
            type="button" 
            onClick={() => onSubmit({ splits, notes })}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Procesando..." : "Confirmar pago"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
