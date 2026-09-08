import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  OrthodonticCatalogField,
  OrthodonticCatalogOption,
  OrthodonticDiagnosisCatalogField
} from "@/features/treatments/services/treatments.service";

export type OrthodonticEditableOptionField =
  | OrthodonticCatalogField
  | OrthodonticDiagnosisCatalogField;

export type OrthodonticEditableOption =
  | OrthodonticCatalogOption
  | OrthodonticDiagnosisCatalogField["options"][number];

export function OrthodonticOptionsModal({
  field,
  canManage,
  onClose,
  onCreate,
  onUpdate,
  onDeactivate,
  onReactivate,
  onSort
}: {
  field: OrthodonticEditableOptionField | null;
  canManage: boolean;
  onClose: () => void;
  onCreate: (fieldId: string, label: string) => Promise<unknown>;
  onUpdate: (optionId: string, payload: { label?: string; sortOrder?: number }) => Promise<unknown>;
  onDeactivate: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivate: (optionId: string) => Promise<unknown>;
  onSort: (fieldId: string, optionIds: string[]) => Promise<unknown>;
}) {
  const [draftOptions, setDraftOptions] = useState<
    Array<OrthodonticEditableOption & { isNew?: boolean }>
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftOptions(field?.options.map((option) => ({ ...option })) ?? []);
  }, [field]);

  if (!field) return null;

  const addOption = () => {
    setDraftOptions((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        code: "",
        label: "",
        sortOrder: current.length,
        isActive: true,
        version: 1,
        isNew: true
      }
    ]);
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    setDraftOptions((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((option, sortOrder) => ({ ...option, sortOrder }));
    });
  };

  const saveOptions = async () => {
    if (!canManage) return;
    const normalized = new Set<string>();
    for (const option of draftOptions) {
      const label = option.label.trim().replace(/\s+/g, " ");
      if (!label) {
        toast.error("Todas las opciones necesitan texto.");
        return;
      }
      const key = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (normalized.has(key)) {
        toast.error("Hay opciones duplicadas.");
        return;
      }
      normalized.add(key);
    }
    setSaving(true);
    try {
      const originalById = new Map(field.options.map((option) => [option.id, option]));
      for (const option of draftOptions) {
        if (option.isNew) {
          await onCreate(field.id, option.label);
          continue;
        }
        const original = originalById.get(option.id);
        if (!original) continue;
        if (option.label !== original.label || option.sortOrder !== original.sortOrder) {
          await onUpdate(option.id, { label: option.label, sortOrder: option.sortOrder });
        }
        if (option.isActive !== original.isActive) {
          if (option.isActive) await onReactivate(option.id);
          else await onDeactivate(option.id);
        }
      }
      await onSort(
        field.id,
        draftOptions.filter((option) => !option.isNew).map((option) => option.id)
      );
      toast.success("Opciones actualizadas.");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar opciones"
        className="w-full max-w-[560px] rounded-lg bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">Editar opciones</h3>
          <p className="mt-1 text-xs text-slate-500">Campo: {field.name}</p>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" disabled={!canManage} onClick={addOption}>
              <Plus className="h-4 w-4" />
              Nueva opcion
            </Button>
          </div>
          <div className="space-y-2">
            {draftOptions.map((option, index) => (
              <div
                key={option.id}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-slate-200 p-2"
              >
                <Input
                  disabled={
                    !canManage ||
                    (!option.isNew &&
                      field.options.find((row) => row.id === option.id)?.isActive === false)
                  }
                  value={option.label}
                  className={option.isActive ? "" : "text-slate-400 line-through"}
                  onChange={(event) =>
                    setDraftOptions((current) =>
                      current.map((row) =>
                        row.id === option.id ? { ...row, label: event.target.value } : row
                      )
                    )
                  }
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage || index === 0}
                    onClick={() => moveOption(index, -1)}
                  >
                    <ChevronLeft className="h-4 w-4 rotate-90" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage || index === draftOptions.length - 1}
                    onClick={() => moveOption(index, 1)}
                  >
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </Button>
                  <Button
                    variant={option.isActive ? "danger" : "secondary"}
                    size="sm"
                    disabled={!canManage}
                    onClick={() =>
                      setDraftOptions((current) =>
                        current.map((row) =>
                          row.id === option.id ? { ...row, isActive: !row.isActive } : row
                        )
                      )
                    }
                  >
                    {option.isActive ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
                {!option.isActive ? (
                  <span className="text-xs font-medium text-slate-400">Inactiva</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canManage || saving} onClick={() => void saveOptions()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
