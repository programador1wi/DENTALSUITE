import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardList, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMergePatients, usePatient } from "../hooks/use-patients";

function PatientPreview({ id, title }: { id: string; title: string }) {
  const patient = usePatient(id || undefined);
  
  return (
    <div className="mt-8 flex flex-col gap-2">
      <div className="flex items-center gap-4 text-sm font-bold text-slate-800">
        <span className="text-slate-600">#</span>
        <span>{title}</span>
      </div>
      
      {id ? (
        patient.isLoading ? (
          <p className="text-sm text-slate-500 pl-7">Cargando...</p>
        ) : patient.data ? (
          <div className="pl-7">
            <p className="text-base font-semibold text-slate-900">
              {patient.data.firstName} {patient.data.lastName}
            </p>
            <p className="text-sm text-slate-500">
              {patient.data.documentNumber || patient.data.email || patient.data.phone || patient.data.id}
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-500 pl-7">Ficha no encontrada.</p>
        )
      ) : null}
    </div>
  );
}

export function PatientMergePage() {
  const [targetPatientId, setTargetPatientId] = useState("");
  const [sourcePatientId, setSourcePatientId] = useState("");
  const merge = useMergePatients();

  const submit = (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    if (
      !targetPatientId.trim() ||
      !sourcePatientId.trim() ||
      targetPatientId.trim() === sourcePatientId.trim()
    ) {
      return;
    }
    merge.mutate({
      targetPatientId: targetPatientId.trim(),
      sourcePatientId: sourcePatientId.trim(),
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Header de la tarjeta principal */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-5 py-3">
          <div className="flex items-center gap-2 text-slate-600">
            <ClipboardList className="h-5 w-5" />
            <h1 className="text-base font-semibold">Fusionar fichas clientes</h1>
          </div>
          <Button
            type="button"
            disabled={merge.isPending || !targetPatientId || !sourcePatientId}
            onClick={() => submit()}
            className="bg-[#7fb37f] hover:bg-[#6fa06f] text-white border-transparent"
          >
            {merge.isPending ? "Fusionando..." : "Fusionar fichas"}
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Alerta Azul */}
          <div className="rounded border border-sky-200 bg-[#eef6f9] p-4 text-sm text-sky-800 space-y-3">
            <div className="flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#3b82f6]" />
              <p>
                Ingrese CURP/RFC o nombre del paciente que desea mantener activo (principal) y del
                paciente que será fusionado (secundario), luego presione el botón{" "}
                <span className="font-bold">Fusionar fichas</span> para realizar la operación.
              </p>
            </div>
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#3b82f6] fill-sky-100" />
              <p>
                <span className="font-bold">IMPORTANTE:</span> una vez realizada la fusión tendrás
                que confirmar los cambios, ya que estos serán irreversibles.
              </p>
            </div>
          </div>

          {/* Tarjetas de Fichas */}
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-6">
            {/* Tarjeta Principal */}
            <Card className="rounded-none border-slate-200 shadow-none p-6 pb-12">
              <h2 className="text-base font-bold text-slate-800 mb-6">
                Paciente que tendrá toda la información
              </h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-700 whitespace-nowrap">
                  Paciente principal
                </label>
                <ArrowRight className="h-4 w-4 text-slate-700 shrink-0" />
                <Input
                  className="rounded-sm border-slate-300 text-sm h-9"
                  placeholder="Ingrese CURP/RFC o nombre"
                  value={targetPatientId}
                  onChange={(e) => setTargetPatientId(e.target.value)}
                />
              </div>
              <PatientPreview id={targetPatientId.trim()} title="Paciente principal" />
            </Card>

            {/* Tarjeta Secundaria */}
            <Card className="rounded-none border-slate-200 shadow-none p-6 pb-12">
              <h2 className="text-base font-bold text-slate-800 mb-6">
                Este paciente quedará deshabilitado
              </h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-700 whitespace-nowrap">
                  Paciente secundario
                </label>
                <ArrowRight className="h-4 w-4 text-slate-700 shrink-0" />
                <Input
                  className="rounded-sm border-slate-300 text-sm h-9"
                  placeholder="Ingrese CURP/RFC o nombre"
                  value={sourcePatientId}
                  onChange={(e) => setSourcePatientId(e.target.value)}
                />
              </div>
              <PatientPreview id={sourcePatientId.trim()} title="Paciente secundario" />
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
