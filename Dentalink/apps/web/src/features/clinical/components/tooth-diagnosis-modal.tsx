import { useEffect, useState } from "react";
import { Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DIAGNOSIS_SECTIONS, ToothDiagnosisSymbol } from "./tooth-diagnosis-symbols";

function fdiLabel(toothNumber: string) {
  return toothNumber.length >= 2 ? `${toothNumber[0]}.${toothNumber[1]}` : toothNumber;
}

export function ToothDiagnosisModal({
  open,
  toothNumber,
  onClose,
  onAddDiagnosis
}: {
  open: boolean;
  toothNumber: string;
  onClose: () => void;
  onAddDiagnosis?: (diagnosis: string, notes?: string) => void;
}) {
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedDiagnosis("");
      setNotes("");
    }
  }, [open, toothNumber]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="flex h-full flex-col">
        <header className="flex h-[70px] shrink-0 items-center justify-between bg-black px-4 text-white">
          <div className="inline-flex items-center gap-2 text-lg font-semibold">
            <Stethoscope className="h-5 w-5 text-white" />
            Definir diagnostico
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center text-slate-400 hover:text-white" onClick={onClose} aria-label="Cerrar">
            <X className="h-7 w-7" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-7">
          {DIAGNOSIS_SECTIONS.map((section, sectionIndex) => (
            <section key={section.title} className={sectionIndex > 0 ? "mt-10" : undefined}>
              <h3 className="mb-6 text-center text-2xl font-light text-zinc-600">{section.title}</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
                {section.options.map((option) => (
                  <button
                    key={`${section.title}-${option.label}`}
                    type="button"
                    className={cn(
                      "flex h-[142px] flex-col items-center justify-center border-b border-zinc-200 text-center transition-colors",
                      "hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2382d9]",
                      selectedDiagnosis === option.label && "border-b-[#2382d9] bg-[#e5f4fb]"
                    )}
                    onClick={() => setSelectedDiagnosis(option.label)}
                  >
                    <ToothDiagnosisSymbol mark={option.mark} />
                    <span className="mt-1 text-sm text-zinc-800">{option.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 text-center shadow-[0_-2px_6px_rgba(15,23,42,0.08)]">
          <p className="mb-2 text-lg font-light text-zinc-400">Piezas seleccionadas</p>
          <span className="inline-grid h-10 min-w-10 place-items-center rounded-full bg-[#0789d4] px-3 text-sm font-semibold text-white">
            {fdiLabel(toothNumber)}
          </span>
          <textarea
            className="mt-4 min-h-[115px] w-full resize-none rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#2382d9]"
            placeholder="Ingrese un comentario para este diagnostico"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <button
            type="button"
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 bg-[#58ba5b] text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedDiagnosis}
            onClick={() => onAddDiagnosis?.(selectedDiagnosis, notes.trim() || undefined)}
          >
            <span className="text-2xl leading-none">+</span>
            Agregar al odontograma
          </button>
        </footer>
      </div>
    </div>
  );
}
