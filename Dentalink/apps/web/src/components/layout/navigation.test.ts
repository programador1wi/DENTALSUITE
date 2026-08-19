import { describe, expect, it } from "vitest";
import { roleDefinitions } from "@dentalwarner/shared";
import {
  canSee,
  firstAuthorizedPath,
  hasRequiredPermissions,
  visibleNavigation,
  type MenuItem
} from "./navigation";

describe("permission-aware navigation", () => {
  it("supports all, any and system administrator requirements", () => {
    expect(hasRequiredPermissions(["patients.read"], ["patients.read", "patients.update"])).toBe(false);
    expect(hasRequiredPermissions(["patients.read"], ["patients.read", "patients.update"], "any")).toBe(true);
    expect(hasRequiredPermissions(["system.manage_all"], ["settings.read", "branches.read"])).toBe(true);
  });

  it("resolves canonical bundles through hasRequiredPermissions", () => {
    // agenda.view bundles appointments.read
    expect(hasRequiredPermissions(["agenda.view"], "appointments.read")).toBe(true);
    // cash_register.shifts.manage bundles cash_register.read
    expect(hasRequiredPermissions(["cash_register.shifts.manage"], "cash_register.read")).toBe(true);
    // patients.personal_data.view bundles patients.read
    expect(hasRequiredPermissions(["patients.personal_data.view"], "patients.read")).toBe(true);
    // collections.manage bundles accounts_receivable.read
    expect(hasRequiredPermissions(["collections.manage"], "accounts_receivable.read")).toBe(true);
  });

  it("uses the same evaluator for menu items", () => {
    const item: MenuItem = {
      to: "/configuracion/usuarios",
      label: "Usuarios",
      permission: ["users.read", "professionals.read"],
      permissionMode: "any"
    };

    expect(canSee(item, ["professionals.read"])).toBe(true);
    expect(canSee(item, ["patients.read"])).toBe(false);
  });

  it("removes navigation groups when none of their children are authorized", () => {
    const navigation = visibleNavigation([]);

    expect(navigation).toEqual([]);
    expect(navigation.some((item) => item.label === "Administracion")).toBe(false);
  });

  it("selects the first authorized leaf and falls back to profile", () => {
    expect(firstAuthorizedPath(["patients.read"])).toBe("/pacientes");
    expect(firstAuthorizedPath(["settings.read"])).toBe("/configuracion/convenios");
    expect(firstAuthorizedPath([])).toBe("/configuracion/perfil");
  });

  it("computes accurate visible navigation for role: Caja", () => {
    const cashierRole = roleDefinitions.find((r) => r.code === "cashier");
    expect(cashierRole).toBeDefined();

    const nav = visibleNavigation([...cashierRole!.permissionKeys]);
    const labels = nav.map((item) => item.label);

    expect(labels).toContain("Agenda");
    expect(labels).toContain("Pacientes");
    expect(labels).toContain("Cajas");
    expect(labels).toContain("Cobranza");

    const cobranza = nav.find((item) => item.label === "Cobranza");
    expect(cobranza?.children?.map((c) => c.label)).toEqual([
      "Cuentas por cobrar",
      "Pagos recibidos",
      "Recepciones programadas",
      "Cuotas",
      "Gestion de morosidad"
    ]);
  });

  it("computes accurate visible navigation for role: Dentista", () => {
    const dentistRole = roleDefinitions.find((r) => r.code === "dentist");
    expect(dentistRole).toBeDefined();

    const nav = visibleNavigation([...dentistRole!.permissionKeys]);
    const labels = nav.map((item) => item.label);

    expect(labels).toContain("Agenda");
    expect(labels).toContain("Pacientes");
    expect(labels).not.toContain("Cajas");
  });

  it("computes accurate visible navigation for role: Recepcionista", () => {
    const receptionistRole = roleDefinitions.find((r) => r.code === "receptionist");
    expect(receptionistRole).toBeDefined();

    const nav = visibleNavigation([...receptionistRole!.permissionKeys]);
    const labels = nav.map((item) => item.label);

    expect(labels).toContain("Agenda");
    expect(labels).toContain("Pacientes");
    expect(labels).toContain("Cajas");
    expect(labels).toContain("CRM");
  });
});

