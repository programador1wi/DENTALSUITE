import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { useOrganizationSettings, useUpdateOrganizationSettings } from "../hooks/use-organization";

type FormValues = {
  organizationName: string;
  legalName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
};

export function OrganizationSettingsPage() {
  const organization = useOrganizationSettings();
  const update = useUpdateOrganizationSettings();
  const form = useForm<FormValues>({
    defaultValues: {
      organizationName: "",
      legalName: "",
      taxId: "",
      phone: "",
      email: "",
      address: ""
    }
  });

  useEffect(() => {
    if (!organization.data) return;
    form.reset({
      organizationName: organization.data.organizationName ?? "",
      legalName: organization.data.legalName ?? "",
      taxId: organization.data.taxId ?? "",
      phone: organization.data.phone ?? "",
      email: organization.data.email ?? "",
      address: organization.data.address ?? ""
    });
  }, [organization.data, form]);

  if (organization.isLoading) return <LoadingState message="Cargando organizacion..." />;
  if (organization.isError) return <ErrorState message={organization.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Organizacion" description="Configuracion general corporativa" />

      <Card>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit(async (values) => {
            await update.mutateAsync(values);
          })}
        >
          <label className="text-sm">
            Nombre
            <Input {...form.register("organizationName")} />
          </label>
          <label className="text-sm">
            Razon social
            <Input {...form.register("legalName")} />
          </label>
          <label className="text-sm">
            RFC / Tax ID
            <Input {...form.register("taxId")} />
          </label>
          <label className="text-sm">
            Telefono
            <Input {...form.register("phone")} />
          </label>
          <label className="text-sm">
            Email
            <Input type="email" {...form.register("email")} />
          </label>
          <label className="text-sm md:col-span-2">
            Direccion
            <Input {...form.register("address")} />
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Guardando..." : "Guardar configuracion"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
