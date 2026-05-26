import type { PropsWithChildren } from "react";
import { Button } from "./button";

export function Modal({
  open,
  title,
  onClose,
  size = "md",
  children
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void; size?: "md" | "lg" | "xl" }>) {
  if (!open) return null;

  const width = size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-3xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${width}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
