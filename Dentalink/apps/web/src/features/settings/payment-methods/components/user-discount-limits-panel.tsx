import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useUpdateUserDiscountPolicy, useUserDiscountPolicies } from "../hooks/use-discount-policies";

export function UserDiscountLimitsPanel() {
  const [search, setSearch] = useState("");
  const [permission, setPermission] = useState<"WITH_PERMISSION" | "WITHOUT_PERMISSION" | "ALL">(
    "WITH_PERMISSION"
  );
  const [active, setActive] = useState<"true" | "false" | "all">("true");
  const [values, setValues] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const policies = useUserDiscountPolicies({ search: search.trim() || undefined, permission, active });
  const updatePolicy = useUpdateUserDiscountPolicy();

  useEffect(() => {
    if (!policies.data) return;
    setValues((current) => {
      const next = { ...current };
      for (const row of policies.data) {
        if (next[row.id] === undefined) next[row.id] = row.maximumDiscountPercent;
      }
      return next;
    });
  }, [policies.data]);

  const configuredCount = useMemo(
    () => policies.data?.filter((row) => Number(row.maximumDiscountPercent) > 0).length ?? 0,
    [policies.data]
  );

  const saveRow = async (userId: string, currentValue: string, version: number | null) => {
    const next = Number(values[userId]);
    if (!Number.isFinite(next) || next < 0 || next > 100 || !/^\d{1,3}(\.\d{1,2})?$/.test(values[userId] ?? "")) {
      setRowError((errors) => ({ ...errors, [userId]: "Ingresa un porcentaje entre 0 y 100 con máximo 2 decimales." }));
      return;
    }
    if (next === Number(currentValue)) return;
    setRowError((errors) => ({ ...errors, [userId]: "" }));
    try {
      await updatePolicy.mutateAsync({
        userId,
        maximumDiscountPercent: next,
        expectedVersion: version ?? undefined
      });
    } catch (error) {
      setRowError((errors) => ({
        ...errors,
        [userId]: error instanceof Error ? error.message : "No fue posible guardar el límite."
      }));
    }
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <Card className="overflow-hidden border-[var(--border-brand-light)] bg-[linear-gradient(120deg,var(--bg-surface),var(--bg-brand-light))]">
        <div className="flex flex-col gap-[var(--space-4)] xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--action-brand)] text-white">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[var(--text-lg)] font-semibold text-[var(--text-primary)]">
                  Límites de descuento por usuario
                </h2>
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                  Configura el porcentaje máximo que cada usuario autorizado puede aplicar en tratamientos.
                </p>
              </div>
            </div>
            <p className="mt-[var(--space-3)] text-[var(--text-xs)] text-[var(--text-secondary)]">
              El máximo real siempre será el menor entre límite del usuario y límite de la prestación.
            </p>
          </div>
          <div className="flex gap-[var(--space-2)]">
            <Badge value={`${policies.data?.length ?? 0} usuarios`} tone="brand" />
            <Badge value={`${configuredCount} configurados`} tone="success" />
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-[var(--space-3)] md:grid-cols-[minmax(240px,1fr)_220px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar usuario o correo"
              className="pl-10"
            />
          </div>
          <Select value={permission} onChange={(event) => setPermission(event.target.value as typeof permission)}>
            <option value="WITH_PERMISSION">Con permiso</option>
            <option value="WITHOUT_PERMISSION">Sin permiso</option>
            <option value="ALL">Todos</option>
          </Select>
          <Select value={active} onChange={(event) => setActive(event.target.value as typeof active)}>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
            <option value="all">Todos los estados</option>
          </Select>
        </div>
      </Card>

      {policies.isLoading ? <LoadingState message="Cargando límites de descuento..." /> : null}
      {policies.isError ? <ErrorState message={policies.error.message} /> : null}
      {policies.data && !policies.data.length ? (
        <EmptyState title="Sin usuarios" description="No hay usuarios que coincidan con filtros actuales." />
      ) : null}

      {policies.data?.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-[var(--text-sm)]">
              <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Permiso</th>
                  <th className="px-4 py-3 text-center">Máximo autorizado</th>
                  <th className="px-4 py-3">Último cambio</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {policies.data.map((row) => {
                  const changed = Number(values[row.id]) !== Number(row.maximumDiscountPercent);
                  const invalidPermission = !row.hasPermission;
                  return (
                    <tr key={row.id} className="border-t border-[var(--border-default)] align-top hover:bg-[var(--bg-subtle)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--text-primary)]">{row.name}</p>
                        <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{row.email}</p>
                        {!row.isActive ? <Badge value="Inactivo" tone="warning" /> : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]">{row.role}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.hasPermission ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" /> Permitir descuento
                          </span>
                        ) : (
                          <div>
                            <Badge value="Sin permiso" tone="warning" />
                            <p className="mt-1 max-w-56 text-[var(--text-xs)] text-[var(--text-secondary)]">
                              Asigna permiso Permitir descuento para configurar límite.
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="mx-auto flex w-36 items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={invalidPermission ? "0.00" : values[row.id] ?? row.maximumDiscountPercent}
                            disabled={invalidPermission || !row.isActive}
                            onChange={(event) => setValues((current) => ({ ...current, [row.id]: event.target.value }))}
                            onWheel={(event) => event.currentTarget.blur()}
                            className="text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            aria-label={`Máximo de descuento para ${row.name}`}
                          />
                          <span className="font-semibold text-[var(--text-secondary)]">%</span>
                        </div>
                        {rowError[row.id] ? <p className="mt-1 text-center text-xs text-red-600">{rowError[row.id]}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-xs)] text-[var(--text-secondary)]">
                        {row.updatedAt ? (
                          <>
                            <span className="block">{new Date(row.updatedAt).toLocaleString("es-MX")}</span>
                            <span className="block">por {row.updatedByName ?? "Usuario no disponible"}</span>
                          </>
                        ) : (
                          "Sin configuración"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={changed ? "primary" : "secondary"}
                          disabled={!changed || invalidPermission || updatePolicy.isPending}
                          onClick={() => void saveRow(row.id, row.maximumDiscountPercent, row.policyVersion)}
                        >
                          {updatePolicy.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
