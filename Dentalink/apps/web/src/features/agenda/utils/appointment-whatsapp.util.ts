import type { Appointment } from "../services/appointments.service";

export type WhatsAppTemplateType = "confirmation" | "reminder" | "urgent" | "custom";

export interface WhatsAppTemplateOption {
  id: WhatsAppTemplateType;
  label: string;
  description: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateOption[] = [
  {
    id: "confirmation",
    label: "Confirmación de cita",
    description: "Solicita confirmación explícita al paciente (SÍ / CONFIRMAR)"
  },
  {
    id: "reminder",
    label: "Recordatorio estándar",
    description: "Aviso preventivo con datos de la cita y contacto de la clínica"
  },
  {
    id: "urgent",
    label: "Próxima atención / Urgente",
    description: "Para citas del mismo día o a pocas horas de iniciar"
  },
  {
    id: "custom",
    label: "Mensaje libre",
    description: "Plantilla básica editable"
  }
];

export function normalizeE164Phone(phone?: string | null, defaultCountryCode = "52"): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;

  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }

  return digits;
}

export function formatRelativeAppointmentTime(
  startAtString: string,
  nowDate = new Date()
): { timeLabel: string; dateLabel: string; isToday: boolean; isTomorrow: boolean } {
  const startAt = new Date(startAtString);
  if (Number.isNaN(startAt.getTime())) {
    return { timeLabel: "tu cita", dateLabel: "tu cita", isToday: false, isTomorrow: false };
  }

  const timeStr = startAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

  const startDay = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
  const nowDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const diffDays = Math.round((startDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));

  const isToday = diffDays === 0;
  const isTomorrow = diffDays === 1;

  if (isToday) {
    return {
      isToday: true,
      isTomorrow: false,
      dateLabel: "hoy",
      timeLabel: `hoy a las ${timeStr} hrs`
    };
  }

  if (isTomorrow) {
    return {
      isToday: false,
      isTomorrow: true,
      dateLabel: "mañana",
      timeLabel: `mañana a las ${timeStr} hrs`
    };
  }

  const dayOfWeek = startAt.toLocaleDateString("es-MX", { weekday: "long" });
  const dayOfMonth = startAt.getDate();
  const monthName = startAt.toLocaleDateString("es-MX", { month: "long" });
  const fullDateLabel = `el ${dayOfWeek} ${dayOfMonth} de ${monthName}`;

  return {
    isToday: false,
    isTomorrow: false,
    dateLabel: fullDateLabel,
    timeLabel: `${fullDateLabel} a las ${timeStr} hrs`
  };
}

export function generateWhatsAppMessage(
  appointment: Appointment,
  templateType: WhatsAppTemplateType = "confirmation",
  nowDate = new Date()
): string {
  const patientName = appointment.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim()
    : "Paciente";

  const doctorName = appointment.professional
    ? `Dr(a). ${appointment.professional.firstName} ${appointment.professional.lastName}`.trim()
    : "nuestro profesional";

  const branchName = appointment.branch?.name || "nuestra clínica";
  const { timeLabel } = formatRelativeAppointmentTime(appointment.startAt, nowDate);

  switch (templateType) {
    case "confirmation":
      return `¡Hola ${patientName}! Te recordamos tu cita dental con el ${doctorName} programada para *${timeLabel}* en *${branchName}*.\n\nPor favor, responde a este mensaje con un *SÍ* o *CONFIRMAR* para asegurar tu lugar. ¡Te esperamos!`;

    case "reminder":
      return `¡Hola ${patientName}! Te recordamos tu cita dental con el ${doctorName} programada para *${timeLabel}* en *${branchName}*.\n\nSi necesitas reagendar o tienes dudas, por favor contáctanos con anticipación. ¡Saludos!`;

    case "urgent":
      return `¡Hola ${patientName}! Te escribimos de *${branchName}* para recordarte que tu cita con el ${doctorName} es *${timeLabel}*.\n\nPor favor confírmanos a la brevedad si vas en camino. ¡Muchas gracias!`;

    case "custom":
    default:
      return `¡Hola ${patientName}! Te escribimos de *${branchName}* referente a tu cita dental del *${timeLabel}* con el ${doctorName}.`;
  }
}

export type WhatsAppClientTarget = "web" | "app";

export function buildWhatsAppLink(
  phone: string,
  message: string,
  target: WhatsAppClientTarget = "web"
): string {
  const cleanPhone = normalizeE164Phone(phone) || phone.replace(/\D/g, "");
  const encodedText = encodeURIComponent(message);

  if (target === "app") {
    return `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  }

  return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}
