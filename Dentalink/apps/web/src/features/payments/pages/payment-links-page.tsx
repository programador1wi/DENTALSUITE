import { BarChart3, CreditCard, DollarSign, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PaymentLinksPage() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="rounded-2xl border-transparent shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white px-8 py-16 text-center">
        {/* Header Section */}
        <div className="space-y-4 mb-12">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Pagos TPV Dentalink
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Desde tu plataforma cobra el monto correcto en tu TPV
            dónde quedarán sincronizados todos los pagos de tus pacientes.
          </p>
        </div>

        {/* Info Banner */}
        <div className="relative mx-auto mb-16 max-w-3xl overflow-hidden rounded-[2rem] bg-sky-50 py-8 px-8 sm:px-16 flex items-center justify-center gap-6">
          <div className="shrink-0 relative">
            {/* Simple Terminal Representation */}
            <div className="w-16 h-24 bg-[#6aaee4] rounded-lg border-4 border-white shadow-md relative rotate-[-10deg] flex flex-col items-center justify-center">
              <div className="w-10 h-6 bg-white rounded-sm mt-2 absolute top-1" />
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center absolute bottom-3">
                <div className="w-3 h-3 bg-[#0679c8] rounded-full" />
              </div>
            </div>
            {/* Background decorative blob behind terminal (simulated) */}
            <div className="absolute inset-0 -z-10 bg-[#e0f0fa] rounded-full blur-xl scale-150" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-[#0679c8] text-left leading-snug">
            ¿Sabías que más del 40% de los mexicanos prefieren pagar sus servicios dentales con tarjetas?
          </p>
        </div>

        {/* Administrator Contact Section */}
        <div className="mx-auto max-w-4xl border-y border-slate-200 py-6 mb-16 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="text-slate-700 font-medium text-left max-w-sm">
            La contratación de este servicio debe ser hecha por el administrador del Centro de Salud.
          </p>
          <div className="text-slate-700 sm:text-right">
            <p>Contacta a tu administrador:</p>
            <p className="font-bold text-slate-900">Jorge Warner Solorsano Muñoz</p>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid sm:grid-cols-3 gap-10 max-w-4xl mx-auto mb-16">
          {/* Feature 1 */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center relative mb-2">
              <div className="absolute inset-0 border-2 border-dashed border-sky-200 rounded-full opacity-50" />
              <BarChart3 className="w-10 h-10 text-[#0679c8]" />
              <div className="absolute -bottom-2 -right-2 bg-slate-800 text-white p-1.5 rounded-md transform rotate-12">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-base leading-tight">
              Cuadrar tus cuentas nunca fue tan simple
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Las transacciones del TPV se registran automáticamente en tu plataforma.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center relative mb-2">
              <div className="absolute inset-0 border-2 border-dashed border-sky-200 rounded-full opacity-50" />
              <DollarSign className="w-10 h-10 text-[#0679c8]" />
              <div className="absolute -bottom-1 -right-1 bg-[#0679c8] text-white p-1.5 rounded-full transform -rotate-12 shadow-sm">
                <Search className="w-4 h-4" />
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-base leading-tight">
              Más control sobre tus ingresos
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Visualiza las ventas en tu plataforma sin necesidad de registrarlas manualmente o de consultar a tu proveedor de pagos.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center relative mb-2">
              <div className="absolute inset-0 border-2 border-dashed border-sky-200 rounded-full opacity-50" />
              <Users className="w-10 h-10 text-[#0679c8]" />
              <div className="absolute top-0 right-0 bg-white border border-sky-200 text-[#0679c8] p-1 rounded-full shadow-sm">
                <div className="w-2 h-2 bg-[#0679c8] rounded-full" />
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-base leading-tight">
              Mejor experiencia a tus pacientes
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Reduce hasta en un 50% el tiempo de cobro en la recepción y elimina los errores del proceso.
            </p>
          </div>
        </div>

        {/* Footer Commissions Section */}
        <div className="space-y-3 text-xs">
          <p className="font-bold text-slate-800">
            Este servicio cuenta con la siguiente comisión:
          </p>
          <p className="text-[#0679c8] font-medium">
            Tarjetas nacionales (Tarjeta débito y tarjeta crédito) 2,99% | Tarjetas internacionales y AMEX: 3,69%
          </p>
          <p className="text-[#0679c8] font-bold mt-1">
            Pago fijo TPV a $1,499 MXN
          </p>
        </div>
      </Card>
    </div>
  );
}
