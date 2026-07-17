import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Check, Clock3, ShieldCheck, UploadCloud } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  claimMobilePhotographicUpload,
  completeMobilePhotographicUpload,
  uploadMobilePhotographicImage,
  type PhotographicSlot
} from "../services/photographic-templates.service";

export function MobilePhotographicUploadPage() {
  const { token = "" } = useParams();
  const invitation = useQuery({
    queryKey: ["mobile-photographic-upload", token],
    queryFn: () => claimMobilePhotographicUpload(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  });
  const [uploadedSlots, setUploadedSlots] = useState<Set<string>>(new Set());
  const [uploadingSlot, setUploadingSlot] = useState("");
  const [completed, setCompleted] = useState(false);
  const uploadToken = invitation.data?.uploadToken;

  const upload = async (slot: PhotographicSlot, file?: File) => {
    if (!uploadToken || !file) return;
    setUploadingSlot(slot.id);
    try {
      await uploadMobilePhotographicImage(uploadToken, slot.id, file);
      setUploadedSlots((current) => new Set(current).add(slot.id));
      toast.success(`${slot.label} cargada`);
    } finally {
      setUploadingSlot("");
    }
  };

  const finish = async () => {
    if (!uploadToken) return;
    await completeMobilePhotographicUpload(uploadToken);
    setCompleted(true);
  };

  if (invitation.isLoading)
    return <MobileState title="Validando invitacion segura" description="Espera un momento..." />;
  if (invitation.isError)
    return (
      <MobileState
        title="Invitacion no disponible"
        description="El enlace expiro, fue usado o fue revocado. Solicita uno nuevo desde el equipo clinico."
        danger
      />
    );
  if (completed)
    return (
      <MobileState
        title="Carga finalizada"
        description="Las fotografias ya estan disponibles en la plantilla del equipo clinico."
        success
      />
    );

  return (
    <main className="min-h-screen bg-[#edf5f8] px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_18px_55px_rgba(14,83,113,0.12)]">
        <header className="bg-[#0b77b7] px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
              <Camera className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-100">
                Carga clinica segura
              </p>
              <h1 className="text-xl font-semibold">{invitation.data?.session.name}</h1>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-black/10 px-3 py-2 text-xs text-sky-50">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Sin datos del paciente
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              Expira{" "}
              {new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(
                new Date(invitation.data?.expiresAt ?? "")
              )}
            </span>
          </div>
        </header>
        <section className="p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-semibold">Posiciones fotograficas</h2>
              <p className="text-xs text-slate-500">Toma o selecciona cada fotografia.</p>
            </div>
            <span className="text-sm font-semibold text-sky-700">{uploadedSlots.size}/10</span>
          </div>
          <div className="space-y-2">
            {invitation.data?.slots.map((slot) => (
              <MobileSlot
                key={slot.id}
                slot={slot}
                uploaded={uploadedSlots.has(slot.id)}
                uploading={uploadingSlot === slot.id}
                disabled={Boolean(uploadingSlot)}
                onUpload={upload}
              />
            ))}
          </div>
          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={!uploadedSlots.size || Boolean(uploadingSlot)}
            onClick={() => void finish()}
          >
            <Check className="h-5 w-5" />
            Finalizar carga
          </Button>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            Puedes finalizar con posiciones pendientes. La plantilla quedara incompleta hasta reunir las
            obligatorias.
          </p>
        </section>
      </div>
    </main>
  );
}

function MobileSlot({
  slot,
  uploaded,
  uploading,
  disabled,
  onUpload
}: {
  slot: PhotographicSlot;
  uploaded: boolean;
  uploading: boolean;
  disabled: boolean;
  onUpload: (slot: PhotographicSlot, file?: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${uploaded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"}`}
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${uploaded ? "bg-emerald-500 text-white" : "bg-sky-50 text-sky-700"}`}
        >
          {uploaded ? <Check className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{slot.label}</span>
          <span className="block text-xs text-slate-500">
            {uploading
              ? "Procesando..."
              : uploaded
                ? "Fotografia cargada"
                : slot.group === "FACIAL"
                  ? "Fotografia facial"
                  : "Fotografia intraoral"}
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void onUpload(slot, event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}

function MobileState({
  title,
  description,
  danger,
  success
}: {
  title: string;
  description: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf5f8] p-6">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${danger ? "bg-rose-100 text-rose-700" : success ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}
        >
          {success ? <Check className="h-7 w-7" /> : <Camera className="h-7 w-7" />}
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </main>
  );
}
