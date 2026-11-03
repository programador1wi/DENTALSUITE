import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/error";
import { http as api } from "@/lib/api/http-client";
import { CheckCircle2, XCircle, Loader2, Calendar, Clock, MapPin, User, Stethoscope } from "lucide-react";

type AppointmentDetails = {
  status: string;
  patientName: string;
  professionalName: string;
  dateStr: string;
  timeStr: string;
  address: string;
};

type PublicAppointmentErrorCopy = {
  title: string;
  message: string;
};

function getPublicAppointmentErrorCopy(error: unknown): PublicAppointmentErrorCopy {
  if (!navigator.onLine) {
    return {
      title: "Sin conexion",
      message: "No hay conexion. Intenta nuevamente."
    };
  }

  const statusCode = error instanceof ApiError ? error.statusCode : undefined;
  if (statusCode === 401) {
    return {
      title: "Enlace invalido",
      message: "El enlace es invalido."
    };
  }
  if (statusCode === 410) {
    return {
      title: "Enlace expirado",
      message: "El enlace ha expirado. Comunicate con la clinica."
    };
  }
  if (statusCode === 404) {
    return {
      title: "Cita no disponible",
      message: "La cita no existe o ya no esta disponible."
    };
  }
  if (statusCode && statusCode >= 500) {
    return {
      title: "No fue posible procesar la solicitud",
      message: "No fue posible procesar tu solicitud. Comunicate con la clinica."
    };
  }

  return {
    title: "No fue posible procesar la solicitud",
    message: "No fue posible procesar tu solicitud. Comunicate con la clinica."
  };
}

export function ConfirmAppointmentPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [viewState, setViewState] = useState<
    | "fetching"
    | "idle"
    | "loading-confirm"
    | "loading-cancel"
    | "success-confirm"
    | "success-cancel"
    | "error"
  >("fetching");
  const [details, setDetails] = useState<AppointmentDetails | null>(null);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!id || !token) {
      setViewState("error");
      setErrorTitle("Enlace invalido");
      setErrorMessage("Faltan parámetros de confirmación.");
      return;
    }

    api
      .get(`/public/booking/appointments/${id}/confirm?token=${token}`)
      .then((res) => {
        const data = res.data;
        setDetails(data);
        if (
          ["CONFIRMED", "CONFIRMED_BY_EMAIL", "CONFIRMED_BY_PHONE", "CONFIRMED_BY_WHATSAPP"].includes(
            data.status
          )
        ) {
          setViewState("success-confirm");
        } else if (
          [
            "CANCELLED_BY_PATIENT",
            "CANCELLED_BY_CLINIC",
            "CANCELLED_CONFLICT",
            "CANCELLED_RESCHEDULED"
          ].includes(data.status)
        ) {
          setViewState("success-cancel");
        } else {
          setViewState("idle");
        }
      })
      .catch((err) => {
        const errorCopy = getPublicAppointmentErrorCopy(err);
        setViewState("error");
        setErrorTitle(errorCopy.title);
        setErrorMessage(errorCopy.message);
      });
  }, [id, token]);

  const handleConfirm = async () => {
    if (!id || !token) return;
    setViewState("loading-confirm");
    try {
      await api.post(`/public/booking/appointments/${id}/confirm?token=${token}`);
      setViewState("success-confirm");
    } catch (error) {
      const errorCopy = getPublicAppointmentErrorCopy(error);
      setViewState("error");
      setErrorTitle(errorCopy.title);
      setErrorMessage(errorCopy.message);
    }
  };

  const handleCancel = async () => {
    if (!id || !token) return;
    setViewState("loading-cancel");
    try {
      await api.post(`/public/booking/appointments/${id}/cancel?token=${token}`);
      setViewState("success-cancel");
    } catch (error) {
      const errorCopy = getPublicAppointmentErrorCopy(error);
      setViewState("error");
      setErrorTitle(errorCopy.title);
      setErrorMessage(errorCopy.message);
    }
  };

  if (!id || !token) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-xl flex flex-col items-center border-t-4 border-red-500 p-8">
          <XCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
          <p className="text-center text-sm text-gray-500">Faltan parámetros de seguridad en la URL.</p>
        </Card>
      </div>
    );
  }

  if (viewState === "fetching") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Cargando detalles de tu cita...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4 font-sans">
      <Card className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden border-0 bg-white/80 backdrop-blur-xl">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md mb-4 shadow-inner">
            <Calendar className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Gestión de tu Cita</h2>
          <p className="text-blue-100 mt-2 text-sm font-medium">Por favor confirma o anula tu asistencia</p>
        </div>

        <div className="p-8">
          {details && (viewState === "idle" || viewState.startsWith("loading")) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-50 rounded-xl p-5 mb-8 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center text-slate-700">
                  <User className="h-5 w-5 text-blue-500 mr-3" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paciente</p>
                    <p className="font-semibold">{details.patientName}</p>
                  </div>
                </div>
                <div className="flex items-center text-slate-700">
                  <Stethoscope className="h-5 w-5 text-blue-500 mr-3" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profesional</p>
                    <p className="font-semibold">{details.professionalName}</p>
                  </div>
                </div>
                <div className="h-px w-full bg-slate-200 my-2" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center text-slate-700">
                    <Calendar className="h-5 w-5 text-blue-500 mr-3" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</p>
                      <p className="font-semibold">{details.dateStr}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-slate-700">
                    <Clock className="h-5 w-5 text-blue-500 mr-3" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hora</p>
                      <p className="font-semibold">{details.timeStr}</p>
                    </div>
                  </div>
                </div>
                <div className="h-px w-full bg-slate-200 my-2" />
                <div className="flex items-center text-slate-700">
                  <MapPin className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dirección</p>
                    <p className="font-semibold text-sm leading-tight">{details.address}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30 transition-all font-bold text-base h-14"
                  onClick={handleConfirm}
                  disabled={viewState !== "idle"}
                >
                  {viewState === "loading-confirm" ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  Confirmar mi asistencia
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all font-semibold h-14"
                  onClick={handleCancel}
                  disabled={viewState !== "idle"}
                >
                  {viewState === "loading-cancel" ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 mr-2" />
                  )}
                  No podré asistir (Anular cita)
                </Button>
              </div>
            </div>
          )}

          {viewState === "success-confirm" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-500 py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <CheckCircle2 className="h-24 w-24 text-green-500 relative z-10 drop-shadow-sm" />
              </div>
              <div className="space-y-2 text-center mt-6">
                <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">¡Cita Confirmada!</h3>
                <p className="text-slate-500 font-medium px-4">
                  Te esperamos el {details?.dateStr} a las {details?.timeStr}. Gracias por tu confirmación.
                </p>
              </div>
            </div>
          )}

          {viewState === "success-cancel" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-500 py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <CheckCircle2 className="h-24 w-24 text-orange-500 relative z-10 drop-shadow-sm" />
              </div>
              <div className="space-y-2 text-center mt-6">
                <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">Cita Anulada</h3>
                <p className="text-slate-500 font-medium px-4">
                  Tu cita ha sido cancelada correctamente. Si deseas reagendar, por favor contacta a la
                  clínica.
                </p>
              </div>
            </div>
          )}

          {viewState === "error" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-500 py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-red-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <XCircle className="h-24 w-24 text-red-500 relative z-10 drop-shadow-sm" />
              </div>
              <div className="space-y-2 text-center mt-6">
                <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                  {errorTitle || "No fue posible procesar la solicitud"}
                </h3>
                <p className="text-slate-500 font-medium px-4">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
