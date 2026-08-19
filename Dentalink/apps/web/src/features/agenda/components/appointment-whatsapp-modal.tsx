import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, MessageCircle, Phone, RotateCcw, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APP_ROUTES } from "@/lib/routes";
import type { Appointment } from "../services/appointments.service";
import {
  buildWhatsAppLink,
  formatRelativeAppointmentTime,
  generateWhatsAppMessage,
  normalizeE164Phone,
  WHATSAPP_TEMPLATES,
  type WhatsAppClientTarget,
  type WhatsAppTemplateType
} from "../utils/appointment-whatsapp.util";

interface AppointmentWhatsAppModalProps {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
  onNotifyWhatsApp: (appointmentId: string) => Promise<void>;
}

export function AppointmentWhatsAppModal({
  appointment,
  open,
  onClose,
  onNotifyWhatsApp
}: AppointmentWhatsAppModalProps) {
  const navigate = useNavigate();
  const [templateType, setTemplateType] = useState<WhatsAppTemplateType>("confirmation");
  const [clientTarget, setClientTarget] = useState<WhatsAppClientTarget>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("preferred_whatsapp_client");
      if (saved === "web" || saved === "app") return saved;
    }
    return "web";
  });
  const [message, setMessage] = useState("");
  const [selectedPhoneType, setSelectedPhoneType] = useState<"primary" | "alternate">("primary");
  const [submitting, setSubmitting] = useState(false);

  const handleClientTargetChange = (target: WhatsAppClientTarget) => {
    setClientTarget(target);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_whatsapp_client", target);
    }
  };

  const patient = appointment?.patient;
  const primaryPhone = patient?.phone?.trim() || null;
  const alternatePhone = (patient as { alternatePhone?: string | null })?.alternatePhone?.trim() || null;

  const activeRawPhone = selectedPhoneType === "alternate" && alternatePhone ? alternatePhone : primaryPhone;
  const normalizedPhone = useMemo(() => normalizeE164Phone(activeRawPhone), [activeRawPhone]);

  // Generate template whenever appointment or templateType changes
  useEffect(() => {
    if (!appointment) return;
    const generated = generateWhatsAppMessage(appointment, templateType);
    setMessage(generated);
  }, [appointment, templateType]);

  // Set default phone type
  useEffect(() => {
    if (primaryPhone) {
      setSelectedPhoneType("primary");
    } else if (alternatePhone) {
      setSelectedPhoneType("alternate");
    }
  }, [primaryPhone, alternatePhone]);

  if (!appointment) return null;

  const relativeTime = formatRelativeAppointmentTime(appointment.startAt);
  const patientFullName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Paciente";
  const doctorFullName = appointment.professional
    ? `Dr(a). ${appointment.professional.firstName} ${appointment.professional.lastName}`.trim()
    : "Sin profesional asignado";

  const handleResetTemplate = () => {
    setMessage(generateWhatsAppMessage(appointment, templateType));
    toast.info("Plantilla restablecida");
  };

  const handleCopyText = async () => {
    if (!message) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = message;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success("Mensaje copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el texto");
    }
  };

  const handleOpenWhatsAppAndNotify = async () => {
    if (!normalizedPhone) {
      toast.error("El paciente no tiene un número válido");
      return;
    }

    const waLink = buildWhatsAppLink(normalizedPhone, message, clientTarget);
    if (clientTarget === "app") {
      const link = document.createElement("a");
      link.href = waLink;
      link.click();
    } else {
      window.open(waLink, "_blank", "noopener,noreferrer");
    }

    setSubmitting(true);
    try {
      await onNotifyWhatsApp(appointment.id);
      toast.success(
        clientTarget === "app"
          ? "App de WhatsApp abierta y cita marcada como Notificada"
          : "WhatsApp Web abierto y cita marcada como Notificada"
      );
      onClose();
    } catch (err) {
      toast.error("No se pudo actualizar el estado de la cita");
    } finally {
      setSubmitting(false);
    }
  };

  const goToPatientProfile = () => {
    if (!patient?.id) return;
    navigate(APP_ROUTES.patients.profile(patient.id));
    onClose();
  };

  return (
    <Modal open={open} title="Contactar paciente por WhatsApp" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Context Summary Header */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-[var(--text-xs)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 mb-2">
            <div className="font-semibold text-[var(--text-primary)] text-[13px] flex items-center gap-1.5">
              <User className="h-4 w-4 text-[var(--text-secondary)]" />
              {patientFullName}
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
              {relativeTime.timeLabel}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[var(--text-secondary)]">
            <div><strong className="text-[var(--text-primary)]">Profesional:</strong> {doctorFullName}</div>
            <div><strong className="text-[var(--text-primary)]">Sucursal:</strong> {appointment.branch?.name || "Clínica"}</div>
          </div>
        </div>

        {/* Patient Phone Display (Strictly Read-Only with Profile CTA if missing) */}
        <div className="space-y-1.5">
          <label className="text-[var(--text-xs)] font-semibold text-[var(--text-primary)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              Teléfono de contacto (Ficha del paciente)
            </span>
            {patient?.id && (
              <button
                type="button"
                onClick={goToPatientProfile}
                className="text-[11px] font-normal text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Editar en ficha
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </label>

          {normalizedPhone ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-xs)] font-mono text-[var(--text-primary)] shadow-2xs select-all">
                  +{normalizedPhone}
                </div>
                {alternatePhone && primaryPhone && (
                  <div className="w-48">
                    <Select
                      value={selectedPhoneType}
                      onChange={(e) => setSelectedPhoneType(e.target.value as "primary" | "alternate")}
                    >
                      <option value="primary">Principal ({primaryPhone})</option>
                      <option value="alternate">Secundario ({alternatePhone})</option>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3 text-[var(--text-xs)] text-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>El paciente no tiene un número de teléfono registrado en sus datos personales.</span>
              {patient?.id && (
                <Button size="sm" variant="secondary" onClick={goToPatientProfile} type="button">
                  Completar ficha
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Client Target & Template Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[var(--text-xs)] font-semibold text-[var(--text-primary)]">
              Destino de apertura
            </label>
            <Select
              value={clientTarget}
              onChange={(e) => handleClientTargetChange(e.target.value as WhatsAppClientTarget)}
            >
              <option value="web">WhatsApp Web (Navegador)</option>
              <option value="app">App de Escritorio (Windows / Mac)</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[var(--text-xs)] font-semibold text-[var(--text-primary)]">
              Tipo de plantilla
            </label>
            <Select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as WhatsAppTemplateType)}
            >
              {WHATSAPP_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} - {t.description}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Live Editable Message Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[var(--text-xs)] font-semibold text-[var(--text-primary)]">
              Mensaje a enviar (Editable)
            </label>
            <button
              type="button"
              onClick={handleResetTemplate}
              className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Restablecer
            </button>
          </div>
          <Textarea
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe el mensaje..."
            className="text-[12px] leading-relaxed font-sans"
          />
          <p className="text-[10px] text-[var(--text-secondary)] text-right">
            {message.length} caracteres
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleCopyText()}
            disabled={!message}
            type="button"
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar texto
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} type="button">
              Cerrar
            </Button>
            <Button
              size="sm"
              disabled={!normalizedPhone || !message.trim() || submitting}
              onClick={() => void handleOpenWhatsAppAndNotify()}
              type="button"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              {submitting
                ? "Actualizando..."
                : clientTarget === "app"
                  ? "Abrir App y Notificar"
                  : "Abrir Web y Notificar"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
