import { CheckCircle2, ClipboardCheck, Receipt, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Budget } from "@/features/treatments/services/treatments.service";
import { money, numberValue } from "./treatment-modal-helpers";

export function BudgetPanel({
  budget,
  onCreate,
  onSend,
  onAccept
}: {
  budget: Budget | null;
  onCreate: () => void;
  onSend: (budgetId: string) => void;
  onAccept: (budgetId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Presupuesto y firma</h2>
            <p className="text-sm text-slate-500">
              {budget
                ? `Presupuesto ${budget.status} por ${money(numberValue(budget.total))}`
                : "Aun no se ha generado presupuesto."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onCreate}>
            <Receipt className="mr-1 h-4 w-4" />
            Crear presupuesto
          </Button>
          <Button
            variant="secondary"
            disabled={!budget || !["DRAFT"].includes(budget.status)}
            onClick={() => budget && onSend(budget.id)}
          >
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
          <Button
            disabled={!budget || !["DRAFT", "SENT"].includes(budget.status)}
            onClick={() => budget && onAccept(budget.id)}
          >
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Aceptar
          </Button>
        </div>
      </div>
    </section>
  );
}
