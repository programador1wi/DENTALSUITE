import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PatientSubnav } from "../components/patient-subnav";
import { usePatient } from "../hooks/use-patients";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { CheckCircle2, Clock, Mail, MessageSquare, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function PatientCrmPage() {
  const { id = "" } = useParams();
  const patientQuery = usePatient(id);
  const [activeTab, setActiveTab] = useState<"tasks" | "communications">("tasks");

  if (patientQuery.isLoading) return <LoadingState message="Cargando paciente..." />;
  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;
  const patient = patientQuery.data;

  if (!patient) return <ErrorState message="Paciente no encontrado" />;

  return (
    <div className="space-y-4">
      <PageHeader title={`Paciente: ${patient.firstName} ${patient.lastName}`} description="Gestión de tareas de seguimiento y registro de comunicaciones." />
      <PatientSubnav patientId={id} />

      <div className="flex border-b border-slate-200 mb-6 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "pb-3 border-b-2 transition-colors",
            activeTab === "tasks" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Tareas de Seguimiento
        </button>
        <button
          onClick={() => setActiveTab("communications")}
          className={cn(
            "pb-3 border-b-2 transition-colors",
            activeTab === "communications" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Registro de Comunicaciones
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {activeTab === "tasks" && (
          <>
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6 flex flex-col items-center justify-center text-slate-500 min-h-[300px]">
                <CheckCircle2 className="w-12 h-12 text-slate-300 mb-4" />
                <p className="font-medium text-slate-700">No hay tareas pendientes</p>
                <p className="text-sm">Las tareas que crees aparecerán aquí.</p>
              </Card>
            </div>
            <div>
              <Card className="p-4 bg-slate-50">
                <h3 className="font-semibold text-slate-800 mb-4">Nueva Tarea</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                    <Input placeholder="Ej: Llamar para control" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                    <Textarea placeholder="Detalles de la tarea..." rows={3} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
                    <Input type="date" />
                  </div>
                  <Button className="w-full bg-[#0679c8] hover:bg-[#0566a8] text-white">
                    <Plus className="w-4 h-4 mr-2" /> Agregar tarea
                  </Button>
                </div>
              </Card>
            </div>
          </>
        )}

        {activeTab === "communications" && (
          <>
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6 flex flex-col items-center justify-center text-slate-500 min-h-[300px]">
                <Mail className="w-12 h-12 text-slate-300 mb-4" />
                <p className="font-medium text-slate-700">No hay comunicaciones registradas</p>
                <p className="text-sm">Aquí se guardará el historial de emails y SMS.</p>
              </Card>
            </div>
            <div>
              <Card className="p-4 bg-slate-50">
                <h3 className="font-semibold text-slate-800 mb-4">Registrar / Enviar</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select className="w-full border-slate-300 rounded-md text-sm px-3 py-2 outline-none">
                      <option>Correo Electrónico (Email)</option>
                      <option>Mensaje de Texto (SMS)</option>
                      <option>Llamada Telefónica (Log)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje / Notas</label>
                    <Textarea placeholder="Escribe el mensaje o las notas de la llamada..." rows={4} />
                  </div>
                  <Button className="w-full bg-[#5cb85c] hover:bg-[#4cae4c] text-white">
                    <Send className="w-4 h-4 mr-2" /> Guardar registro
                  </Button>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
