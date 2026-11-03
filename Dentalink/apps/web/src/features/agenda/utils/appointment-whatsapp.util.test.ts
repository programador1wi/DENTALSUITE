import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLink,
  formatRelativeAppointmentTime,
  generateWhatsAppMessage,
  normalizeE164Phone
} from "./appointment-whatsapp.util";
import type { Appointment } from "../services/appointments.service";

describe("appointment-whatsapp.util", () => {
  describe("normalizeE164Phone", () => {
    it("should return null for null, undefined or short strings", () => {
      expect(normalizeE164Phone(null)).toBeNull();
      expect(normalizeE164Phone("")).toBeNull();
      expect(normalizeE164Phone("123")).toBeNull();
    });

    it("should format 10-digit number with default country code 52", () => {
      expect(normalizeE164Phone("7228834288")).toBe("527228834288");
      expect(normalizeE164Phone("(722) 883-4288")).toBe("527228834288");
    });

    it("should keep already prefixed numbers", () => {
      expect(normalizeE164Phone("+527228834288")).toBe("527228834288");
      expect(normalizeE164Phone("+15551234567")).toBe("15551234567");
    });
  });

  describe("formatRelativeAppointmentTime", () => {
    it("should format today correctly", () => {
      const base = new Date("2026-08-19T10:00:00.000Z");
      const appDate = "2026-08-19T14:30:00.000Z";
      const res = formatRelativeAppointmentTime(appDate, base);
      expect(res.isToday).toBe(true);
      expect(res.dateLabel).toBe("hoy");
      expect(res.timeLabel).toContain("hoy a las");
    });

    it("should format tomorrow correctly", () => {
      const base = new Date("2026-08-19T10:00:00.000Z");
      const appDate = "2026-08-20T14:30:00.000Z";
      const res = formatRelativeAppointmentTime(appDate, base);
      expect(res.isTomorrow).toBe(true);
      expect(res.dateLabel).toBe("mañana");
      expect(res.timeLabel).toContain("mañana a las");
    });

    it("should format future dates with weekday and date", () => {
      const base = new Date("2026-08-19T10:00:00.000Z");
      const appDate = "2026-08-25T14:30:00.000Z";
      const res = formatRelativeAppointmentTime(appDate, base);
      expect(res.isToday).toBe(false);
      expect(res.isTomorrow).toBe(false);
      expect(res.dateLabel).toContain("el");
    });
  });

  describe("generateWhatsAppMessage", () => {
    const mockAppointment: Appointment = {
      id: "app-1",
      organizationId: "org-1",
      branchId: "branch-1",
      professionalId: "prof-1",
      status: "SCHEDULED",
      title: "Consulta",
      startAt: "2026-08-20T12:00:00.000Z",
      endAt: "2026-08-20T12:30:00.000Z",
      durationMinutes: 30,
      branch: { id: "branch-1", name: "Sucursal Central" },
      patient: {
        id: "pat-1",
        firstName: "Myrna",
        lastName: "Reyes",
        phone: "7228834288"
      },
      professional: {
        id: "prof-1",
        firstName: "Jose",
        lastName: "Rivas"
      }
    };

    it("should interpolate patient, professional, branch and relative time in confirmation template", () => {
      const msg = generateWhatsAppMessage(mockAppointment, "confirmation", new Date("2026-08-19T10:00:00.000Z"));
      expect(msg).toContain("Myrna Reyes");
      expect(msg).toContain("Dr(a). Jose Rivas");
      expect(msg).toContain("Sucursal Central");
      expect(msg).toContain("CONFIRMAR");
      expect(msg).toContain("mañana a las");
    });

    it("should build direct WhatsApp Web link by default", () => {
      const link = buildWhatsAppLink("7228834288", "Hola Myrna");
      expect(link).toBe("https://web.whatsapp.com/send?phone=527228834288&text=Hola%20Myrna");
    });

    it("should build direct WhatsApp Desktop App link when target is app", () => {
      const link = buildWhatsAppLink("7228834288", "Hola Myrna", "app");
      expect(link).toBe("whatsapp://send?phone=527228834288&text=Hola%20Myrna");
    });
  });
});
