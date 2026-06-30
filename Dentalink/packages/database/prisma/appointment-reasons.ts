export type AppointmentReasonSeed = {
  legacyId: number;
  name: string;
  durationMinutes: number;
  color: string;
  legacyNames?: string[];
};

export const GENERAL_APPOINTMENT_REASON_SEEDS: AppointmentReasonSeed[] = [
  { legacyId: 144, name: "1ER SESIÓN DE ENDODONCIA", durationMinutes: 30, color: "#ff9900", legacyNames: ["1RA SESION DE ENDODONCIA"] },
  { legacyId: 145, name: "2DA SESIÓN DE ENDODONCIA", durationMinutes: 30, color: "#ff9900", legacyNames: ["2DA SESION DE ENDODONCIA"] },
  { legacyId: 146, name: "3ER SESIÓN DE ENDODONCIA", durationMinutes: 30, color: "#ff9900", legacyNames: ["3RA SESIÓN DE ENDODONCIA"] },
  { legacyId: 148, name: "AJUSTE DE OCLUSIÓN", durationMinutes: 20, color: "#eeeeee", legacyNames: ["AJUSTE DE OCLUSION"] },
  { legacyId: 149, name: "AJUSTE DE PROTESIS", durationMinutes: 20, color: "#9900ff" },
  { legacyId: 150, name: "ALARGAMIENTO DE CORONA", durationMinutes: 30, color: "#2ef4c6" },
  { legacyId: 152, name: "APICECTOMIA", durationMinutes: 40, color: "#ff9900" },
  { legacyId: 153, name: "APLICACIÓN DE FLÚOR", durationMinutes: 20, color: "#2a9ce4", legacyNames: ["APLICACIÓN DE FLUOR"] },
  { legacyId: 154, name: "BIOPSIA", durationMinutes: 40, color: "#ff0000" },
  { legacyId: 155, name: "BLANQUEAMIENTO", durationMinutes: 40, color: "#00ff00" },
  { legacyId: 156, name: "CARILLAS", durationMinutes: 60, color: "#00ff00" },
  { legacyId: 157, name: "CEMENTADO DE CORONA", durationMinutes: 20, color: "#9900ff" },
  { legacyId: 158, name: "CIRUGÍA", durationMinutes: 40, color: "#ff0000", legacyNames: ["CIRUGIA"] },
  { legacyId: 159, name: "CITA DE SEGUIMIENTO IMPLANTOLOGIA", durationMinutes: 30, color: "#f1c232", legacyNames: ["CITA DE SEGUIMIENTO DE IMPLANTOLOGIA"] },
  { legacyId: 160, name: "COLOCACION DE ENDOPOSTE Y PREPARACIÓN PARA CORONA", durationMinutes: 30, color: "#9900ff", legacyNames: ["COLOCACION ENDOPOSTE Y PREPARACION PARA CORONA"] },
  { legacyId: 161, name: "COLOCACIÓN DE IMPLANTE", durationMinutes: 60, color: "#f1c232", legacyNames: ["COLOCACIÓN DE IMPLANTE"] },
  { legacyId: 164, name: "CONSULTA DIAGNOSTICO GENERAL", durationMinutes: 20, color: "#f4cccc" },
  { legacyId: 169, name: "CONSULTA DIAGNOSTICO ORTODONCIA", durationMinutes: 20, color: "#0000ff" },
  { legacyId: 175, name: "CURACION CON IONOMERO / ZOE", durationMinutes: 20, color: "#eeeeee", legacyNames: ["CURACION DE IONOMERO / ZOE"] },
  { legacyId: 176, name: "CURETAJE ABIERTO O CERRADO", durationMinutes: 30, color: "#2ef4c6" },
  { legacyId: 177, name: "DRENAJE DE ABCESO", durationMinutes: 20, color: "#ff9900" },
  { legacyId: 179, name: "ENTREGA DE PROTESIS", durationMinutes: 20, color: "#9900ff" },
  { legacyId: 180, name: "EXTRACCION", durationMinutes: 30, color: "#2ef4c6" },
  { legacyId: 181, name: "FERULIZACIÓN POR DIENTE", durationMinutes: 30, color: "#ff0000" },
  { legacyId: 182, name: "FRENILECTOMIA", durationMinutes: 30, color: "#ff0000" },
  { legacyId: 183, name: "GINGIVECTOMIA / GINGIVOPLASTIA", durationMinutes: 30, color: "#ff0000" },
  { legacyId: 184, name: "LIMPIEZA DENTAL PROFUNDA", durationMinutes: 30, color: "#2ef4c6" },
  { legacyId: 185, name: "LIMPIEZA Y CEPILLADO", durationMinutes: 20, color: "#2a9ce4" },
  { legacyId: 186, name: "MANTENIMIENTO Y REPARACIÓN DE PRÓTESIS", durationMinutes: 20, color: "#9900ff", legacyNames: ["MANTENIMIENTO Y REPARACION DE PROTESIS"] },
  { legacyId: 188, name: "MODELOS DE ESTUDIO Y FOTOGRAFIAS", durationMinutes: 30, color: "#45818e" },
  { legacyId: 189, name: "PREPARACIÓN PARA CORONA", durationMinutes: 30, color: "#9900ff", legacyNames: ["PREPARACIÓN PARA CORONA"] },
  { legacyId: 190, name: "PRUEBA DE ALTURA PROTESIS", durationMinutes: 20, color: "#9900ff" },
  { legacyId: 191, name: "PRUEBA DE BIZCOCHO", durationMinutes: 10, color: "#9900ff" },
  { legacyId: 192, name: "PRUEBA DE METAL", durationMinutes: 10, color: "#9900ff" },
  { legacyId: 193, name: "PRUEBA ENFILADO PROTESIS", durationMinutes: 20, color: "#9900ff" },
  { legacyId: 194, name: "PULPECTOMIA / PULPOTOMIA", durationMinutes: 30, color: "#6aa84f" },
  { legacyId: 195, name: "REGULARIZACIÓN DE PROCESO", durationMinutes: 30, color: "#2ef4c6", legacyNames: ["REGULARIZACIÓN DE PROCESO"] },
  { legacyId: 196, name: "RESINA", durationMinutes: 30, color: "#999999" },
  { legacyId: 216, name: "RETIRO DE BRACKETS", durationMinutes: 30, color: "#000000" },
  { legacyId: 198, name: "RETIRO DE PUNTOS", durationMinutes: 10, color: "#ff0000" },
  { legacyId: 199, name: "RETRATAMIENTO", durationMinutes: 40, color: "#ff9900" },
  { legacyId: 200, name: "REVALORACION", durationMinutes: 15, color: "#2a9ce4" },
  { legacyId: 201, name: "SELLADORES DE FOSETAS Y FISURAS", durationMinutes: 30, color: "#2a9ce4", legacyNames: ["SELLADOR DE FOSETAS Y FISURAS"] },
  { legacyId: 202, name: "TOMA DE IMPRESION", durationMinutes: 30, color: "#9900ff" },
  { legacyId: 203, name: "TOMA DE RADIOGRAFÍAS 2D", durationMinutes: 30, color: "#45818e", legacyNames: ["TOMA DE RADIOGRAFIAS 2D"] },
  { legacyId: 204, name: "TOMOGRAFIA 3D", durationMinutes: 30, color: "#45818e" },
  { legacyId: 205, name: "UPERCOLECTOMIA", durationMinutes: 30, color: "#ff0000" },
  { legacyId: 206, name: "VALORACIÓN CON ESPECIALISTA", durationMinutes: 30, color: "#2a9ce4", legacyNames: ["VALORACION CON ESPECIALISTA"] }
];

