import { Link } from "react-router-dom";
import { RegisterOrganizationForm } from "@/features/auth/components/register-organization-form";

export function RegisterOrganizationPage() {
  return (
    <div className="w-full max-w-[540px] bg-white border border-zinc-200/60 rounded-xl p-8 md:p-10 shadow-sm space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="h-10 w-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center">
          <svg className="h-5 w-5 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 3.5C3 3.5 2.3 7.1 3.2 10.1c.8 2.8 2.9 4.8 3.5 8.4.2 1.1 1.6 1.3 2 .3l1.2-3.1c.6-1.6 2.8-1.6 3.4 0l1.2 3.1c.4 1 1.8.8 2-.3.6-3.6 2.7-5.6 3.5-8.4.9-3-.1-6.6-3.4-6.6-1.5 0-2.4.7-3.5 1.2-.9.4-1.7.4-2.6 0-1.1-.5-2.1-1.2-4-1.2z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Crea tu Organización</h1>
          <p className="text-xs text-zinc-500 max-w-[380px]">
            Configura tu sucursal matriz y primer usuario administrador en minutos.
          </p>
        </div>
      </div>

      {/* Form */}
      <RegisterOrganizationForm />

      {/* Footer Link */}
      <div className="text-center text-xs text-zinc-400 font-medium pt-1">
        ¿Ya tienes una cuenta registrada?{" "}
        <Link className="font-semibold text-zinc-800 hover:underline hover:text-black transition-colors" to="/login">
          Inicia sesión aquí
        </Link>
      </div>

      <div className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1.5 uppercase font-semibold tracking-wider pt-2 border-t border-zinc-100">
        <span>© {new Date().getFullYear()} Dentalink+</span>
        <span>•</span>
        <span>Soporte ERP</span>
      </div>
    </div>
  );
}

