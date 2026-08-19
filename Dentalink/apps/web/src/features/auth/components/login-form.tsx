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
    <form className="space-y-4 sm:space-y-5" onSubmit={form.handleSubmit(({ email, password }) => login.mutate({ email, password }))}>
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Correo</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type="email"
            id="login-email"
            autoComplete="email"
            placeholder="admin@dentalwarner.local"
            className="h-11 rounded-[var(--radius-md)] border-[var(--border-default)] bg-[var(--bg-surface)] pl-10 text-[var(--text-sm)] placeholder:text-[var(--text-secondary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email?.message && (
          <span className="block pl-0.5 text-xs font-medium text-red-600">{form.formState.errors.email?.message}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Contraseña</label>

        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type={showPassword ? "text" : "password"}
            id="login-password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 rounded-[var(--radius-md)] border-[var(--border-default)] bg-[var(--bg-surface)] pl-10 pr-11 text-[var(--text-sm)] placeholder:text-[var(--text-secondary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            {...form.register("password")}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[var(--radius-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
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

      <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)] pt-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
        <input
          id="remember-me"
          type="checkbox"
          className="h-4 w-4 rounded-[var(--radius-sm)] border-[var(--border-strong)] accent-[var(--action-brand)]"
          {...form.register("rememberMe")}
        />
        Mantener sesión iniciada
      </label>

      <Button
        type="submit"
        className="mt-[var(--space-2)] h-11 w-full"
        disabled={login.isPending}
      >
        {login.isPending ? "Autenticando..." : "Entrar al sistema"}
      </Button>
    </form>
  );
}
