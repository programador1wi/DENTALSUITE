import { useParams } from "react-router-dom";
import { FormEvent, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSectionPage } from "../components/patient-section-page";
import { useDocumentsMutations, usePatientFiles } from "@/features/documents/hooks/use-documents";

export function PatientFilesPage() {
  const { id = "" } = useParams();
  const [category, setCategory] = useState("");
  const [fileName, setFileName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [size, setSize] = useState("");
  const [url, setUrl] = useState("");
  const [newCategory, setNewCategory] = useState("CLINICAL");

  const files = usePatientFiles(id, category || undefined);
  const mutations = useDocumentsMutations();

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !fileName.trim() || !originalName.trim() || !mimeType.trim() || !url.trim() || Number(size) <= 0 || !newCategory.trim()) return;
    mutations.uploadPatientFile.mutate({
      patientId: id,
      fileName: fileName.trim(),
      originalName: originalName.trim(),
      mimeType: mimeType.trim(),
      size: Number(size),
      url: url.trim(),
      category: newCategory.trim()
    });
  };

  if (files.isLoading) return <LoadingState message="Cargando archivos..." />;
  if (files.isError) return <ErrorState message={files.error.message} />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Archivos" description="Documentos y adjuntos del paciente.">
      <Card>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleUpload}>
          <Input placeholder="Nombre interno" value={fileName} onChange={(event) => setFileName(event.target.value)} />
          <Input placeholder="Nombre original" value={originalName} onChange={(event) => setOriginalName(event.target.value)} />
          <Input placeholder="Mime type" value={mimeType} onChange={(event) => setMimeType(event.target.value)} />
          <Input type="number" min="1" placeholder="Tamanio bytes" value={size} onChange={(event) => setSize(event.target.value)} />
          <Input placeholder="URL del archivo" value={url} onChange={(event) => setUrl(event.target.value)} />
          <Input placeholder="Categoria" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
          <Button type="submit" disabled={mutations.uploadPatientFile.isPending}>Registrar archivo</Button>
        </form>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todas las categorias</option>
            <option value="CLINICAL">CLINICAL</option>
            <option value="XRAY">XRAY</option>
            <option value="PHOTO">PHOTO</option>
            <option value="CONSENT">CONSENT</option>
            <option value="OTHER">OTHER</option>
          </Select>
        </div>
      </Card>

      <DataTable
        rows={files.data ?? []}
        empty={<EmptyState title="Sin archivos" description="No hay archivos cargados para este paciente." />}
        columns={[
          { key: "createdAt", title: "Fecha", render: (row) => new Date(row.createdAt).toLocaleString() },
          { key: "category", title: "Categoria" },
          { key: "originalName", title: "Nombre" },
          { key: "mimeType", title: "Mime" },
          { key: "size", title: "Tamano", render: (row) => `${row.size} bytes` },
          {
            key: "url",
            title: "Archivo",
            render: (row) => (
              <a href={row.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                Abrir
              </a>
            )
          }
        ]}
      />
    </PatientSectionPage>
  );
}
