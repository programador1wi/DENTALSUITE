import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const mockSettlements = [
  { id: "LIQ-001", doctor: "Dr. Juan Pérez", period: "1 May - 15 May 2026", total: 450000, status: "PAGADO", date: "16 May 2026" },
  { id: "LIQ-002", doctor: "Dra. María González", period: "1 May - 15 May 2026", total: 320000, status: "PENDIENTE", date: "-" },
  { id: "LIQ-003", doctor: "Dr. Carlos Ruiz", period: "16 Abr - 30 Abr 2026", total: 580000, status: "PAGADO", date: "02 May 2026" },
];

export function PayrollPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <PageHeader title="Liquidaciones de Profesionales" description="Gestiona el pago de honorarios y comisiones por tratamientos realizados." />
        <Button className="bg-[#0679c8] hover:bg-[#0566a8] text-white">
          Generar Liquidación
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar por profesional o ID..." className="pl-9" />
          </div>
          <Select className="w-48">
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="paid">Pagados</option>
          </Select>
          <Select className="w-48">
            <option value="current">Mes actual</option>
            <option value="previous">Mes anterior</option>
          </Select>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID Liquidación</th>
                <th className="px-4 py-3">Profesional</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha Pago</th>
                <th className="px-4 py-3 text-right">Monto Total</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {mockSettlements.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.id}</td>
                  <td className="px-4 py-3 text-slate-700">{item.doctor}</td>
                  <td className="px-4 py-3 text-slate-500">{item.period}</td>
                  <td className="px-4 py-3">
                    <Badge 
                      value={item.status} 
                      tone={item.status === "PAGADO" ? "success" : "warning"} 
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.date}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    ${item.total.toLocaleString("es-CL")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="text-[#0679c8] hover:bg-sky-50">
                      <FileText className="w-4 h-4 mr-2" /> Ver detalle
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 ml-2">
                      <Download className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
