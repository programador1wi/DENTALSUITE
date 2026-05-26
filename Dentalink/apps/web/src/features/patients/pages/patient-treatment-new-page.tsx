import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PatientSectionPage } from "../components/patient-section-page";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useTreatmentMutations } from "@/features/treatments/hooks/use-treatments";

type ItemForm = {
  procedureId: string;
  toothNumber: string;
  surface: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  notes: string;
};

const newItem = (): ItemForm => ({
  procedureId: "",
  toothNumber: "",
  surface: "",
  quantity: "1",
  unitPrice: "0",
  discount: "0",
  notes: ""
});

export function PatientTreatmentNewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true");
  const procedures = useProcedures(undefined, "true");
  const mutations = useTreatmentMutations();

  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemForm[]>([newItem()]);

  const updateItem = (index: number, patch: Partial<ItemForm>) => {
    setItems((previous) => previous.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((previous) => [...previous, newItem()]);

  const removeItem = (index: number) => setItems((previous) => previous.filter((_, currentIndex) => currentIndex !== index));

  const save = async () => {
    if (!branchId || !professionalId || !name.trim()) {
      toast.error("Completa sucursal, profesional y nombre del plan");
      return;
    }

    const parsedItems = items
      .filter((item) => item.procedureId)
      .map((item) => ({
        procedureId: item.procedureId,
        toothNumber: item.toothNumber || undefined,
        surface: item.surface || undefined,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        discount: Number(item.discount || 0),
        notes: item.notes || undefined
      }));

    await mutations.createTreatmentPlan.mutateAsync({
      branchId,
      patientId: id,
      professionalId,
      name: name.trim(),
      description: description.trim() || undefined,
      status: "DRAFT",
      items: parsedItems
    });

    navigate(`/patients/${id}/treatments`);
  };

  return (
    <PatientSectionPage patientId={id} title="Nuevo plan de tratamiento" description="Crear plan clinico, procedimientos y valores base.">
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">Sucursal</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
            <option value="">Profesional</option>
            {professionals.data?.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.firstName} {professional.lastName}
              </option>
            ))}
          </Select>
          <Input placeholder="Nombre del plan" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Textarea className="mt-3" rows={2} placeholder="Descripcion" value={description} onChange={(event) => setDescription(event.target.value)} />
      </Card>

      <div className="space-y-3">
        {items.map((item, index) => (
          <Card key={index}>
            <div className="grid gap-3 md:grid-cols-4">
              <Select value={item.procedureId} onChange={(event) => updateItem(index, { procedureId: event.target.value })}>
                <option value="">Procedimiento</option>
                {procedures.data?.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.code} - {procedure.name}
                  </option>
                ))}
              </Select>
              <Input placeholder="Pieza" value={item.toothNumber} onChange={(event) => updateItem(index, { toothNumber: event.target.value })} />
              <Input placeholder="Superficie" value={item.surface} onChange={(event) => updateItem(index, { surface: event.target.value })} />
              <Input placeholder="Cantidad" type="number" min={0.01} step={0.01} value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Input placeholder="Precio unitario" type="number" min={0} step={0.01} value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: event.target.value })} />
              <Input placeholder="Descuento" type="number" min={0} step={0.01} value={item.discount} onChange={(event) => updateItem(index, { discount: event.target.value })} />
              <Input placeholder="Notas" value={item.notes} onChange={(event) => updateItem(index, { notes: event.target.value })} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="danger" onClick={() => removeItem(index)} disabled={items.length === 1}>
                Quitar item
              </Button>
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={addItem}>
            Agregar item
          </Button>
          <Button onClick={() => void save()} disabled={mutations.createTreatmentPlan.isPending}>
            Guardar plan
          </Button>
        </div>
      </div>
    </PatientSectionPage>
  );
}
