import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getPublicPatientProfile, updatePublicPatientProfile } from "../services/public-booking.service";
import { ApiError } from "@/lib/api/error";
import { CheckCircle2, XCircle, Loader2, User } from "lucide-react";

const formSchema = z.object({
  firstName: z.string().min(2, "El nombre es requerido"),
  lastName: z.string().min(2, "El apellido es requerido"),
  email: z.string().email("Correo invalido").or(z.literal("").or(z.undefined())),
  phone: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  alternatePhone: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  privacyNoticeAccepted: z.boolean().refine((val) => val === true, {
    message: "Debes aceptar el aviso de privacidad",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export function CompletePatientProfilePage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [viewState, setViewState] = useState<"fetching" | "idle" | "loading-save" | "success" | "error">("fetching");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      documentType: "",
      documentNumber: "",
      birthDate: "",
      gender: "",
      alternatePhone: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      privacyNoticeAccepted: false,
    },
  });

  useEffect(() => {
    if (!id || !token) {
      setViewState("error");
      setErrorTitle("Enlace invalido");
      setErrorMessage("Faltan parametros de seguridad.");
      return;
    }

    getPublicPatientProfile(id, token)
      .then((data) => {
        form.reset({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          phone: data.phone || "",
          documentType: data.documentType || "",
          documentNumber: data.documentNumber || "",
          birthDate: data.birthDate ? data.birthDate.split("T")[0] : "",
          gender: data.gender || "",
          alternatePhone: data.alternatePhone || "",
          addressStreet: data.address?.street || "",
          addressCity: data.address?.city || "",
          addressState: data.address?.state || "",
          privacyNoticeAccepted: false,
        });
        setViewState("idle");
      })
      .catch((err) => {
        const statusCode = err instanceof ApiError ? err.statusCode : undefined;
        setViewState("error");
        if (statusCode === 401) {
          setErrorTitle("Enlace invalido");
          setErrorMessage("El enlace es invalido o token incorrecto.");
        } else if (statusCode === 410 || statusCode === 400) {
          setErrorTitle("Enlace expirado");
          setErrorMessage("Este enlace ha vencido o la cita ya no esta disponible.");
        } else if (statusCode === 404) {
          setErrorTitle("Cita no encontrada");
          setErrorMessage("No encontramos la cita relacionada.");
        } else {
          setErrorTitle("Error del servidor");
          setErrorMessage("No fue posible cargar tus datos. Comunicate con la clinica.");
        }
      });
  }, [id, token, form]);

  const onSubmit = async (values: FormValues) => {
    if (!id || !token) return;
    setViewState("loading-save");
    try {
      await updatePublicPatientProfile(id, token, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        documentType: values.documentType || undefined,
        documentNumber: values.documentNumber || undefined,
        birthDate: values.birthDate || undefined,
        gender: values.gender || undefined,
        alternatePhone: values.alternatePhone || undefined,
        address: {
          street: values.addressStreet || undefined,
          city: values.addressCity || undefined,
          state: values.addressState || undefined,
        },
        privacyNoticeAccepted: values.privacyNoticeAccepted,
      });
      setViewState("success");
    } catch (err) {
      setViewState("idle");
      alert("No fue posible actualizar tus datos. Revisa los campos senalados.");
    }
  };

  if (!id || !token) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md flex flex-col items-center p-8">
          <XCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold">Enlace invalido</h2>
          <p className="text-gray-500 text-center">Faltan parametros.</p>
        </Card>
      </div>
    );
  }

  if (viewState === "fetching") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (viewState === "success") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md flex flex-col items-center p-8 border-t-4 border-green-500">
          <CheckCircle2 className="h-24 w-24 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold">¡Datos actualizados!</h2>
          <p className="text-gray-500 text-center mt-2">
            Tus datos fueron actualizados correctamente. Puedes cerrar esta pagina.
          </p>
        </Card>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md flex flex-col items-center p-8 border-t-4 border-red-500">
          <XCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold">{errorTitle}</h2>
          <p className="text-gray-500 text-center mt-2">{errorMessage}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-2xl shadow-xl p-8 bg-white/90">
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-blue-600" />
            Completa tus datos
          </h2>
          <p className="text-gray-500 mt-1">
            Por favor completa o actualiza tu informacion personal para agilizar tu atencion.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre" required error={form.formState.errors.firstName?.message}>
              <Input placeholder="Ej. Juan" {...form.register("firstName")} />
            </Field>
            
            <Field label="Apellidos" required error={form.formState.errors.lastName?.message}>
              <Input placeholder="Ej. Perez" {...form.register("lastName")} />
            </Field>

            <Field label="Correo electronico" error={form.formState.errors.email?.message}>
              <Input type="email" placeholder="ejemplo@correo.com" {...form.register("email")} />
            </Field>

            <Field label="Telefono movil" error={form.formState.errors.phone?.message}>
              <Input placeholder="10 digitos" {...form.register("phone")} />
            </Field>

            <Field label="Fecha de nacimiento" error={form.formState.errors.birthDate?.message}>
              <Input type="date" {...form.register("birthDate")} />
            </Field>

            <Field label="Sexo" error={form.formState.errors.gender?.message}>
              <Select {...form.register("gender")}>
                <option value="">Selecciona...</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
                <option value="OTRO">Otro</option>
              </Select>
            </Field>

            <Field label="Tipo de documento" error={form.formState.errors.documentType?.message}>
              <Select {...form.register("documentType")}>
                <option value="">Ej. CURP</option>
                <option value="CURP">CURP</option>
                <option value="RFC">RFC</option>
                <option value="PASSPORT">Pasaporte</option>
              </Select>
            </Field>

            <Field label="Numero de documento" error={form.formState.errors.documentNumber?.message}>
              <Input placeholder="Ej. ABCD123456EFGHIJ78" {...form.register("documentNumber")} />
            </Field>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-4 text-gray-700">Direccion</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <Field label="Calle y numero" error={form.formState.errors.addressStreet?.message}>
                  <Input placeholder="Ej. Av. Reforma 123" {...form.register("addressStreet")} />
                </Field>
              </div>
              
              <Field label="Ciudad" error={form.formState.errors.addressCity?.message}>
                <Input placeholder="Ej. Monterrey" {...form.register("addressCity")} />
              </Field>

              <Field label="Estado / Municipio" error={form.formState.errors.addressState?.message}>
                <Input placeholder="Ej. Nuevo Leon" {...form.register("addressState")} />
              </Field>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-3 rounded-md border p-4 shadow-sm bg-gray-50 mt-6">
            <input
              type="checkbox"
              id="privacyNoticeAccepted"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
              {...form.register("privacyNoticeAccepted")}
            />
            <div className="space-y-1 leading-none">
              <label htmlFor="privacyNoticeAccepted" className="font-medium text-sm text-slate-700">
                Acepto el aviso de privacidad
              </label>
              <p className="text-sm text-gray-500">
                Consiento el tratamiento de mis datos personales conforme al aviso de privacidad.
              </p>
              {form.formState.errors.privacyNoticeAccepted?.message ? (
                <p className="text-sm text-red-600">{form.formState.errors.privacyNoticeAccepted.message}</p>
              ) : null}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-semibold"
            disabled={viewState === "loading-save"}
          >
            {viewState === "loading-save" ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            Guardar Datos
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm text-slate-700 block">
      <span>
        {label}
        {required ? <span className="ml-1 text-[var(--text-danger)]">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600 block">{error}</span> : null}
    </label>
  );
}
