import { ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useOrganizationSettings, useUpdateOrganizationSettings } from "../hooks/use-organization";

function readLogo(event: ChangeEvent<HTMLInputElement>, onLoaded: (value: string) => void, onError: (message: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== "image/jpeg") {
    onError("El logotipo debe ser una imagen JPG.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => onLoaded(String(reader.result ?? ""));
  reader.onerror = () => onError("No se pudo leer el archivo seleccionado.");
  reader.readAsDataURL(file);
}

export function OrganizationLogoSettingsPage() {
  const organization = useOrganizationSettings();
  const update = useUpdateOrganizationSettings();
  const [draftLogo, setDraftLogo] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (organization.isLoading) return <LoadingState message="Cargando logotipo..." />;
  if (organization.isError) return <ErrorState message={organization.error.message} />;

  const logoUrl = draftLogo ?? organization.data?.logoUrl ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logotipo"
        description="Imagen institucional para documentos generados por la clinica."
        helpText="Warner Suite usa el logotipo en presupuestos, recetas y documentos clinicos. Usa un JPG horizontal, idealmente de 230 x 76 px."
      />

      <Card className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <label className="text-sm font-medium text-slate-700">
            Archivo JPG
            <input
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              type="file"
              accept="image/jpeg"
              onChange={(event) => readLogo(event, (value) => {
                setError("");
                setDraftLogo(value);
              }, setError)}
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Vista previa</p>
            {logoUrl ? (
              <img src={logoUrl} alt="Logotipo de la clinica" className="h-[76px] max-w-[230px] object-contain" />
            ) : (
              <p className="text-sm text-slate-500">No hay logotipo configurado.</p>
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => update.mutate({ logoUrl })}
            disabled={update.isPending || logoUrl === (organization.data?.logoUrl ?? "")}
          >
            {update.isPending ? "Guardando..." : "Guardar logotipo"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraftLogo("");
              update.mutate({ logoUrl: "" });
            }}
            disabled={update.isPending || !logoUrl}
          >
            Eliminar logotipo
          </Button>
        </div>
      </Card>
    </div>
  );
}
