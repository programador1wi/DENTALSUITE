import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type BranchOption = { id: string; name: string };

export function ReportsFilters({
  dateFrom,
  dateTo,
  branchId,
  branches,
  onDateFromChange,
  onDateToChange,
  onBranchChange,
  onExportCsv,
  onExportXlsx
}: {
  dateFrom: string;
  dateTo: string;
  branchId: string;
  branches: BranchOption[];
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onExportCsv?: () => void;
  onExportXlsx?: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-zinc-200/60 bg-white p-3 md:grid-cols-5 shadow-none">
      <Input
        type="date"
        value={dateFrom}
        onChange={(event) => onDateFromChange(event.target.value)}
        className="h-10"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(event) => onDateToChange(event.target.value)}
        className="h-10"
      />
      <Select
        value={branchId}
        onChange={(event) => onBranchChange(event.target.value)}
        className="h-10"
      >
        <option value="">Sucursal activa</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </Select>
      <Button
        variant="secondary"
        onClick={onExportCsv}
        disabled={!onExportCsv}
        className="h-10 w-full"
      >
        Exportar CSV
      </Button>
      <Button
        variant="secondary"
        onClick={onExportXlsx}
        disabled={!onExportXlsx}
        className="h-10 w-full"
      >
        Exportar XLSX
      </Button>
    </div>
  );
}

