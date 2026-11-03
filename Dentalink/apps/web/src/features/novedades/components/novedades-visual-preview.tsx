import { Bot, CheckCircle2, CreditCard, QrCode, FileCheck, Zap, ShieldCheck, Clock, MessageSquare, ArrowUpRight } from "lucide-react";
import type { ReleaseItem } from "../types";

interface NovedadesVisualPreviewProps {
  release: ReleaseItem;
}

export function NovedadesVisualPreview({ release }: NovedadesVisualPreviewProps) {
  // 1. WhatsApp / Asistente IA Mockup (Clean Light Palette)
  if (release.id.includes("08-20") || release.tags.includes("IA")) {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5 shadow-xs">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-slate-800">Asistente Virtual IA</p>
              <p className="text-[10px] text-slate-500">Integración con WhatsApp Business</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Activo 24/7
          </span>
        </div>

        {/* Chat UI in Clean Light Theme */}
        <div className="mt-3.5 space-y-2.5 text-xs">
          {/* Patient bubble */}
          <div className="flex items-start gap-2 max-w-[85%] sm:max-w-[75%]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
              P
            </div>
            <div className="rounded-2xl rounded-tl-xs border border-slate-200 bg-white p-3 text-slate-700 shadow-xs">
              <p className="text-[12px] leading-relaxed">
                Hola, confirmo mi cita para limpieza el jueves 11:00 AM con la Dra. Marcela.
              </p>
              <span className="mt-1 block text-right text-[9px] text-slate-400">10:42 AM</span>
            </div>
          </div>

          {/* Bot reply bubble */}
          <div className="flex items-start gap-2 justify-end pl-6">
            <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-tr-xs border border-emerald-200 bg-emerald-50/70 p-3 text-slate-800 shadow-xs">
              <p className="text-[12px] font-medium leading-relaxed text-slate-800">
                ¡Confirmada con éxito! He reservado el sillón Box 1 y agendado tu recordatorio.
              </p>
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-300/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Estado: Confirmado automáticamente en Agenda</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Fintech & Pasarelas de Pago (Clean Light Palette)
  if (release.id.includes("07-15") || release.tags.includes("Fintech")) {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-gradient-to-b from-blue-50/30 via-slate-50/40 to-white p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-800">Terminal & Links de Cobranza</p>
              <p className="text-[10px] text-slate-500">Conciliación con estado de cuenta</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-800">
            Liquidación en tiempo real
          </span>
        </div>

        {/* Payment details cards */}
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Liquidado</span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                PAGADO
              </span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">$1,850.00 MXN</p>
            <p className="mt-2 text-[11px] text-slate-600 flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span>Tratamiento: Endodoncia</span>
              <span className="font-mono text-slate-500 text-[10px]">Folio #49281</span>
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1">
              <QrCode className="h-10 w-10 text-slate-800" />
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-slate-800">Link enviado por WhatsApp</p>
              <p className="text-[11px] text-slate-500">Comprobante y timbrado CFDI automático</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Firma Digital en Consentimientos (Clean Light Palette)
  if (release.id.includes("06-10") || release.tags.includes("Ficha Clínica") || release.tags.includes("Seguridad")) {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <FileCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-800">Consentimiento Clínico Digital</p>
              <p className="text-[10px] text-slate-500">Firma en tablet con validez legal</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Sello Criptográfico QR
          </span>
        </div>

        {/* Signature Box */}
        <div className="mt-3.5 rounded-xl border border-dashed border-slate-300 bg-white p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            "Doy mi consentimiento informado para el procedimiento clínico especificado en el plan de tratamiento..."
          </p>
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2 text-xs">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-slate-400">Firma del Paciente:</span>
              <span className="font-serif italic text-base font-bold text-slate-800 tracking-wide">
                Argenol E. Iriarte
              </span>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <span className="font-medium text-emerald-700">Verificado biométricamente</span>
              <br />
              <span className="font-mono text-[9px] text-slate-400">Hash: 8f9b..e21a</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Rendimiento y Agenda (Clean Light Palette)
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-gradient-to-b from-amber-50/20 via-slate-50/40 to-white p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-800">Motor de Renderizado de Agenda</p>
            <p className="text-[10px] text-slate-500">Optimización de carga y memoria</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          45% más veloz
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-200 bg-white p-2.5 text-center shadow-xs">
          <p className="text-[11px] font-bold text-emerald-800">Sillón Box 1</p>
          <p className="text-[10px] text-slate-500">3 Citas listas</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-white p-2.5 text-center shadow-xs">
          <p className="text-[11px] font-bold text-blue-800">Sillón Box 2</p>
          <p className="text-[10px] text-slate-500">4 Citas listas</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-white p-2.5 text-center shadow-xs">
          <p className="text-[11px] font-bold text-indigo-800">Ortodoncia</p>
          <p className="text-[10px] text-slate-500">2 Citas listas</p>
        </div>
      </div>
    </div>
  );
}
