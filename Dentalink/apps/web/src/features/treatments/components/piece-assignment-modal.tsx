import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { TreatmentPlanItem } from "@/features/treatments/services/treatments.service";
import {
  FDI_PERMANENT_TEETH,
  FDI_TEMPORAL_TEETH,
  PIECE_SURFACES,
  fdiLabel,
  surfaceValues
} from "./treatment-modal-helpers";

export function PieceAssignmentModal({
  item,
  saving,
  onClose,
  onSave
}: {
  item: TreatmentPlanItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (item: TreatmentPlanItem, toothNumber: string, surfaces: string[]) => Promise<void>;
}) {
  const [toothNumber, setToothNumber] = useState("");
  const [surfaces, setSurfaces] = useState<string[]>([]);

  useEffect(() => {
    setToothNumber(item?.toothNumber ?? "");
    setSurfaces(surfaceValues(item?.surface));
  }, [item]);

  const toggleSurface = (surface: string) => {
    setSurfaces((current) =>
      current.includes(surface) ? current.filter((s) => s !== surface) : [...current, surface]
    );
  };

  const procedureLabel = item?.procedure ? `[${item.procedure.code}] ${item.procedure.name}` : "Prestación";

  return (
    <Modal open={Boolean(item)} title="Asignar piezas a prestación" onClose={onClose} size="lg">
      {item ? (
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white">
              i
            </div>
            <div className="min-w-0 border-l-4 border-sky-400 pl-4">
              <p className="text-sm font-semibold text-sky-700">
                Seleccione la pieza que quiere asignar a esta prestación
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Para asignar mas de una cara, seleccione las opciones necesarias y presione Agregar piezas.
              </p>
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700">{procedureLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pl-14">
            <Select
              value={toothNumber}
              onChange={(event) => setToothNumber(event.target.value)}
              className="w-48"
            >
              <option value="">Seleccione una opcion</option>
              <optgroup label="Permanentes">
                {FDI_PERMANENT_TEETH.map((tooth) => (
                  <option key={tooth} value={tooth}>
                    Pieza {fdiLabel(tooth)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Temporales">
                {FDI_TEMPORAL_TEETH.map((tooth) => (
                  <option key={tooth} value={tooth}>
                    Pieza {fdiLabel(tooth)}
                  </option>
                ))}
              </optgroup>
            </Select>

            {PIECE_SURFACES.map((surface) => {
              const active = surfaces.includes(surface.code);
              return (
                <button
                  key={surface.code}
                  type="button"
                  className={`inline-flex h-8 items-center gap-1 rounded px-2.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#0879d5] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                  }`}
                  onClick={() => toggleSurface(surface.code)}
                >
                  <span className="grid h-3.5 w-3.5 place-items-center rounded border border-current text-[10px]">
                    {active ? "x" : ""}
                  </span>
                  {surface.label}
                </button>
              );
            })}
          </div>

          <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              disabled={!toothNumber || saving}
              onClick={() => void onSave(item, toothNumber, surfaces)}
            >
              {saving ? "Guardando..." : "Agregar piezas"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
