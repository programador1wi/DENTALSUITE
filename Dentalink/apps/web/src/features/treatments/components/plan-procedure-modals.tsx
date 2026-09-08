import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceSelector } from "@/features/clinical/components/surface-selector";
import { ODONTOGRAM_PROCEDURE_SYMBOL_OPTIONS } from "@/features/clinical/components/tooth-diagnosis-symbols";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";
import type {
  TreatmentPlanDetail,
  TreatmentPriceCatalog,
  TreatmentPriceCatalogItem
} from "@/features/treatments/services/treatments.service";
import {
  fdiLabel,
  money,
  numberValue,
  priceForProcedure
} from "./treatment-modal-helpers";

export function PlanProcedureModal({
  open,
  plan,
  toothNumber,
  surface,
  onSurfaceChange,
  procedures,
  priceList,
  onClose,
  onSave
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  toothNumber: string;
  surface: string;
  onSurfaceChange: (surface: string) => void;
  procedures: Procedure[];
  priceList: TreatmentPriceCatalog | null;
  onClose: () => void;
  onSave: (payload: {
    sectionId?: string;
    procedureId: string;
    toothNumber?: string;
    surface?: string;
    quantity: number;
    discount: number;
    notes?: string;
  }) => Promise<void>;
}) {
  const [sectionId, setSectionId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSectionId("");
    setProcedureId("");
    setQuantity("1");
    setUnitPrice("0");
    setDiscount("0");
    setNotes("");
  }, [open, toothNumber]);

  useEffect(() => {
    if (!procedureId) return;
    setUnitPrice(String(priceForProcedure(priceList, procedureId)));
  }, [priceList, procedureId]);

  const selectedProcedure = procedures.find((procedure) => procedure.id === procedureId);
  const selectedPriceItem = priceList?.items.find((item) => item.procedureId === procedureId) ?? null;
  const userMaximumDiscount = Number(priceList?.discountCapability?.maximumDiscountPercent ?? 0);
  const procedureMaximumDiscount = selectedPriceItem?.allowsDiscount
    ? Number(selectedPriceItem.maxDiscountPercent ?? 0)
    : 0;
  const effectiveMaximumDiscount = Math.min(userMaximumDiscount, procedureMaximumDiscount);
  const baseAmount = numberValue(quantity) * numberValue(unitPrice);
  const discountAmount = Number((baseAmount * (numberValue(discount) / 100)).toFixed(2));
  const total = Math.max(baseAmount - discountAmount, 0);

  return (
    <Modal
      open={open}
      title={`Agregar procedimiento - Pieza ${fdiLabel(toothNumber)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
          <option value="">Sin sección</option>
          {plan?.sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>
        <SurfaceSelector value={surface} onChange={onSurfaceChange} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px]">
        <Select value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
          <option value="">Procedimiento</option>
          {procedures.map((procedure) => (
            <option key={procedure.id} value={procedure.id}>
              {procedure.code} - {procedure.name}
            </option>
          ))}
        </Select>
        <Input
          value={quantity}
          type="number"
          min={0.01}
          step={0.01}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Cantidad"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Input value={unitPrice} type="number" min={0} step={0.01} readOnly placeholder="Precio" />
        <Input
          value={discount}
          type="number"
          min={0}
          max={effectiveMaximumDiscount}
          step={0.01}
          onChange={(event) => setDiscount(event.target.value)}
          disabled={effectiveMaximumDiscount <= 0}
          placeholder="Descuento %"
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p className="text-xs text-slate-500">Total</p>
          <p className="font-semibold text-slate-900">{money(total)}</p>
        </div>
      </div>

      <Textarea
        className="mt-3"
        rows={3}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Diagnóstico o notas clinicas"
      />

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p>
          Arancel:{" "}
          <span className="font-semibold text-slate-900">{priceList?.name ?? "Sin lista activa"}</span>
        </p>
        <div className="mt-2 grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-3">
          <p>
            Límite usuario: <strong>{userMaximumDiscount.toFixed(2)} %</strong>
          </p>
          <p>
            Límite prestación: <strong>{procedureMaximumDiscount.toFixed(2)} %</strong>
          </p>
          <p>
            Máximo aplicable:{" "}
            <strong className="text-sky-800">{effectiveMaximumDiscount.toFixed(2)} %</strong>
          </p>
        </div>
        {numberValue(discount) > effectiveMaximumDiscount ? (
          <p className="mt-2 text-red-600">
            Descuento solicitado {numberValue(discount).toFixed(2)} %, máximo permitido{" "}
            {effectiveMaximumDiscount.toFixed(2)} %.
          </p>
        ) : null}
        <p>
          Origen precio:{" "}
          <span className="font-semibold text-slate-900">
            {selectedPriceItem ? "Listado vigente" : "Sin precio configurado"}
          </span>
        </p>
        <p>
          Procedimiento:{" "}
          <span className="font-semibold text-slate-900">
            {selectedProcedure ? `${selectedProcedure.code} - ${selectedProcedure.name}` : "No seleccionado"}
          </span>
        </p>
        <p>
          Pieza:{" "}
          <span className="font-semibold text-slate-900">
            {fdiLabel(toothNumber)}
            {surface ? `-${surface}` : " - Pieza completa"}
          </span>
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!procedureId || !toothNumber || numberValue(discount) > effectiveMaximumDiscount}
          onClick={() =>
            void onSave({
              sectionId: sectionId || undefined,
              procedureId,
              toothNumber,
              surface: surface || "ALL",
              quantity: numberValue(quantity) || 1,
              discount: discountAmount,
              notes: notes || undefined
            })
          }
        >
          Guardar en plan y odontograma
        </Button>
      </div>
    </Modal>
  );
}

export function SectionModal({
  open,
  nextSortOrder,
  onClose,
  onSave
}: {
  open: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (payload: { name: string; sortOrder: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(String(nextSortOrder));

  useEffect(() => {
    if (!open) return;
    setName("");
    setSortOrder(String(nextSortOrder));
  }, [nextSortOrder, open]);

  return (
    <Modal open={open} title="Agregar sección" onClose={onClose}>
      <div className="space-y-3">
        <label>
          <span className="text-xs font-semibold text-slate-600">Nombre</span>
          <Input
            className="mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Fase inicial, Ortodoncia, Retencion"
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-slate-600">Orden</span>
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          El modelo actual de secciones guarda nombre y orden. Descripcion y observacion requieren cambio de
          schema.
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!name.trim()}
          onClick={() => void onSave({ name: name.trim(), sortOrder: numberValue(sortOrder) })}
        >
          Guardar sección
        </Button>
      </div>
    </Modal>
  );
}

export function SymbolModal({
  open,
  item,
  selectedSymbol,
  onSymbolChange,
  teeth,
  saving,
  onClose,
  onSave
}: {
  open: boolean;
  item: TreatmentPriceCatalogItem | null;
  selectedSymbol: string;
  onSymbolChange: (val: string) => void;
  teeth: string[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal open={open} title="Información extra" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">
        Este procedimiento requiere especificar un símbolo para el odontograma.
      </p>
      {item && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Procedimiento</label>
            <p className="text-sm text-slate-900 mt-1">
              [{item.procedure.code}] {item.procedure.name}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Pieza afectada</label>
            <p className="text-sm text-slate-900 mt-1">
              {teeth.length ? teeth.map((t) => fdiLabel(t)).join(", ") : "Sin pieza asignada"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Símbolo</label>
            <Select value={selectedSymbol} onChange={(e) => onSymbolChange(e.target.value)} className="mt-2">
              <option value="">Seleccione una opcion</option>
              {ODONTOGRAM_PROCEDURE_SYMBOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={saving || !selectedSymbol} onClick={onSave}>
          {saving ? "Agregando..." : "Cargar al tratamiento"}
        </Button>
      </div>
    </Modal>
  );
}

export function CommentModal({
  open,
  onClose,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <Modal open={open} title="Comentario para el paciente" onClose={onClose}>
      <Textarea
        rows={5}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Escribe el comentario que se usara como referencia del plan."
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!note.trim()} onClick={() => void onSave(note.trim())}>
          Guardar comentario
        </Button>
      </div>
    </Modal>
  );
}
