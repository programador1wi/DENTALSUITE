import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./button";

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onClear?: () => void;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function SignaturePad({ onSave, onClear, width = "100%", height = 200, className }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    padRef.current?.clear();
    if (onClear) onClear();
  };

  const handleSave = () => {
    if (!padRef.current) return;
    if (padRef.current.isEmpty()) {
      return; // Could show a toast or error here
    }
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className={`flex flex-col gap-3 ${className || ""}`}>
      <div 
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5"
        style={{ width, height }}
      >
        <SignatureCanvas
          ref={padRef}
          penColor="black"
          canvasProps={{
            className: "w-full h-full cursor-crosshair touch-none"
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClear}>
          Limpiar
        </Button>
        <Button onClick={handleSave}>
          Confirmar Firma
        </Button>
      </div>
    </div>
  );
}
