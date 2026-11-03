import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPublicPatientProfile, updatePublicPatientProfile } from "../services/public-booking.service";
import { ApiError } from "@/lib/api/error";
import { CheckCircle2, XCircle, Loader2, User } from "lucide-react";
import {
  createDefaultPatientFieldSettings,
  getVisibleFormFields,
  getRequiredFormFields,
  recordsToSettings
} from "@/features/patients/config/patient-field-settings";

const checkInBaseSchema = z.object({
  firstName: z.string().min(2, "El nombre es requerido"),
  socialName: z.string().optional(),
  lastName: z.string().min(2, "El apellido es requerido"),
  agreementId: z.string().optional(),
  internalNumber: z.string().optional(),
  email: z.string().email("Correo invalido").or(z.literal("").or(z.undefined())),
  phone: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  birthDate: z.string().optional(),
  sex: z.string().optional(),
  gender: z.string().optional(),
  alternatePhone: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  observations: z.string().optional(),
  referredBy: z.string().optional(),
  status: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencySocialName: z.string().optional(),
  emergencyDocumentNumber: z.string().optional(),
  emergencyGender: z.string().optional(),
  privacyNoticeAccepted: z.boolean().refine((val) => val === true, {
    message: "Debes aceptar el aviso de privacidad"
  })
});

function createCheckInSchema(requiredFields: ReadonlySet<string>) {
  return checkInBaseSchema.superRefine((values, context) => {
    for (const field of requiredFields) {
      const value = values[field as keyof typeof values];
      if (typeof value === "string" && value.trim()) continue;
      context.addIssue({ code: "custom", path: [field], message: "Campo requerido" });
    }
  });
}

type FormValues = z.infer<typeof checkInBaseSchema>;