export const ORTHODONTICS_APPOINTMENT_REASON_SEEDS: AppointmentReasonSeed[] = [
  { legacyId: 207, name: "ADITAMENTOS ADICIONALES", durationMinutes: 30, color: "#000000" },
  { legacyId: 208, name: "ALINEADORES", durationMinutes: 60, color: "#000000" },
  { legacyId: 209, name: "COLOCACIÓN INFERIOR", durationMinutes: 30, color: "#000000" },
  { legacyId: 210, name: "COLOCACIÓN SUPERIOR", durationMinutes: 30, color: "#000000", legacyNames: ["COLOCACION SUPERIOR"] },
  { legacyId: 211, name: "CORRECCIONES DE APARATOLOGÍA", durationMinutes: 10, color: "#000000", legacyNames: ["CORRECCIONES A APARATOLOGIA"] },
  { legacyId: 212, name: "ENTREGA DE APARATOS DE ORTOPEDIA", durationMinutes: 20, color: "#000000" },
  { legacyId: 213, name: "MENSUALIDAD ORTODONCIA / ORTOPEDIA", durationMinutes: 20, color: "#000000" },
  { legacyId: 214, name: "REPOSICION Y CEMENTADO DE BRACKETS", durationMinutes: 20, color: "#000000" }
];

export const APPOINTMENT_REASON_SEEDS_BY_SPECIALTY = {
  "Odontología General (Integral)": GENERAL_APPOINTMENT_REASON_SEEDS,
  Ortodoncia: ORTHODONTICS_APPOINTMENT_REASON_SEEDS
} as const;
