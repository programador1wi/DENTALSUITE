import { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Info } from "lucide-react";

export interface VademecumDrug {
  name: string;
  posologia: string;
  formato: string;
  cada: string;
  cadaUnidad: string;
  via: string;
  durante: string;
  duranteUnidad: string;
  indicaciones: string;
}

export const VADECUM_CATALOG: VademecumDrug[] = [
  {
    name: "Amoxicilina 500 mg",
    posologia: "1",
    formato: "Cápsula",
    cada: "8",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "7",
    duranteUnidad: "Días",
    indicaciones: "Tomar después de las comidas. Completar el tratamiento aunque se sienta mejor."
  },
  {
    name: "Ibuprofeno 600 mg",
    posologia: "1",
    formato: "Comprimido",
    cada: "8",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "5",
    duranteUnidad: "Días",
    indicaciones: "Tomar acompañado de alimentos para proteger el estómago. Suspender si no hay dolor."
  },
  {
    name: "Paracetamol 500 mg",
    posologia: "1",
    formato: "Comprimido",
    cada: "8",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "3",
    duranteUnidad: "Días",
    indicaciones: "Tomar en caso de dolor leve o fiebre. No exceder de 4 g al día."
  },
  {
    name: "Ketorolaco 10 mg",
    posologia: "1",
    formato: "Tableta sublingual",
    cada: "8",
    cadaUnidad: "Horas",
    via: "Sublingual",
    durante: "3",
    duranteUnidad: "Días",
    indicaciones: "Colocar debajo de la lengua hasta su completa disolución en caso de dolor agudo."
  },
  {
    name: "Clindamicina 300 mg",
    posologia: "1",
    formato: "Cápsula",
    cada: "8",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "7",
    duranteUnidad: "Días",
    indicaciones: "Tomar con abundante agua. Especialmente indicado para infecciones óseas/odontológicas."
  },
  {
    name: "Clorhexidina 0.12% Colutorio",
    posologia: "15",
    formato: "Ml",
    cada: "12",
    cadaUnidad: "Horas",
    via: "Bucal (Enjuague)",
    durante: "10",
    duranteUnidad: "Días",
    indicaciones: "Realizar enjuague por 30-40 segundos después del cepillado. Evitar comer o beber durante 30 minutos."
  },
  {
    name: "Azitromicina 500 mg",
    posologia: "1",
    formato: "Comprimido",
    cada: "24",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "3",
    duranteUnidad: "Días",
    indicaciones: "Tomar una hora antes o dos horas después de las comidas."
  },
  {
    name: "Amoxicilina + Ácido Clavulánico 875/125 mg",
    posologia: "1",
    formato: "Comprimido",
    cada: "12",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "7",
    duranteUnidad: "Días",
    indicaciones: "Tomar al inicio de una comida para reducir posibles molestias gastrointestinales."
  },
  {
    name: "Nimesulida 100 mg",
    posologia: "1",
    formato: "Tableta",
    cada: "12",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "5",
    duranteUnidad: "Días",
    indicaciones: "Antiinflamatorio potente para dolor post-quirúrgico. Usar máximo 5 días."
  },
  {
    name: "Dexketoprofeno 25 mg",
    posologia: "1",
    formato: "Comprimido",
    cada: "8",
    cadaUnidad: "Horas",
    via: "Oral",
    durante: "3",
    duranteUnidad: "Días",
    indicaciones: "Tomar 30 minutos antes de las comidas para un efecto analgésico más rápido en caso de dolor agudo."
  }
];

interface VademecumModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (formattedText: string) => void;
}

