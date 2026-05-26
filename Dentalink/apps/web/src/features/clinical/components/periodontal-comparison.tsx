import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { PeriodontalComparison } from "../services/clinical.service";

export function PeriodontalComparison({ comparison }: { comparison?: PeriodontalComparison }) {
  if (!comparison) {
    return <EmptyState title="Comparacion pendiente" description="Selecciona dos periodontogramas para comparar evolucion periodontal." />;
  }

  return (
    <Card className="overflow-auto p-0">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-2 py-2 text-left">Pieza</th>
            <th className="px-2 py-2 text-left">Posicion</th>
            <th className="px-2 py-2 text-left">Delta prof.</th>
            <th className="px-2 py-2 text-left">Delta recesion</th>
            <th className="px-2 py-2 text-left">Delta movilidad</th>
            <th className="px-2 py-2 text-left">Sangrado</th>
            <th className="px-2 py-2 text-left">Placa</th>
            <th className="px-2 py-2 text-left">Supuracion</th>
          </tr>
        </thead>
        <tbody>
          {comparison.items.map((item) => (
            <tr key={`${item.toothNumber}-${item.position}`} className="border-b border-slate-200">
              <td className="px-2 py-2">{item.toothNumber}</td>
              <td className="px-2 py-2">{item.position}</td>
              <td className="px-2 py-2">{item.probingDepthDelta}</td>
              <td className="px-2 py-2">{item.recessionDelta}</td>
              <td className="px-2 py-2">{item.mobilityDelta}</td>
              <td className="px-2 py-2">{item.bleedingChanged ? "Cambio" : "-"}</td>
              <td className="px-2 py-2">{item.plaqueChanged ? "Cambio" : "-"}</td>
              <td className="px-2 py-2">{item.suppurationChanged ? "Cambio" : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