export function CompletePatientProfilePage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [viewState, setViewState] = useState<"fetching" | "idle" | "loading-save" | "success" | "error">(
    "fetching"
  );
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [checkInConfig, setCheckInConfig] = useState(() => createDefaultPatientFieldSettings().checkIn);
  const [agreementOptions, setAgreementOptions] = useState<Array<{ id: string; name: string }>>([]);
  const visibleFields = getVisibleFormFields(checkInConfig);
  const requiredFields = getRequiredFormFields(checkInConfig);
  const formSchema = useMemo(() => createCheckInSchema(requiredFields), [requiredFields]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      socialName: "",
      lastName: "",
      agreementId: "",
      internalNumber: "",
      email: "",
      phone: "",
      documentType: "",
      documentNumber: "",
      birthDate: "",
      sex: "",
      gender: "",
      alternatePhone: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      occupation: "",
      employer: "",
      observations: "",
      referredBy: "",
      status: "",
      emergencyName: "",
      emergencySocialName: "",
      emergencyDocumentNumber: "",
      emergencyGender: "",
      privacyNoticeAccepted: false
    }
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
        setCheckInConfig(recordsToSettings(data.patientFieldConfigs).checkIn);
        setAgreementOptions(data.agreements ?? []);
        form.reset({
          firstName: data.firstName || "",
          socialName: data.socialName || "",
          lastName: data.lastName || "",
          agreementId: data.agreementId || "",
          internalNumber: data.internalNumber || "",
          email: data.email || "",
          phone: data.phone || "",
          documentType: data.documentType || "",
          documentNumber: data.documentNumber || "",
          birthDate: data.birthDate ? data.birthDate.split("T")[0] : "",
          sex: data.sex || "",
          gender: data.gender || "",
          alternatePhone: data.alternatePhone || "",
          addressStreet: data.address?.street || "",
          addressCity: data.address?.city || "",
          addressState: data.address?.state || "",
          occupation: data.occupation || "",
          employer: data.employer || "",
          observations: data.observations || "",
          referredBy: data.referredBy || "",
          status: data.type || "",
          emergencyName: data.guardianName || "",
          emergencySocialName: data.guardianSocialName || "",
          emergencyDocumentNumber: data.guardianDocumentNumber || "",
          emergencyGender: data.guardianGender || "",
          privacyNoticeAccepted: false
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
        socialName: values.socialName || undefined,
        lastName: values.lastName,
        agreementId: values.agreementId || undefined,
        internalNumber: values.internalNumber || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        documentType: values.documentType || undefined,
        documentNumber: values.documentNumber || undefined,
        birthDate: values.birthDate || undefined,
        sex: values.sex || undefined,
        gender: values.gender || undefined,
        alternatePhone: values.alternatePhone || undefined,
        address: {
          street: values.addressStreet || undefined,
          city: values.addressCity || undefined,
          state: values.addressState || undefined
        },
        occupation: values.occupation || undefined,
        employer: values.employer || undefined,
        observations: values.observations || undefined,
        referredBy: values.referredBy || undefined,
        type: values.status || undefined,
        guardianName: values.emergencyName || undefined,
        guardianSocialName: values.emergencySocialName || undefined,
        guardianDocumentNumber: values.emergencyDocumentNumber || undefined,
        guardianGender: values.emergencyGender || undefined,
        privacyNoticeAccepted: values.privacyNoticeAccepted
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
            {visibleFields.has("firstName") && (
              <Field
                label="Nombre"
                required={requiredFields.has("firstName")}
                error={form.formState.errors.firstName?.message}
              >
                <Input placeholder="Ej. Juan" {...form.register("firstName")} />
              </Field>
            )}

            {visibleFields.has("socialName") && (
              <Field
                label="Nombre social"
                required={requiredFields.has("socialName")}
                error={form.formState.errors.socialName?.message}
              >
                <Input {...form.register("socialName")} />
              </Field>
            )}

            {visibleFields.has("lastName") && (
              <Field
                label="Apellidos"
                required={requiredFields.has("lastName")}
                error={form.formState.errors.lastName?.message}
              >
                <Input placeholder="Ej. Perez" {...form.register("lastName")} />
              </Field>
            )}

            {visibleFields.has("email") && (
              <Field
                label="Correo electronico"
                required={requiredFields.has("email")}
                error={form.formState.errors.email?.message}
              >
                <Input type="email" placeholder="ejemplo@correo.com" {...form.register("email")} />
              </Field>
            )}

            {visibleFields.has("phone") && (
              <Field
                label="Telefono movil"
                required={requiredFields.has("phone")}
                error={form.formState.errors.phone?.message}
              >
                <Input placeholder="10 digitos" {...form.register("phone")} />
              </Field>
            )}

            {visibleFields.has("birthDate") && (
              <Field
                label="Fecha de nacimiento"
                required={requiredFields.has("birthDate")}
                error={form.formState.errors.birthDate?.message}
              >
                <Input type="date" {...form.register("birthDate")} />
              </Field>
            )}

            {visibleFields.has("sex") && (
              <Field
                label="Sexo"
                required={requiredFields.has("sex")}
                error={form.formState.errors.sex?.message}
              >
                <Select {...form.register("sex")}>
                  <option value="">Selecciona...</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="INTERSEXUAL">Intersexual</option>
                  <option value="NO_ESPECIFICADO">No especificado</option>
                </Select>
              </Field>
            )}

            {visibleFields.has("gender") && (
              <Field
                label="Sexo"
                required={requiredFields.has("gender")}
                error={form.formState.errors.gender?.message}
              >
                <Select {...form.register("gender")}>
                  <option value="">Selecciona...</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="OTRO">Otro</option>
                </Select>
              </Field>
            )}

            {visibleFields.has("documentType") && (
              <Field
                label="Tipo de documento"
                required={requiredFields.has("documentType")}
                error={form.formState.errors.documentType?.message}
              >
                <Select {...form.register("documentType")}>
                  <option value="">Ej. CURP</option>
                  <option value="CURP">CURP</option>
                  <option value="RFC">RFC</option>
                  <option value="PASSPORT">Pasaporte</option>
                </Select>
              </Field>
            )}

            {visibleFields.has("documentNumber") && (
              <Field
                label="Numero de documento"
                required={requiredFields.has("documentNumber")}
                error={form.formState.errors.documentNumber?.message}
              >
                <Input placeholder="Ej. ABCD123456EFGHIJ78" {...form.register("documentNumber")} />
              </Field>
            )}

            {visibleFields.has("alternatePhone") && (
              <Field
                label="Telefono fijo"
                required={requiredFields.has("alternatePhone")}
                error={form.formState.errors.alternatePhone?.message}
              >
                <Input placeholder="Telefono alterno" {...form.register("alternatePhone")} />
              </Field>
            )}

            {visibleFields.has("occupation") && (
              <Field
                label="Actividad o profesion"
                required={requiredFields.has("occupation")}
                error={form.formState.errors.occupation?.message}
              >
                <Input {...form.register("occupation")} />
              </Field>
            )}

            {visibleFields.has("agreementId") && (
              <Field
                label="Convenio"
                required={requiredFields.has("agreementId")}
                error={form.formState.errors.agreementId?.message}
              >
                <Select {...form.register("agreementId")}>
                  <option value="">Sin convenio</option>
                  {agreementOptions.map((agreement) => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreement.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {visibleFields.has("internalNumber") && (
              <Field
                label="Numero interno"
                required={requiredFields.has("internalNumber")}
                error={form.formState.errors.internalNumber?.message}
              >
                <Input {...form.register("internalNumber")} />
              </Field>
            )}

            {visibleFields.has("employer") && (
              <Field
                label="Empleador"
                required={requiredFields.has("employer")}
                error={form.formState.errors.employer?.message}
              >
                <Input {...form.register("employer")} />
              </Field>
            )}

            {visibleFields.has("referredBy") && (
              <Field
                label="Referencia"
                required={requiredFields.has("referredBy")}
                error={form.formState.errors.referredBy?.message}
              >
                <Input {...form.register("referredBy")} />
              </Field>
            )}

            {visibleFields.has("status") && (
              <Field
                label="Tipo"
                required={requiredFields.has("status")}
                error={form.formState.errors.status?.message}
              >
                <Input {...form.register("status")} />
              </Field>
            )}

            {visibleFields.has("emergencyName") && (
              <Field
                label="Apoderado"
                required={requiredFields.has("emergencyName")}
                error={form.formState.errors.emergencyName?.message}
              >
                <Input {...form.register("emergencyName")} />
              </Field>
            )}

            {visibleFields.has("emergencySocialName") && (
              <Field
                label="Nombre social tutor"
                required={requiredFields.has("emergencySocialName")}
                error={form.formState.errors.emergencySocialName?.message}
              >
                <Input {...form.register("emergencySocialName")} />
              </Field>
            )}

            {visibleFields.has("emergencyDocumentNumber") && (
              <Field
                label="CURP/RFC tutor legal"
                required={requiredFields.has("emergencyDocumentNumber")}
                error={form.formState.errors.emergencyDocumentNumber?.message}
              >
                <Input {...form.register("emergencyDocumentNumber")} />
              </Field>
            )}

            {visibleFields.has("emergencyGender") && (
              <Field
                label="Genero tutor"
                required={requiredFields.has("emergencyGender")}
                error={form.formState.errors.emergencyGender?.message}
              >
                <Input {...form.register("emergencyGender")} />
              </Field>
            )}
          </div>

          {visibleFields.has("observations") && (
            <Field
              label="Observaciones"
              required={requiredFields.has("observations")}
              error={form.formState.errors.observations?.message}
            >
              <Textarea rows={3} {...form.register("observations")} />
            </Field>
          )}

          {(visibleFields.has("addressStreet") ||
            visibleFields.has("addressCity") ||
            visibleFields.has("addressState")) && (
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-4 text-gray-700">Direccion</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleFields.has("addressStreet") && (
                  <div className="col-span-1 md:col-span-2">
                    <Field
                      label="Calle y numero"
                      required={requiredFields.has("addressStreet")}
                      error={form.formState.errors.addressStreet?.message}
                    >
                      <Input placeholder="Ej. Av. Reforma 123" {...form.register("addressStreet")} />
                    </Field>
                  </div>
                )}

                {visibleFields.has("addressCity") && (
                  <Field
                    label="Ciudad"
                    required={requiredFields.has("addressCity")}
                    error={form.formState.errors.addressCity?.message}
                  >
                    <Input placeholder="Ej. Monterrey" {...form.register("addressCity")} />
                  </Field>
                )}

                {visibleFields.has("addressState") && (
                  <Field
                    label="Estado / Municipio"
                    required={requiredFields.has("addressState")}
                    error={form.formState.errors.addressState?.message}
                  >
                    <Input placeholder="Ej. Nuevo Leon" {...form.register("addressState")} />
                  </Field>
                )}
              </div>
            </div>
          )}

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
