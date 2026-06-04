export type AppointmentReasonSeed = {
  name: string;
  durationMinutes: number;
  color: string;
};

export const GENERAL_APPOINTMENT_REASON_SEEDS: AppointmentReasonSeed[] = [
  { name: "1ER SESIÓN DE ENDODONCIA", durationMinutes: 80, color: "#0ea5e9" },
  { name: "2DA SESION DE ENDODONCIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "3RA SESIÓN DE ENDODONCIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "AJUSTE DE OCLUSION", durationMinutes: 20, color: "#0ea5e9" },
  { name: "AJUSTE DE PROTESIS", durationMinutes: 40, color: "#0ea5e9" },
  { name: "ALARGAMIENTO DE CORONA", durationMinutes: 80, color: "#0ea5e9" },
  { name: "APICECTOMIA", durationMinutes: 120, color: "#0ea5e9" },
  { name: "APLICACIÓN DE FLUOR", durationMinutes: 20, color: "#0ea5e9" },
  { name: "BIOPSIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "BLANQUEAMIENTO", durationMinutes: 80, color: "#0ea5e9" },
  { name: "CARILLAS", durationMinutes: 120, color: "#0ea5e9" },
  { name: "CEMENTADO DE CORONA", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CIRUGIA", durationMinutes: 120, color: "#0ea5e9" },
  { name: "CITA DE SEGUIMIENTO DE IMPLANTOLOGIA", durationMinutes: 40, color: "#0ea5e9" },
  { name: "COLOCACIÓN DE IMPLANTE", durationMinutes: 120, color: "#0ea5e9" },
  { name: "COLOCACION ENDOPOSTE Y PREPARACION PARA CORONA", durationMinutes: 80, color: "#0ea5e9" },
  { name: "CONSULTA DIAGNOSTICO GENERAL", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CONSULTA DIAGNOSTICO GENERAL - CARLOS M", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CONSULTA DIAGNOSTICO GENERAL - JHOVANA T", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CONSULTA DIAGNOSTICO GENERAL - OSIRIS C", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CONSULTA DIAGNOSTICO GENERAL - RUBEN L", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CURACION DE IONOMERO / ZOE", durationMinutes: 40, color: "#0ea5e9" },
  { name: "CURETAJE ABIERTO O CERRADO", durationMinutes: 80, color: "#0ea5e9" },
  { name: "DRENAJE DE ABCESO", durationMinutes: 40, color: "#0ea5e9" },
  { name: "ENTREGA DE PROTESIS", durationMinutes: 40, color: "#0ea5e9" },
  { name: "EXTRACCION", durationMinutes: 60, color: "#0ea5e9" },
  { name: "FERULIZACIÓN POR DIENTE", durationMinutes: 40, color: "#0ea5e9" },
  { name: "FRENILECTOMIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "GINGIVECTOMIA / GINGIVOPLASTIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "LIMPIEZA DENTAL PROFUNDA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "LIMPIEZA Y CEPILLADO", durationMinutes: 40, color: "#0ea5e9" },
  { name: "MANTENIMIENTO Y REPARACION DE PROTESIS", durationMinutes: 60, color: "#0ea5e9" },
  { name: "MODELOS DE ESTUDIO Y FOTOGRAFIAS", durationMinutes: 40, color: "#0ea5e9" },
  { name: "PREPARACIÓN PARA CORONA", durationMinutes: 80, color: "#0ea5e9" },
  { name: "PRUEBA DE ALTURA PROTESIS", durationMinutes: 40, color: "#0ea5e9" },
  { name: "PRUEBA DE BIZCOCHO", durationMinutes: 40, color: "#0ea5e9" },
  { name: "PRUEBA DE METAL", durationMinutes: 40, color: "#0ea5e9" },
  { name: "PRUEBA ENFILADO PROTESIS", durationMinutes: 40, color: "#0ea5e9" },
  { name: "PULPECTOMIA / PULPOTOMIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "REGULARIZACIÓN DE PROCESO", durationMinutes: 80, color: "#0ea5e9" },
  { name: "RESINA", durationMinutes: 40, color: "#0ea5e9" },
  { name: "RETIRO DE PUNTOS", durationMinutes: 20, color: "#0ea5e9" },
  { name: "RETRATAMIENTO", durationMinutes: 80, color: "#0ea5e9" },
  { name: "REVALORACION", durationMinutes: 40, color: "#0ea5e9" },
  { name: "SELLADOR DE FOSETAS Y FISURAS", durationMinutes: 20, color: "#0ea5e9" },
  { name: "TOMA DE IMPRESION", durationMinutes: 40, color: "#0ea5e9" },
  { name: "TOMA DE RADIOGRAFIAS 2D", durationMinutes: 20, color: "#0ea5e9" },
  { name: "TOMOGRAFIA 3D", durationMinutes: 40, color: "#0ea5e9" },
  { name: "UPERCOLECTOMIA", durationMinutes: 60, color: "#0ea5e9" },
  { name: "VALORACION CON ESPECIALISTA", durationMinutes: 40, color: "#0ea5e9" }
];

export const ORTHODONTICS_APPOINTMENT_REASON_SEEDS: AppointmentReasonSeed[] = [
  { name: "ADITAMENTOS ADICIONALES", durationMinutes: 20, color: "#7c3aed" },
  { name: "ALINEADORES", durationMinutes: 40, color: "#7c3aed" },
  { name: "COLOCACIÓN INFERIOR", durationMinutes: 60, color: "#7c3aed" },
  { name: "COLOCACION SUPERIOR", durationMinutes: 60, color: "#7c3aed" },
  { name: "CORRECCIONES A APARATOLOGIA", durationMinutes: 40, color: "#7c3aed" },
  { name: "ENTREGA DE APARATOS DE ORTOPEDIA", durationMinutes: 40, color: "#7c3aed" },
  { name: "MENSUALIDAD ORTODONCIA / ORTOPEDIA", durationMinutes: 20, color: "#7c3aed" },
  { name: "REPOSICION Y CEMENTADO DE BRACKETS", durationMinutes: 40, color: "#7c3aed" },
  { name: "CONSULTA DIAGNOSTICO ORTODONCIA", durationMinutes: 40, color: "#7c3aed" },
  { name: "CONSULTA DIAGNOSTICO ORTODONCIA - CARLOS M", durationMinutes: 40, color: "#7c3aed" },
  { name: "CONSULTA DIAGNOSTICO ORTODONCIA - JHOVANA T", durationMinutes: 40, color: "#7c3aed" },
  { name: "CONSULTA DIAGNOSTICO ORTODONCIA - OSIRIS C", durationMinutes: 40, color: "#7c3aed" },
  { name: "CONSULTA DIAGNOSTICO ORTODONCIA - RUBEN L", durationMinutes: 40, color: "#7c3aed" },
  { name: "RETIRO DE BRACKETS", durationMinutes: 60, color: "#7c3aed" }
];

export const APPOINTMENT_REASON_SEEDS_BY_SPECIALTY = {
  "Odontología General (Integral)": GENERAL_APPOINTMENT_REASON_SEEDS,
  Ortodoncia: ORTHODONTICS_APPOINTMENT_REASON_SEEDS
} as const;
