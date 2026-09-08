import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SecretResponse } from "../services/api-keys.service";

async function copySecret(secret: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(secret);
    return;
  }
  const input = document.createElement("textarea");
  input.value = secret;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("COPY_FAILED");
}

export function CredentialSecretDialog({ value, onDone }: { value: SecretResponse | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmLoss, setConfirmLoss] = useState(false);

  useEffect(() => {
    if (value) {
      setVisible(false);
      setCopied(false);
      setConfirmed(false);
      setConfirmLoss(false);
    }
  }, [value]);

  const requestClose = () => {
    if (confirmed) onDone();
    else setConfirmLoss(true);
  };

  return (
    <>
      <Modal
        open={Boolean(value) && !confirmLoss}
        title="Guarda el secreto de la credencial"
        description="Dentalink no puede recuperarlo ni volver a mostrarlo."
        onClose={requestClose}
        size="lg"
      >
        {value ? (
          <div className="space-y-[var(--space-5)]">
            <div className="flex gap-[var(--space-3)] rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-[var(--space-4)] text-amber-950">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="text-[var(--text-sm)]">
                <p className="font-semibold">Revelacion unica</p>
                <p className="mt-1">Copialo a un gestor de secretos. No lo guardes en codigo, capturas, chats ni variables del navegador.</p>
              </div>
            </div>

            <div>
              <label htmlFor="developer-api-secret" className="mb-2 block text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
                Secreto para {value.credential.name}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="developer-api-secret"
                    readOnly
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    value={value.secret}
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 pr-11 font-mono text-xs text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Ocultar secreto" : "Mostrar secreto"}
                    aria-pressed={visible}
                    onClick={() => setVisible((current) => !current)}
                    className="absolute right-1 top-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await copySecret(value.secret);
                      setCopied(true);
                      toast.success("Secreto copiado");
                    } catch {
                      toast.error("No fue posible copiar. Selecciona el valor manualmente.");
                    }
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] bg-slate-950 p-[var(--space-4)] font-mono text-xs text-slate-100">
              <p className="text-slate-300"># Variable de entorno</p>
              <p className="mt-1">DENTALINK_API_KEY=&quot;...&quot;</p>
              <p className="mt-3 text-slate-300"># Autenticacion recomendada</p>
              <p className="mt-1">Authorization: Bearer $DENTALINK_API_KEY</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-4)]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-[var(--text-sm)] text-[var(--text-primary)]">
                Guarde el secreto en un lugar seguro y entiendo que no podra recuperarse.
              </span>
            </label>

            <div className="flex justify-end">
              <Button disabled={!confirmed} onClick={onDone}>Terminar</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmLoss}
        title="Perderas acceso al secreto"
        description="Si cierras ahora, este secreto no volvera a mostrarse. Vuelve para copiarlo o confirma que deseas descartarlo."
        confirmLabel="Descartar secreto"
        onCancel={() => setConfirmLoss(false)}
        onConfirm={onDone}
      />
    </>
  );
}
