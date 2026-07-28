import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginSchema } from "@/lib/validations/auth";
import { useLogin } from "../hooks/use-login";

export function LoginForm() {
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true }
  });

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(({ email, password }) => login.mutate({ email, password }))}>
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Correo</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type="email"
            placeholder="admin@dentalwarner.local"
            className="h-11 rounded-xl border-zinc-200/90 bg-white/80 pl-10 text-sm placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-cyan-500/20"
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email?.message && (
          <span className="block pl-0.5 text-xs font-medium text-red-600">{form.formState.errors.email?.message}</span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Contraseña</label>
          <a
            href="#"
            onClick={(event) => event.preventDefault()}
            className="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            Recuperar acceso
          </a>
        </div>

        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="h-11 rounded-xl border-zinc-200/90 bg-white/80 pl-10 pr-11 text-sm placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-cyan-500/20"
            {...form.register("password")}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {form.formState.errors.password?.message && (
          <span className="block pl-0.5 text-xs font-medium text-red-600">{form.formState.errors.password?.message}</span>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-600">
        <input
          id="remember-me"
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500/30"
          {...form.register("rememberMe")}
        />
        Mantener sesión iniciada
      </label>

      <Button
        type="submit"
        className="mt-1 h-11 w-full rounded-xl bg-[linear-gradient(95deg,#0f172a_0%,#111827_55%,#0f172a_100%)] text-sm font-semibold shadow-[0_12px_30px_-16px_rgba(6,182,212,0.55)] hover:brightness-110"
        disabled={login.isPending}
      >
        {login.isPending ? "Autenticando..." : "Entrar al sistema"}
      </Button>
    </form>
  );
}
