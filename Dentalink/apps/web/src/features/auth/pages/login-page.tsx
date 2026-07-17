import { Activity, ShieldCheck, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { LoginParticleBackground } from "@/features/auth/components/LoginParticleBackground";
import { LoginForm } from "@/features/auth/components/login-form";

const highlights = [
  {
    title: "Control clinico centralizado",
    description: "Agenda, pacientes, cobros y reportes desde un mismo panel.",
    icon: Activity
  },
  {
    title: "Acceso protegido por roles",
    description: "Permisos por usuario y sucursal con trazabilidad completa.",
    icon: ShieldCheck
  },
  {
    title: "Flujo operativo rapido",
    description: "Ingreso en segundos para abrir caja y empezar atencion.",
    icon: Timer
  }
];

export function LoginPage() {
  return (
    <>
      <LoginParticleBackground />

      <div className="relative z-10 w-full max-w-[1020px]">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_420px]">
          <aside className="hidden lg:block">
            <p className="mb-4 inline-flex items-center rounded-full border border-white/70 bg-white/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-700 backdrop-blur">
              Warner Suite Enterprise
            </p>
            <h1 className="max-w-[580px] text-[clamp(2rem,3.7vw,3.9rem)] font-semibold leading-[0.96] tracking-tight text-zinc-900">
              Accede a tu operacion clinica sin friccion.
            </h1>
            <p className="mt-4 max-w-[520px] text-base leading-6 text-zinc-600">
              Diseñado para equipos dentales que necesitan velocidad, precision y continuidad en cada turno.
            </p>

            <div className="mt-9 space-y-4">
              {highlights.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_15px_45px_-30px_rgba(2,6,23,0.5)] backdrop-blur-xl"
                >
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
                    <p className="mt-1 text-sm text-zinc-600">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>

          <article className="relative overflow-hidden rounded-[24px] border border-white/70 bg-white/72 p-6 shadow-[0_35px_100px_-45px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-orange-500" />

            <div className="mb-6 space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-[0_8px_30px_rgba(6,121,200,0.15)]">
                  <img src="/logo-2.png" alt="Warner Suite Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Iniciar sesión</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-600">ERP Dental · Warner Suite</p>
                </div>
              </div>
              <p className="text-center text-sm text-zinc-500">Usa tus credenciales autorizadas para entrar al sistema.</p>
            </div>

            <LoginForm />

            <div className="mt-5 text-center text-xs font-medium text-zinc-500">
              ¿No tienes cuenta?{" "}
              <Link className="font-semibold text-zinc-900 underline-offset-2 hover:underline" to="/register-organization">
                Registra tu clinica
              </Link>
            </div>

            <div className="mt-5 border-t border-zinc-200/80 pt-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              © {new Date().getFullYear()} Warner Suite
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