export function VademecumModal({ open, onClose, onSelect }: VademecumModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<VademecumDrug | null>(null);
  
  const [posologia, setPosologia] = useState("");
  const [formato, setFormato] = useState("Comprimido");
  const [cada, setCada] = useState("");
  const [cadaUnidad, setCadaUnidad] = useState("Horas");
  const [via, setVia] = useState("Oral");
  const [durante, setDurante] = useState("");
  const [duranteUnidad, setDuranteUnidad] = useState("Días");
  const [indicaciones, setIndicaciones] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedDrug(null);
      setSearchTerm("");
      setPosologia("");
      setFormato("Comprimido");
      setCada("");
      setCadaUnidad("Horas");
      setVia("Oral");
      setDurante("");
      setDuranteUnidad("Días");
      setIndicaciones("");
    }
  }, [open]);

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return VADECUM_CATALOG.filter((drug) => 
      drug.name.toLowerCase().includes(term) ||
      drug.via.toLowerCase().includes(term) ||
      drug.formato.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const selectDrug = (drug: VademecumDrug) => {
    setSelectedDrug(drug);
    setPosologia(drug.posologia);
    setFormato(drug.formato);
    setCada(drug.cada);
    setCadaUnidad(drug.cadaUnidad);
    setVia(drug.via);
    setDurante(drug.durante);
    setDuranteUnidad(drug.duranteUnidad);
    setIndicaciones(drug.indicaciones);
    setSearchTerm(drug.name);
  };

  const handleSave = () => {
    if (!selectedDrug && !searchTerm.trim()) return;
    
    const drugName = selectedDrug ? selectedDrug.name : searchTerm.trim();
    
    // Format as HTML block for WYSIWYG
    const formatted = `<div><strong>${drugName}</strong></div>` +
      `<div>Posología: ${posologia} ${formato} cada ${cada} ${cadaUnidad} durante ${durante} ${duranteUnidad}. Vía: ${via}.</div>` +
      (indicaciones.trim() ? `<div>Indicaciones: <em>${indicaciones.trim()}</em></div>` : "") +
      `<div><br></div>`;
      
    onSelect(formatted);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Vademécum Odontológico" size="xl">
      <div className="flex flex-col gap-5 text-slate-700">
        <div className="text-xs text-slate-500 bg-blue-50/50 p-2.5 rounded border border-blue-100 flex items-start gap-2">
          <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
          <span>
            Buscador inteligente de fármacos dentales. Comienza a escribir el nombre del fármaco; el sistema te dará sugerencias y autocompletará la posología y vía estándar recomendadas.
          </span>
        </div>

        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <Input
              className="pl-10 h-11 text-base shadow-sm border-slate-200 focus:border-blue-400 focus:ring-blue-400"
              placeholder="Buscar medicamento (ej. Amoxicilina, Ibuprofeno...)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedDrug && e.target.value !== selectedDrug.name) {
                  setSelectedDrug(null);
                }
              }}
            />
          </div>

          {filteredCatalog.length > 0 && !selectedDrug && (
            <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg font-sans">
              {filteredCatalog.map((drug) => (
                <li
                  key={drug.name}
                  onClick={() => selectDrug(drug)}
                  className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100"
                >
                  <div>
                    <span className="font-semibold text-slate-800">{drug.name}</span>
                    <span className="ml-2 text-xs text-slate-400">({drug.formato} • {drug.via})</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Posología Sugerida</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-4 font-sans">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">Configuración de Posología</h4>
          
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Dosis (Posología)</label>
              <Input
                type="text"
                placeholder="ej. 1, 2"
                value={posologia}
                onChange={(e) => setPosologia(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Formato</label>
              <Select value={formato} onChange={(e) => setFormato(e.target.value)}>
                <option value="Comprimido">Comprimido</option>
                <option value="Cápsula">Cápsula</option>
                <option value="Tableta">Tableta</option>
                <option value="Tableta sublingual">Tableta sublingual</option>
                <option value="Ml">Ml</option>
                <option value="Gotas">Gotas</option>
                <option value="Jarabe">Jarabe</option>
                <option value="Suspensión">Suspensión</option>
                <option value="Colutorio">Colutorio</option>
                <option value="Ampolla">Ampolla</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Vía de administración</label>
              <Select value={via} onChange={(e) => setVia(e.target.value)}>
                <option value="Oral">Oral</option>
                <option value="Sublingual">Sublingual</option>
                <option value="Bucal (Enjuague)">Bucal (Enjuague)</option>
                <option value="Tópica">Tópica</option>
                <option value="Intramuscular">Intramuscular</option>
                <option value="Intravenosa">Intravenosa</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 border border-slate-200 rounded-md p-3 bg-white shadow-sm">
              <span className="text-sm font-semibold text-slate-500 shrink-0">Cada:</span>
              <Input
                type="text"
                className="w-20"
                placeholder="ej. 8, 12"
                value={cada}
                onChange={(e) => setCada(e.target.value)}
              />
              <Select className="flex-1" value={cadaUnidad} onChange={(e) => setCadaUnidad(e.target.value)}>
                <option value="Horas">Horas</option>
                <option value="Días">Días</option>
                <option value="Semanas">Semanas</option>
              </Select>
            </div>

            <div className="flex items-center gap-2 border border-slate-200 rounded-md p-3 bg-white shadow-sm">
              <span className="text-sm font-semibold text-slate-500 shrink-0">Durante:</span>
              <Input
                type="text"
                className="w-20"
                placeholder="ej. 5, 7"
                value={durante}
                onChange={(e) => setDurante(e.target.value)}
              />
              <Select className="flex-1" value={duranteUnidad} onChange={(e) => setDuranteUnidad(e.target.value)}>
                <option value="Días">Días</option>
                <option value="Semanas">Semanas</option>
                <option value="Meses">Meses</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">Indicaciones para el paciente</label>
            <Textarea
              rows={2}
              placeholder="Indicaciones adicionales de toma o advertencias..."
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200 font-sans">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-sm"
            onClick={handleSave}
            disabled={!searchTerm.trim() || !posologia || !cada || !durante}
          >
            Añadir a la Receta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
