import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { getPublicConfig, getPublicAvailability, createPublicAppointment, type PublicPatient, type PublicCreateAppointmentDto } from '../services/public-booking.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  
  const [patient, setPatient] = useState<PublicPatient>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    documentNumber: ''
  });

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['public-booking-config', slug],
    queryFn: () => getPublicConfig(slug!),
    enabled: !!slug
  });

  const { data: availability, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: ['public-booking-availability', slug, selectedBranch, selectedProfessional, selectedDate],
    queryFn: () => getPublicAvailability(slug!, { branchId: selectedBranch, professionalId: selectedProfessional, date: selectedDate }),
    enabled: !!slug && !!selectedBranch && !!selectedProfessional && !!selectedDate && step === 2
  });

  const mutation = useMutation({
    mutationFn: (dto: PublicCreateAppointmentDto) => createPublicAppointment(slug!, dto),
    onSuccess: () => {
      setStep(4);
    }
  });

  if (isLoading) return <div className="p-8 text-center flex items-center justify-center min-h-screen">Cargando portal de reservas...</div>;
  if (error || !config) return <div className="p-8 text-center text-red-500 flex items-center justify-center min-h-screen">Página de reserva no encontrada o no disponible.</div>;

  const handleNextStep1 = () => {
    if (selectedBranch && selectedProfessional) setStep(2);
  };

  const handleNextStep2 = () => {
    if (selectedSlot) setStep(3);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      branchId: selectedBranch,
      professionalId: selectedProfessional,
      startAt: selectedSlot,
      patient
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {config.brandColor && <div style={{ height: '8px', backgroundColor: config.brandColor }} />}
        
        <div className="p-8 text-center border-b border-slate-100">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <h1 className="text-2xl font-bold text-slate-800">Agendar Cita</h1>
          )}
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800">1. Selecciona Clínica y Profesional</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Sucursal</label>
                  <select 
                    className="w-full mt-1 border border-slate-300 rounded-md p-2 outline-none focus:border-blue-500"
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                  >
                    <option value="">Seleccionar Sucursal</option>
                    {config.branches?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Profesional</label>
                  <select 
                    className="w-full mt-1 border border-slate-300 rounded-md p-2 outline-none focus:border-blue-500"
                    value={selectedProfessional}
                    onChange={e => setSelectedProfessional(e.target.value)}
                  >
                    <option value="">Seleccionar Profesional</option>
                    {config.professionals?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button onClick={handleNextStep1} disabled={!selectedBranch || !selectedProfessional} className="w-full mt-6">
                Continuar
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">2. Selecciona Fecha y Hora</h2>
                <Button variant="secondary" size="sm" onClick={() => setStep(1)}>Volver</Button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700">Fecha de tu cita</label>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                />
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Horarios disponibles</label>
                {isAvailabilityLoading ? (
                  <p className="text-slate-500 text-sm">Buscando horarios...</p>
                ) : availability?.slots?.length ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {availability.slots.filter((s: any) => s.available).map((s: any) => {
                      const timeString = new Date(s.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <Button 
                          key={s.startAt} 
                          variant={selectedSlot === s.startAt ? 'primary' : 'secondary'}
                          onClick={() => setSelectedSlot(s.startAt)}
                          className={selectedSlot === s.startAt ? '' : 'text-slate-600'}
                        >
                          {timeString}
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No hay horarios disponibles para esta fecha. Intenta con otro día.</p>
                )}
              </div>

              <Button onClick={handleNextStep2} disabled={!selectedSlot} className="w-full mt-6">
                Continuar
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">3. Tus Datos Personales</h2>
                <Button variant="secondary" size="sm" onClick={() => setStep(2)}>Volver</Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Nombre *</label>
                    <Input required value={patient.firstName} onChange={e => setPatient({...patient, firstName: e.target.value})} className="mt-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Apellidos *</label>
                    <Input required value={patient.lastName} onChange={e => setPatient({...patient, lastName: e.target.value})} className="mt-1" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Email *</label>
                  <Input type="email" required value={patient.email} onChange={e => setPatient({...patient, email: e.target.value})} className="mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Teléfono *</label>
                  <Input required value={patient.phone} onChange={e => setPatient({...patient, phone: e.target.value})} className="mt-1" />
                </div>
                
                {config.identificationMethod === 'DOCUMENT' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Documento de Identidad (CURP/RFC) *</label>
                    <Input required value={patient.documentNumber} onChange={e => setPatient({...patient, documentNumber: e.target.value})} className="mt-1" />
                  </div>
                )}

                <Button type="submit" className="w-full mt-6 h-12 text-lg" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Confirmando reserva...' : 'Confirmar Reserva'}
                </Button>
              </form>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-12 space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-slate-800">¡Reserva Confirmada!</h2>
              <p className="text-slate-600 max-w-md mx-auto text-lg mt-4">
                {config.confirmationMessage || 'Tu cita ha sido agendada con éxito. Te esperamos pronto.'}
              </p>
              
              {config.redirectUrl && (
                <div className="mt-8">
                  <a href={config.redirectUrl} className="text-blue-600 font-medium hover:underline">
                    Volver a la página principal
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {config.footerText && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-sm text-slate-500">
            {config.footerText}
          </div>
        )}
      </div>
    </div>
  );
}
