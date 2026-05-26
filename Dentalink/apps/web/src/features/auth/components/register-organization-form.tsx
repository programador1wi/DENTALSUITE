import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerOrganizationSchema, type RegisterOrganizationSchema } from "@/lib/validations/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRegisterOrganization } from "../hooks/use-register-organization";

export function RegisterOrganizationForm() {
  const register = useRegisterOrganization();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<RegisterOrganizationSchema>({
    resolver: zodResolver(registerOrganizationSchema),
    defaultValues: {
      organizationName: "",
      branchName: "Sucursal Matriz",
      branchCountry: "MX",
      branchTimezone: "America/Mexico_City",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: ""
    }
  });

  return (
    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => register.mutate(values))}>
      {/* Organization Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Nombre de la Organización
        </label>
        <Input 
          placeholder="Ej. Clínica Dental Sonrisas"
          className="h-10 text-xs" 
          {...form.register("organizationName")} 
        />
        {form.formState.errors.organizationName?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.organizationName?.message}
          </span>
        )}
      </div>

      {/* Legal Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Razón Social / Nombre Legal
        </label>
        <Input 
          placeholder="Ej. Sonrisas S.A. de C.V."
          className="h-10 text-xs" 
          {...form.register("legalName")} 
        />
        {form.formState.errors.legalName?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.legalName?.message}
          </span>
        )}
      </div>

      {/* Branch Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Nombre de Sucursal Principal
        </label>
        <Input 
          placeholder="Ej. Sucursal Centro"
          className="h-10 text-xs" 
          {...form.register("branchName")} 
        />
        {form.formState.errors.branchName?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.branchName?.message}
          </span>
        )}
      </div>

      {/* Admin Email */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Correo del Administrador
        </label>
        <Input 
          type="email"
          placeholder="admin@tuclinica.com"
          className="h-10 text-xs" 
          {...form.register("adminEmail")} 
        />
        {form.formState.errors.adminEmail?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.adminEmail?.message}
          </span>
        )}
      </div>

      {/* Admin First Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Nombre del Administrador
        </label>
        <Input 
          placeholder="Ej. Alejandro"
          className="h-10 text-xs" 
          {...form.register("adminFirstName")} 
        />
        {form.formState.errors.adminFirstName?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.adminFirstName?.message}
          </span>
        )}
      </div>

      {/* Admin Last Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Apellido del Administrador
        </label>
        <Input 
          placeholder="Ej. Mendoza"
          className="h-10 text-xs" 
          {...form.register("adminLastName")} 
        />
        {form.formState.errors.adminLastName?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.adminLastName?.message}
          </span>
        )}
      </div>

      {/* Admin Password */}
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-0.5 block">
          Contraseña del Administrador
        </label>
        <div className="relative group">
          <Input 
            type={showPassword ? "text" : "password"} 
            placeholder="Mínimo 8 caracteres (Ej. Admin123!)"
            className="pr-10 h-10 text-xs" 
            {...form.register("adminPassword")} 
          />
          {/* Password Eye Toggle */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {showPassword ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {form.formState.errors.adminPassword?.message && (
          <span className="text-[10px] font-semibold text-red-500 mt-1 block pl-0.5">
            {form.formState.errors.adminPassword?.message}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <div className="md:col-span-2 pt-2">
        <Button 
          type="submit" 
          className="w-full h-10 text-xs font-semibold" 
          disabled={register.isPending}
        >
          {register.isPending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Configurando Organización...</span>
            </>
          ) : (
            "Crear Organización y Acceder"
          )}
        </Button>
      </div>
    </form>
  );
}
