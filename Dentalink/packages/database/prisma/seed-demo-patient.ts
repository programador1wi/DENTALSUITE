import {
  PrismaClient,
  ToothProcedureStatus,
  InstallmentStatus,
  CollectionCaseStatus,
  PatientStatus,
  AppointmentStatus,
  TreatmentPlanStatus,
  TreatmentPlanItemStatus,
  BudgetStatus,
  PaymentStatus,
  InstallmentFrequency,
  InstallmentPlanStatus,
  CashRegisterStatus,
  CashMovementType,
  LabOrderStatus,
  InventoryMovementType,
  CurrencyCode,
  PaymentMethodType
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

// Cargar variables de entorno del monorepo
loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function demoDateAt(hours: number, minutes = 0, dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function demoDateRange(hours: number, minutes: number, durationMinutes: number, dayOffset = 0) {
  const startAt = demoDateAt(hours, minutes, dayOffset);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  return { startAt, endAt, durationMinutes };
}

async function cleanOldDemoData() {
  console.log("Iniciando limpieza profunda de datos demo anteriores...");

  // 1. Actividades de Cobranza (CollectionActivity)
  await prisma.collectionActivity.deleteMany({
    where: {
      collectionCase: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 2. Casos de Cobranza (CollectionCase)
  await prisma.collectionCase.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 3. Cuotas (Installment)
  await prisma.installment.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 4. Planes de Cuotas (InstallmentPlan)
  await prisma.installmentPlan.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 5. Asignaciones de Pago (PaymentAllocation)
  await prisma.paymentAllocation.deleteMany({
    where: {
      treatmentPlanItem: {
        treatmentPlan: {
          patient: {
            email: { endsWith: "@dentalwarner.local" }
          }
        }
      }
    }
  });

  // 6. Pagos (Payment)
  await prisma.payment.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 7. Items de Presupuesto (BudgetItem)
  await prisma.budgetItem.deleteMany({
    where: {
      budget: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 8. Presupuestos (Budget)
  await prisma.budget.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 9. Procedimientos dentales (ToothProcedure)
  await prisma.toothProcedure.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 10. Condiciones dentales (ToothCondition)
  await prisma.toothCondition.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 11. Registros de Odontograma (OdontogramRecord)
  await prisma.odontogramRecord.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 12. Mediciones Periodontales (PeriodontalMeasurement)
  await prisma.periodontalMeasurement.deleteMany({
    where: {
      periodontalChart: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 13. Gráficas Periodontales (PeriodontalChart)
  await prisma.periodontalChart.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 14. Items de Plan de Tratamiento (TreatmentPlanItem)
  await prisma.treatmentPlanItem.deleteMany({
    where: {
      treatmentPlan: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 15. Secciones de Plan de Tratamiento (TreatmentPlanSection)
  await prisma.treatmentPlanSection.deleteMany({
    where: {
      treatmentPlan: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 16. Alternativas de Plan de Tratamiento (TreatmentPlanAlternative)
  await prisma.treatmentPlanAlternative.deleteMany({
    where: {
      OR: [
        {
          parentTreatmentPlan: {
            patient: {
              email: { endsWith: "@dentalwarner.local" }
            }
          }
        },
        {
          alternativeTreatmentPlan: {
            patient: {
              email: { endsWith: "@dentalwarner.local" }
            }
          }
        }
      ]
    }
  });

  // 17. Planes de Tratamiento (TreatmentPlan)
  await prisma.treatmentPlan.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 18. Items de Receta (PrescriptionItem)
  await prisma.prescriptionItem.deleteMany({
    where: {
      prescription: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 19. Recetas (Prescription)
  await prisma.prescription.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 20. Evoluciones Clínicas (ClinicalEvolution)
  await prisma.clinicalEvolution.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 21. Alergias (Allergy)
  await prisma.allergy.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 22. Medicamentos (Medication)
  await prisma.medication.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 23. Condiciones Médicas (MedicalCondition)
  await prisma.medicalCondition.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 24. Historial Médico (MedicalHistory)
  await prisma.medicalHistory.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 25. Alertas Médicas (PatientMedicalAlert)
  await prisma.patientMedicalAlert.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 26. Notas de Paciente (PatientNote)
  await prisma.patientNote.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 27. Contactos de Paciente (PatientContact)
  await prisma.patientContact.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 28. Direcciones de Paciente (PatientAddress)
  await prisma.patientAddress.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 29. Items de Orden de Laboratorio (LabOrderItem)
  await prisma.labOrderItem.deleteMany({
    where: {
      labOrder: {
        patient: {
          email: { endsWith: "@dentalwarner.local" }
        }
      }
    }
  });

  // 30. Orden de Laboratorio (LabOrder)
  await prisma.labOrder.deleteMany({
    where: {
      patient: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 31. Historial de Estatus de Citas (AppointmentStatusHistory)
  await prisma.appointmentStatusHistory.deleteMany({
    where: {
      appointment: {
        OR: [
          { patient: { email: { endsWith: "@dentalwarner.local" } } },
          { title: { startsWith: "[DEMO]" } }
        ]
      }
    }
  });

  // 32. Notas de Citas (AppointmentNote)
  await prisma.appointmentNote.deleteMany({
    where: {
      appointment: {
        OR: [
          { patient: { email: { endsWith: "@dentalwarner.local" } } },
          { title: { startsWith: "[DEMO]" } }
        ]
      }
    }
  });

  // 33. Recordatorios de Citas (AppointmentReminder)
  await prisma.appointmentReminder.deleteMany({
    where: {
      appointment: {
        OR: [
          { patient: { email: { endsWith: "@dentalwarner.local" } } },
          { title: { startsWith: "[DEMO]" } }
        ]
      }
    }
  });

  // 34. Citas (Appointment)
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { patient: { email: { endsWith: "@dentalwarner.local" } } },
        { title: { startsWith: "[DEMO]" } }
      ]
    }
  });

  // 35. Pacientes (Patient)
  await prisma.patient.deleteMany({
    where: {
      email: { endsWith: "@dentalwarner.local" }
    }
  });

  // 36. Movimientos de Caja (CashMovement)
  await prisma.cashMovement.deleteMany({
    where: {
      cashRegister: {
        organization: { slug: "dentalwarner" }
      }
    }
  });

  // 37. Cajas (CashRegister)
  await prisma.cashRegister.deleteMany({
    where: {
      organization: { slug: "dentalwarner" }
    }
  });

  // 38. Movimientos de Inventario (InventoryMovement)
  await prisma.inventoryMovement.deleteMany({
    where: {
      inventoryItem: {
        organization: { slug: "dentalwarner" }
      }
    }
  });

  // 39. Artículos de Inventario (InventoryItem)
  await prisma.inventoryItem.deleteMany({
    where: {
      organization: { slug: "dentalwarner" }
    }
  });

  // 40. Proveedores (Supplier)
  await prisma.supplier.deleteMany({
    where: {
      organization: { slug: "dentalwarner" }
    }
  });

  // 41. Laboratorios (LabProvider)
  await prisma.labProvider.deleteMany({
    where: {
      organization: { slug: "dentalwarner" }
    }
  });

  // 42. Agendas Profesionales (ProfessionalSchedule)
  await prisma.professionalSchedule.deleteMany({
    where: {
      professional: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 43. Sucursales Profesionales (ProfessionalBranch)
  await prisma.professionalBranch.deleteMany({
    where: {
      professional: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 44. Especialidades Profesionales (ProfessionalSpecialty)
  await prisma.professionalSpecialty.deleteMany({
    where: {
      professional: {
        email: { endsWith: "@dentalwarner.local" }
      }
    }
  });

  // 45. Profesionales (Professional)
  await prisma.professional.deleteMany({
    where: {
      email: { endsWith: "@dentalwarner.local" }
    }
  });

  console.log("¡Limpieza de registros anteriores completada exitosamente!");
}

async function main() {
  console.log("Iniciando seed de demostración enriquecido...");

  // Limpiar cualquier residuo de ejecuciones previas
  await cleanOldDemoData();

  // 1. Obtener la Organización por defecto
  const orgSlug = process.env.SEED_ORGANIZATION_SLUG ?? "dentalwarner";
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug }
  });
  if (!organization) {
    throw new Error(`Organización no encontrada con slug: ${orgSlug}. Ejecuta primero el seed principal.`);
  }

  // 2. Obtener la Sucursal por defecto
  const defaultBranchCode = process.env.SEED_DEFAULT_BRANCH_CODE ?? "MATRIZ";
  const branch = await prisma.branch.findFirst({
    where: { organizationId: organization.id, code: defaultBranchCode }
  });
  if (!branch) {
    throw new Error(`Sucursal no encontrada con código: ${defaultBranchCode}. Ejecuta primero el seed principal.`);
  }

  // 3. Obtener el Usuario Administrador para auditorías y asignación
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@dentalwarner.local";
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  });
  if (!adminUser) {
    throw new Error(`Usuario administrador no encontrado con email: ${adminEmail}. Ejecuta primero el seed principal.`);
  }

  // 4. Crear/Upsert Especialidades Clínicas
  console.log("Configurando especialidades de la clínica...");
  const specGeneral = await prisma.specialty.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Odontología General y Estética" } },
    update: {},
    create: { organizationId: organization.id, name: "Odontología General y Estética", description: "Cuidado general y estética dental elemental" }
  });
  const specOrtodoncia = await prisma.specialty.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Ortodoncia y Ortopedia Maxilofacial" } },
    update: {},
    create: { organizationId: organization.id, name: "Ortodoncia y Ortopedia Maxilofacial", description: "Corrección de anomalías dento-faciales y brackets" }
  });
  const specEndodoncia = await prisma.specialty.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Endodoncia Avanzada" } },
    update: {},
    create: { organizationId: organization.id, name: "Endodoncia Avanzada", description: "Tratamiento de conductos radiculares y conservación dental" }
  });
  const specPediatria = await prisma.specialty.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Odontopediatría" } },
    update: {},
    create: { organizationId: organization.id, name: "Odontopediatría", description: "Cuidado dental integral infantil y preventivo" }
  });
  const specImplantologia = await prisma.specialty.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Implantología y Prótesis Oral" } },
    update: {},
    create: { organizationId: organization.id, name: "Implantología y Prótesis Oral", description: "Rehabilitación bucal con implantes y coronas estéticas" }
  });

  // 5. Configurar/Upsert Profesionales Clínicos
  console.log("Configurando profesionales de la salud...");
  const profMendoza = await prisma.professional.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "alejandro.mendoza@dentalwarner.local" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      firstName: "Alejandro",
      lastName: "Mendoza",
      email: "alejandro.mendoza@dentalwarner.local",
      licenseNumber: "DF-90812-A",
      phone: "+525599887766",
      color: "#0284c7",
      isActive: true,
      userId: adminUser.id
    }
  });

  const profVega = await prisma.professional.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "sofia.vega@dentalwarner.local" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      firstName: "Sofía",
      lastName: "Vega",
      email: "sofia.vega@dentalwarner.local",
      licenseNumber: "DF-45321-O",
      phone: "+525544332211",
      color: "#ec4899", // Rosa premium
      isActive: true
    }
  });

  const profRuiz = await prisma.professional.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "carlos.ruiz@dentalwarner.local" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      firstName: "Carlos",
      lastName: "Ruiz",
      email: "carlos.ruiz@dentalwarner.local",
      licenseNumber: "DF-88123-E",
      phone: "+525566778899",
      color: "#8b5cf6", // Violeta
      isActive: true
    }
  });

  const profGomez = await prisma.professional.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "laura.gomez@dentalwarner.local" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      firstName: "Laura",
      lastName: "Gómez",
      email: "laura.gomez@dentalwarner.local",
      licenseNumber: "DF-11223-P",
      phone: "+525522446688",
      color: "#10b981", // Esmeralda
      isActive: true
    }
  });

  // Vincular Especialidades a Profesionales
  await prisma.professionalSpecialty.createMany({
    data: [
      { professionalId: profMendoza.id, specialtyId: specGeneral.id },
      { professionalId: profVega.id, specialtyId: specOrtodoncia.id },
      { professionalId: profRuiz.id, specialtyId: specEndodoncia.id },
      { professionalId: profRuiz.id, specialtyId: specImplantologia.id },
      { professionalId: profGomez.id, specialtyId: specPediatria.id }
    ]
  });

  // Asignar Profesionales a Sucursal Matriz
  const profs = [profMendoza, profVega, profRuiz, profGomez];
  for (const prof of profs) {
    await prisma.professionalBranch.create({
      data: { professionalId: prof.id, branchId: branch.id, isPrimary: true }
    });
  }

  console.log("Configurando horarios activos para agenda y disponibilidad...");
  const workingDays = [1, 2, 3, 4, 5, 6];
  await prisma.professionalSchedule.createMany({
    data: profs.flatMap((prof) =>
      workingDays.map((dayOfWeek) => ({
        professionalId: prof.id,
        branchId: branch.id,
        dayOfWeek,
        startTime: dayOfWeek === 6 ? "09:00" : "08:00",
        endTime: dayOfWeek === 6 ? "14:00" : "20:00",
        breakStartTime: dayOfWeek === 6 ? null : "14:00",
        breakEndTime: dayOfWeek === 6 ? null : "15:00",
        isActive: true
      }))
    )
  });

  // 6. Configurar Sillones Clínicos (Chairs)
  console.log("Configurando sillones físicos (Chairs)...");
  const chairAzul = await prisma.chair.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Sillón Azul - Operatoria" } },
    update: { isActive: true },
    create: { organizationId: organization.id, branchId: branch.id, name: "Sillón Azul - Operatoria", description: "Uso general de limpiezas y resinas", isActive: true }
  });
  const chairVerde = await prisma.chair.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Sillón Verde - Ortodoncia" } },
    update: { isActive: true },
    create: { organizationId: organization.id, branchId: branch.id, name: "Sillón Verde - Ortodoncia", description: "Ortodoncia activa y preventiva", isActive: true }
  });
  const chairNaranja = await prisma.chair.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Sillón Naranja - Quirúrgico" } },
    update: { isActive: true },
    create: { organizationId: organization.id, branchId: branch.id, name: "Sillón Naranja - Quirúrgico", description: "Endodoncia, Implantes y Cirugía menor", isActive: true }
  });

  // 7. Configurar Convenios (Agreements)
  console.log("Configurando convenios comerciales...");
  const agreeTepeyac = await prisma.agreement.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Convenio Escolar Colegio Tepeyac" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      name: "Convenio Escolar Colegio Tepeyac",
      description: "15% de descuento directo en tratamientos preventivos de pediatría",
      discountPercent: 15.00,
      isActive: true
    }
  });

  const agreeMetLife = await prisma.agreement.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Seguro Dental MetLife" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      name: "Seguro Dental MetLife",
      description: "Convenio con aseguradora MetLife - 10% de copago clínico general",
      discountPercent: 10.00,
      isActive: true
    }
  });

  // 8. Procedimientos y Categorías de Tratamiento
  console.log("Configurando procedimientos y categorías...");
  const catDiag = await prisma.procedureCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Diagnóstico e Higiene" } },
    update: {},
    create: { organizationId: organization.id, name: "Diagnóstico e Higiene", sortOrder: 1 }
  });
  const catRestauradora = await prisma.procedureCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Restauradora" } },
    update: {},
    create: { organizationId: organization.id, name: "Restauradora", sortOrder: 2 }
  });
  const catOrto = await prisma.procedureCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Ortodoncia" } },
    update: {},
    create: { organizationId: organization.id, name: "Ortodoncia", sortOrder: 3 }
  });
  const catEndo = await prisma.procedureCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Endodoncia" } },
    update: {},
    create: { organizationId: organization.id, name: "Endodoncia", sortOrder: 4 }
  });
  const catPed = await prisma.procedureCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Odontopediatría" } },
    update: {},
    create: { organizationId: organization.id, name: "Odontopediatría", sortOrder: 5 }
  });
  const catImpl = await prisma.procedureCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Implantología y Prótesis" } },
    update: {},
    create: { organizationId: organization.id, name: "Implantología y Prótesis", sortOrder: 6 }
  });

  // Procedimientos Maestros
  const procProfilaxis = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "DIAG-01" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catDiag.id, code: "DIAG-01", name: "Profilaxis Dental y Limpieza Ultrasónica", defaultDuration: 30 }
  });
  const procResina = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "REST-01" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catRestauradora.id, code: "REST-01", name: "Resina Compuesta de Fotocurado", defaultDuration: 45, requiresTooth: true, requiresSurface: true }
  });
  const procBracketAutoligado = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "ORT-01" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catOrto.id, code: "ORT-01", name: "Brackets Autoligados Estéticos Damon", defaultDuration: 90 }
  });
  const procControlOrto = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "ORT-02" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catOrto.id, code: "ORT-02", name: "Ajuste y Control Mensual de Ortodoncia", defaultDuration: 30 }
  });
  const procEndodonciaMolar = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "ENDO-01" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catEndo.id, code: "ENDO-01", name: "Tratamiento de Conductos Molar (Endodoncia)", defaultDuration: 60, requiresTooth: true }
  });
  const procReconstruccionPostEndo = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "ENDO-02" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catEndo.id, code: "ENDO-02", name: "Reconstrucción Dentaria Post-Endodontica con Poste de Fibra", defaultDuration: 45, requiresTooth: true }
  });
  const procProfilaxisInfantil = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PED-01" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catPed.id, code: "PED-01", name: "Profilaxis Infantil y Fluoración con Barniz", defaultDuration: 30 }
  });
  const procSelladores = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PED-02" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catPed.id, code: "PED-02", name: "Sellador de Fosetas y Fisuras (Por Pieza)", defaultDuration: 20, requiresTooth: true }
  });
  const procImplanteTitanio = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "IMP-01" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catImpl.id, code: "IMP-01", name: "Implante Dental Biocompatible de Titanio Straumann", defaultDuration: 60, requiresTooth: true }
  });
  const procCoronaZirconio = await prisma.procedure.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "REHAB-02" } },
    update: {},
    create: { organizationId: organization.id, categoryId: catImpl.id, code: "REHAB-02", name: "Corona de Zirconio Monolítico Premium (Sobre Implante)", defaultDuration: 60, requiresTooth: true, requiresLab: true }
  });

  // 9. Configurar Lista de Precios General
  console.log("Configurando lista de precios maestros...");
  const generalPriceList = await prisma.priceList.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Lista de Precios General" } },
    update: {},
    create: { organizationId: organization.id, name: "Lista de Precios General", description: "Tarifario estándar de la clínica", isDefault: true }
  });

  // Limpiar precios anteriores para evitar duplicados
  await prisma.priceListItem.deleteMany({
    where: { priceListId: generalPriceList.id }
  });

  const standardPrices = [
    { procId: procProfilaxis.id, price: 500.00 },
    { procId: procResina.id, price: 1200.00 },
    { procId: procBracketAutoligado.id, price: 25000.00 },
    { procId: procControlOrto.id, price: 1200.00 },
    { procId: procEndodonciaMolar.id, price: 4500.00 },
    { procId: procReconstruccionPostEndo.id, price: 1800.00 },
    { procId: procProfilaxisInfantil.id, price: 600.00 },
    { procId: procSelladores.id, price: 450.00 },
    { procId: procImplanteTitanio.id, price: 18000.00 },
    { procId: procCoronaZirconio.id, price: 6500.00 }
  ];

  await prisma.priceListItem.createMany({
    data: standardPrices.map((p) => ({
      priceListId: generalPriceList.id,
      procedureId: p.procId,
      price: p.price,
      currency: "MXN"
    }))
  });

  // Métodos de Pago
  const methodEfectivo = await prisma.paymentMethod.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Efectivo" } },
    update: { isActive: true },
    create: { organizationId: organization.id, name: "Efectivo", type: "CASH", isActive: true }
  });
  const methodTarjeta = await prisma.paymentMethod.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Tarjeta de Crédito/Débito" } },
    update: { isActive: true },
    create: { organizationId: organization.id, name: "Tarjeta de Crédito/Débito", type: "CARD", isActive: true }
  });
  const methodTransfer = await prisma.paymentMethod.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Transferencia Interbancaria" } },
    update: { isActive: true },
    create: { organizationId: organization.id, name: "Transferencia Interbancaria", type: "TRANSFER", isActive: true }
  });

  // ==========================================
  // PACIENTE 1: Juan Demostración
  // Módulo: Caries General, Cobros Morosos en Pipeline
  // ==========================================
  console.log("Sembrando Paciente 1: Juan Demostración...");
  const birthDateJuan = new Date();
  birthDateJuan.setFullYear(birthDateJuan.getFullYear() - 45);

  const patientJuan = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      firstName: "Juan",
      lastName: "Demostración",
      birthDate: birthDateJuan,
      gender: "MALE",
      documentType: "INE",
      documentNumber: "DEMO1234567890",
      email: "juan.demo@dentalwarner.local",
      phone: "+525512345678",
      alternatePhone: "+525598765432",
      occupation: "Ingeniero de Software",
      referredBy: "Recomendación familiar",
      source: "Campañas de Redes Sociales",
      status: "DEBTOR"
    }
  });

  // Diagnóstico Médico Juan
  await prisma.medicalHistory.create({
    data: { patientId: patientJuan.id, bloodType: "O+", hasDiabetes: false, hasHypertension: true, notes: "Hipertensión controlada con Enalapril." }
  });
  await prisma.patientMedicalAlert.create({
    data: { patientId: patientJuan.id, type: "ALERGIA", description: "Alergia severa a la Penicilina", severity: "HIGH", isActive: true }
  });
  await prisma.allergy.create({
    data: { patientId: patientJuan.id, name: "Penicilina", reaction: "Choque anafiláctico", severity: "HIGH" }
  });

  // Odontograma Clínico Juan
  const record11O = await prisma.odontogramRecord.create({
    data: { patientId: patientJuan.id, professionalId: profMendoza.id, toothNumber: "11", surface: "O", condition: "Caries", diagnosis: "Caries esmalte/dentina oclusal", status: ToothProcedureStatus.CANCELLED }
  });
  await prisma.toothCondition.create({
    data: { patientId: patientJuan.id, odontogramRecordId: record11O.id, toothNumber: "11", surface: "O", condition: "Caries", diagnosis: "Caries de esmalte y dentina (Oclusal)" }
  });

  const record12Ausente = await prisma.odontogramRecord.create({
    data: { patientId: patientJuan.id, professionalId: profMendoza.id, toothNumber: "12", surface: "ALL", condition: "Pieza Ausente", status: ToothProcedureStatus.CANCELLED }
  });
  await prisma.toothCondition.create({
    data: { patientId: patientJuan.id, odontogramRecordId: record12Ausente.id, toothNumber: "12", surface: "ALL", condition: "Ausente" }
  });

  const record36O = await prisma.odontogramRecord.create({
    data: { patientId: patientJuan.id, professionalId: profMendoza.id, toothNumber: "36", surface: "O", condition: "TOOTH_PROCEDURE", status: ToothProcedureStatus.COMPLETED }
  });
  const proc36 = await prisma.toothProcedure.create({
    data: { patientId: patientJuan.id, professionalId: profMendoza.id, procedureId: procResina.id, odontogramRecordId: record36O.id, toothNumber: "36", surface: "O", diagnosis: "Caries oclusal profunda", status: ToothProcedureStatus.COMPLETED, completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  // SOAP Evolución Juan
  const evolutionJuan = await prisma.clinicalEvolution.create({
    data: {
      patientId: patientJuan.id,
      professionalId: profMendoza.id,
      subjective: "Asiste a su cita para fase operatoria activa en pieza 36.",
      objective: "Anestesia local exitosa. Aislamiento absoluto con dique de goma en 36. Cavidad oclusal limpia.",
      assessment: "Caries oclusal en pieza 36 resuelta satisfactoriamente.",
      plan: "Se realiza grabado ácido, adhesivo de 5ta generación y colocación de resina compuesta por capas en 36-O. Ajuste de oclusión y pulido.",
      signedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      signedById: adminUser.id,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  });
  await prisma.toothProcedure.update({ where: { id: proc36.id }, data: { clinicalEvolutionId: evolutionJuan.id } });

  // Plan Financiero Juan
  const planJuan = await prisma.treatmentPlan.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientJuan.id,
      professionalId: profMendoza.id,
      name: "Plan de Tratamiento Operatoria General - Juan",
      description: "Profilaxis y Resinas",
      status: "ACCEPTED",
      acceptedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    }
  });

  const secJuan = await prisma.treatmentPlanSection.create({
    data: { treatmentPlanId: planJuan.id, name: "Fase 1", sortOrder: 1 }
  });

  const tpProfilaxis = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planJuan.id, sectionId: secJuan.id, procedureId: procProfilaxis.id, quantity: 1, unitPrice: 500, total: 500, status: "COMPLETED", completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
  });
  const tpResina36 = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planJuan.id, sectionId: secJuan.id, procedureId: procResina.id, toothNumber: "36", surface: "O", quantity: 1, unitPrice: 1200, total: 1200, status: "COMPLETED", completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });
  const tpResina11 = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planJuan.id, sectionId: secJuan.id, procedureId: procResina.id, toothNumber: "11", surface: "O", quantity: 1, unitPrice: 1200, total: 1200, status: "ACCEPTED" }
  });

  // Presupuesto Juan
  const budgetJuan = await prisma.budget.create({
    data: {
      organizationId: organization.id,
      treatmentPlanId: planJuan.id,
      patientId: patientJuan.id,
      professionalId: profMendoza.id,
      subtotal: 2900.00,
      discountTotal: 0.00,
      total: 2900.00,
      status: "ACCEPTED",
      acceptedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.budgetItem.createMany({
    data: [
      { budgetId: budgetJuan.id, treatmentPlanItemId: tpProfilaxis.id, description: procProfilaxis.name, quantity: 1, unitPrice: 500, total: 500 },
      { budgetId: budgetJuan.id, treatmentPlanItemId: tpResina36.id, description: "Resina compuesta pieza 36-O", quantity: 1, unitPrice: 1200, total: 1200 },
      { budgetId: budgetJuan.id, treatmentPlanItemId: tpResina11.id, description: "Resina compuesta pieza 11-O", quantity: 1, unitPrice: 1200, total: 1200 }
    ]
  });

  // Plan de Cuotas de Juan
  const instPlanJuan = await prisma.installmentPlan.create({
    data: {
      organizationId: organization.id,
      patientId: patientJuan.id,
      treatmentPlanId: planJuan.id,
      totalAmount: 2900.00,
      downPayment: 900.00,
      financedAmount: 2000.00,
      numberOfInstallments: 2,
      frequency: "MONTHLY",
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      status: "ACTIVE"
    }
  });

  // Cuota 1: Venció hace 30 días. Morosa.
  const instJuan1 = await prisma.installment.create({
    data: {
      installmentPlanId: instPlanJuan.id,
      patientId: patientJuan.id,
      number: 1,
      dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      amount: 1000.00,
      paidAmount: 0.00,
      status: InstallmentStatus.OVERDUE
    }
  });

  // Cuota 2: Vence hoy. Morosa.
  const instJuan2 = await prisma.installment.create({
    data: {
      installmentPlanId: instPlanJuan.id,
      patientId: patientJuan.id,
      number: 2,
      dueDate: new Date(),
      amount: 1000.00,
      paidAmount: 0.00,
      status: InstallmentStatus.OVERDUE
    }
  });

  // Caso en Cobranza en Mora
  const caseJuan = await prisma.collectionCase.create({
    data: {
      patientId: patientJuan.id,
      installmentId: instJuan1.id,
      treatmentPlanId: planJuan.id,
      amountDue: 2000.00,
      daysOverdue: 30,
      status: CollectionCaseStatus.PENDING,
      assignedToId: adminUser.id,
      lastContactAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      nextContactAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    }
  });

  // Registrar Actividad de Cobranza
  await prisma.collectionActivity.create({
    data: {
      collectionCaseId: caseJuan.id,
      userId: adminUser.id,
      channel: "LLAMADA",
      result: "COMPROMISO_DE_PAGO",
      notes: "Se conversó con Don Juan. Indica que tuvo un retraso laboral pero se compromete a liquidar los $2,000 MXN vencidos el viernes."
    }
  });

  // ==========================================
  // PACIENTE 2: Sofía Castro
  // Módulo: Ortodoncia Estética Damon - Financiamiento Completo
  // ==========================================
  console.log("Sembrando Paciente 2: Sofía Castro (Ortodoncia)...");
  const birthDateSofia = new Date();
  birthDateSofia.setFullYear(birthDateSofia.getFullYear() - 26);

  const patientSofia = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      firstName: "Sofía",
      lastName: "Castro",
      birthDate: birthDateSofia,
      gender: "FEMALE",
      documentType: "INE",
      documentNumber: "SOFI9928372647",
      email: "sofia.castro@dentalwarner.local",
      phone: "+525522334455",
      occupation: "Diseñadora Gráfica",
      referredBy: "Anuncio de Instagram",
      source: "Instagram Ads",
      status: "IN_TREATMENT"
    }
  });

  // Ficha médica
  await prisma.medicalHistory.create({
    data: { patientId: patientSofia.id, bloodType: "A+", notes: "Sin enfermedades sistémicas. Buena salud general." }
  });

  // Odontograma Ortodoncia
  const teethOrto = ["13", "14", "15", "23", "24", "25"];
  for (const tooth of teethOrto) {
    const recOrto = await prisma.odontogramRecord.create({
      data: { patientId: patientSofia.id, professionalId: profVega.id, toothNumber: tooth, surface: "ALL", condition: "Aparato de Ortodoncia Fijo", status: ToothProcedureStatus.IN_PROGRESS }
    });
    await prisma.toothCondition.create({
      data: { patientId: patientSofia.id, odontogramRecordId: recOrto.id, toothNumber: tooth, surface: "ALL", condition: "Ortodoncia" }
    });
  }

  // Plan Ortodoncia
  const planSofia = await prisma.treatmentPlan.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      professionalId: profVega.id,
      name: "Tratamiento Integral de Ortodoncia Damon Estético",
      description: "Instalación de brackets estéticos autoligados Damon + controles mensuales.",
      status: "IN_PROGRESS",
      acceptedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  });

  const secSofia = await prisma.treatmentPlanSection.create({
    data: { treatmentPlanId: planSofia.id, name: "Fase Correctiva", sortOrder: 1 }
  });

  const itemBrakets = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planSofia.id, sectionId: secSofia.id, procedureId: procBracketAutoligado.id, quantity: 1, unitPrice: 25000.00, total: 25000.00, status: "COMPLETED", completedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  });

  // Crear Presupuesto Ortodoncia
  const budgetSofia = await prisma.budget.create({
    data: {
      organizationId: organization.id,
      treatmentPlanId: planSofia.id,
      patientId: patientSofia.id,
      professionalId: profVega.id,
      subtotal: 25000.00,
      discountTotal: 0.00,
      total: 25000.00,
      status: "ACCEPTED",
      acceptedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.budgetItem.create({
    data: {
      budgetId: budgetSofia.id,
      treatmentPlanItemId: itemBrakets.id,
      description: "Tratamiento Completo de Brackets Estéticos Autoligados Damon (Incluye arcos iniciales)",
      quantity: 1,
      unitPrice: 25000.00,
      total: 25000.00
    }
  });

  // Plan de Financiamiento
  const instPlanSofia = await prisma.installmentPlan.create({
    data: {
      organizationId: organization.id,
      patientId: patientSofia.id,
      treatmentPlanId: planSofia.id,
      totalAmount: 25000.00,
      downPayment: 5000.00,
      financedAmount: 20000.00,
      numberOfInstallments: 12,
      frequency: "MONTHLY",
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      status: "ACTIVE"
    }
  });

  // Pagos Realizados
  // Pago de Enganche ($5,000)
  const paymentSofiaDown = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      receivedById: adminUser.id,
      amount: 5000.00,
      paymentMethodId: methodTarjeta.id,
      status: "ALLOCATED",
      reference: "TRANS-ENG-SOFIA",
      notes: "Cobro por enganche de brackets",
      paidAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  });
  await prisma.paymentAllocation.create({
    data: { paymentId: paymentSofiaDown.id, treatmentPlanItemId: itemBrakets.id, amount: 5000.00 }
  });

  // 12 Cuotas Mensuales de $1,666.67
  const instAmount = 1666.67;

  // Cuota 1: Venció hace 60 días. PAGADA.
  const paySofia1 = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      receivedById: adminUser.id,
      amount: instAmount,
      paymentMethodId: methodTarjeta.id,
      status: "ALLOCATED",
      reference: "T-ORTO-01",
      notes: "Mensualidad ortodoncia 1/12",
      paidAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    }
  });
  await prisma.installment.create({
    data: {
      installmentPlanId: instPlanSofia.id,
      patientId: patientSofia.id,
      number: 1,
      dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      amount: instAmount,
      paidAmount: instAmount,
      status: InstallmentStatus.PAID,
      paymentId: paySofia1.id,
      paidAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    }
  });

  // Cuota 2: Venció hace 30 días. PAGADA.
  const paySofia2 = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      receivedById: adminUser.id,
      amount: instAmount,
      paymentMethodId: methodTransfer.id,
      status: "ALLOCATED",
      reference: "SPEI-SOFIA-2",
      notes: "Mensualidad ortodoncia 2/12",
      paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  });
  await prisma.installment.create({
    data: {
      installmentPlanId: instPlanSofia.id,
      patientId: patientSofia.id,
      number: 2,
      dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      amount: instAmount,
      paidAmount: instAmount,
      status: InstallmentStatus.PAID,
      paymentId: paySofia2.id,
      paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  });

  // Cuotas Restantes (3 a 12 en Pendiente)
  for (let i = 3; i <= 12; i++) {
    await prisma.installment.create({
      data: {
        installmentPlanId: instPlanSofia.id,
        patientId: patientSofia.id,
        number: i,
        dueDate: new Date(Date.now() + (i - 3) * 30 * 24 * 60 * 60 * 1000),
        amount: instAmount,
        paidAmount: 0.00,
        status: InstallmentStatus.PENDING
      }
    });
  }

  // Citas de Ortodoncia de Sofía (Historial + Próxima)
  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      professionalId: profVega.id,
      chairId: chairVerde.id,
      specialtyId: specOrtodoncia.id,
      title: "Colocación Brackets Damon - Sofia",
      reason: "Colocación de aparatología completa en ambas arcadas",
      status: AppointmentStatus.COMPLETED,
      startAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      durationMinutes: 90,
      createdById: adminUser.id
    }
  });

  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      professionalId: profVega.id,
      chairId: chairVerde.id,
      specialtyId: specOrtodoncia.id,
      title: "1er Control Mensual Ortodoncia",
      reason: "Cambio de arcos iniciales a 0.014 NiTi",
      status: AppointmentStatus.COMPLETED,
      startAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      durationMinutes: 30,
      createdById: adminUser.id
    }
  });

  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      professionalId: profVega.id,
      chairId: chairVerde.id,
      specialtyId: specOrtodoncia.id,
      title: "2do Control Mensual Ortodoncia",
      reason: "Ajuste de torque posterior y ligaduras elásticas",
      status: AppointmentStatus.COMPLETED,
      startAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      durationMinutes: 30,
      createdById: adminUser.id
    }
  });

  // Próxima cita programada
  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientSofia.id,
      professionalId: profVega.id,
      chairId: chairVerde.id,
      specialtyId: specOrtodoncia.id,
      title: "3er Control Mensual Ortodoncia",
      reason: "Seguimiento de alineación y nivelación activa",
      status: AppointmentStatus.SCHEDULED,
      startAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      durationMinutes: 30,
      createdById: adminUser.id
    }
  });

  // Evolución SOAP Ortodoncia
  await prisma.clinicalEvolution.create({
    data: {
      patientId: patientSofia.id,
      professionalId: profVega.id,
      subjective: "Paciente refiere molestias leves los primeros 3 días posteriores al cambio de arcos, actualmente asintomática.",
      objective: "Brackets completos sin desprendimientos. Apiñamiento en arcada inferior disminuyendo satisfactoriamente.",
      assessment: "Evolución favorable conforme al plan de alineación.",
      plan: "Retiro de arcos 0.014 NiTi e instalación de arco superior e inferior de acero 0.016. Colocación de cadena elastomérica de canino a canino inferior.",
      signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      signedById: adminUser.id,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  });

  // ==========================================
  // PACIENTE 3: Carlos Montes
  // Módulo: Endodoncia de Urgencia - Pago Inmediato en Efectivo
  // ==========================================
  console.log("Sembrando Paciente 3: Carlos Montes (Endodoncia)...");
  const birthDateCarlos = new Date();
  birthDateCarlos.setFullYear(birthDateCarlos.getFullYear() - 38);

  const patientCarlos = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      firstName: "Carlos",
      lastName: "Montes",
      birthDate: birthDateCarlos,
      gender: "MALE",
      documentType: "INE",
      documentNumber: "CARL8029381729",
      email: "carlos.montes@dentalwarner.local",
      phone: "+525588990011",
      occupation: "Contador Público",
      referredBy: "Urgencias Clínicas",
      source: "Google Maps",
      status: "COMPLETED"
    }
  });

  await prisma.medicalHistory.create({
    data: { patientId: patientCarlos.id, bloodType: "O-", notes: "Clínicamente sano. Reporta dolor insoportable espontáneo." }
  });

  // Registro en Odontograma de Endodoncia en Pieza 46
  const recEndo = await prisma.odontogramRecord.create({
    data: { patientId: patientCarlos.id, professionalId: profRuiz.id, toothNumber: "46", surface: "ALL", condition: "Tratamiento de Conducto Realizado", status: ToothProcedureStatus.COMPLETED }
  });
  await prisma.toothCondition.create({
    data: { patientId: patientCarlos.id, odontogramRecordId: recEndo.id, toothNumber: "46", surface: "ALL", condition: "Tratado Endodónticamente" }
  });

  // Plan e items Carlos
  const planCarlos = await prisma.treatmentPlan.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientCarlos.id,
      professionalId: profRuiz.id,
      name: "Tratamiento de Urgencia Endodontica - Pieza 46",
      description: "Endodoncia en primer molar inferior derecho + reconstrucción coronaria.",
      status: "COMPLETED",
      acceptedAt: new Date(),
      completedAt: new Date()
    }
  });

  const secCarlos = await prisma.treatmentPlanSection.create({
    data: { treatmentPlanId: planCarlos.id, name: "Urgencia y Reconstrucción", sortOrder: 1 }
  });

  const itemEndo = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planCarlos.id, sectionId: secCarlos.id, procedureId: procEndodonciaMolar.id, toothNumber: "46", quantity: 1, unitPrice: 4500.00, total: 4500.00, status: "COMPLETED", completedAt: new Date() }
  });

  const itemRecon = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planCarlos.id, sectionId: secCarlos.id, procedureId: procReconstruccionPostEndo.id, toothNumber: "46", quantity: 1, unitPrice: 1800.00, total: 1800.00, status: "COMPLETED", completedAt: new Date() }
  });

  // Presupuesto Carlos
  const budgetCarlos = await prisma.budget.create({
    data: {
      organizationId: organization.id,
      treatmentPlanId: planCarlos.id,
      patientId: patientCarlos.id,
      professionalId: profRuiz.id,
      subtotal: 6300.00,
      discountTotal: 0.00,
      total: 6300.00,
      status: "ACCEPTED",
      acceptedAt: new Date()
    }
  });

  await prisma.budgetItem.createMany({
    data: [
      { budgetId: budgetCarlos.id, treatmentPlanItemId: itemEndo.id, description: "Tratamiento de Conductos Molar (Endodoncia) Pieza 46", quantity: 1, unitPrice: 4500, total: 4500 },
      { budgetId: budgetCarlos.id, treatmentPlanItemId: itemRecon.id, description: "Reconstrucción con Poste de Fibra y Resina Pieza 46", quantity: 1, unitPrice: 1800, total: 1800 }
    ]
  });

  // Registrar Cita de Urgencia Hoy
  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientCarlos.id,
      professionalId: profRuiz.id,
      chairId: chairNaranja.id,
      specialtyId: specEndodoncia.id,
      title: "Endodoncia Monocita Urgente - Carlos Montes",
      reason: "Dolor dental agudo espontáneo irreversible",
      status: AppointmentStatus.COMPLETED,
      startAt: demoDateAt(10, 0),
      endAt: demoDateAt(11, 0),
      durationMinutes: 60,
      createdById: adminUser.id
    }
  });

  // SOAP Endodoncia
  await prisma.clinicalEvolution.create({
    data: {
      patientId: patientCarlos.id,
      professionalId: profRuiz.id,
      subjective: "Paciente refiere dolor severo en cuadrante inferior derecho, no cede con analgésicos convencionales, agrava con calor.",
      objective: "Pieza 46 con cavidad cariosa profunda. Pruebas de percusión vertical positivas. Vitalidad al frío sumamente aumentada y retardada.",
      assessment: "Pulpitis Irreversible Aguda en Pieza 46.",
      plan: "Se realiza extirpación de pulpa cameral y radicular de conductos mesiales y distal. Limpieza biomecánica con limas rotatorias de NiTi e irrigación profunda con Hipoclorito al 5.25%. Obturación hermética con gutapercha termoplástica y cemento Biocerámico. Reconstrucción con poste de fibra de vidrio y resina fotocurable.",
      signedAt: new Date(),
      signedById: adminUser.id,
      createdAt: new Date()
    }
  });

  // Receta Médica post-operatoria Carlos
  await prisma.prescription.create({
    data: {
      patientId: patientCarlos.id,
      professionalId: profRuiz.id,
      diagnosis: "Post-endodoncia molar 46 por pulpitis aguda",
      notes: "En caso de inflamación o dolor que no ceda al medicamento, llamar a urgencias.",
      items: {
        create: [
          { medication: "Ketorolaco Trometamina 10mg", dosage: "1 tableta", frequency: "Cada 8 horas", duration: "3 días", instructions: "Tomar vía sublingual en caso de presentar dolor severo." },
          { medication: "Amoxicilina 500mg (Tabletas)", dosage: "1 tableta", frequency: "Cada 8 horas", duration: "7 días", instructions: "Tomar completo para control preventivo de infección." }
        ]
      }
    }
  });

  // ==========================================
  // PACIENTE 4: Mateo Díaz
  // Módulo: Odontopediatría Preventiva - Convenio Escolar Colegio Tepeyac (15%)
  // ==========================================
  console.log("Sembrando Paciente 4: Mateo Díaz (Odontopediatría)...");
  const birthDateMateo = new Date();
  birthDateMateo.setFullYear(birthDateMateo.getFullYear() - 8); // 8 años

  const patientMateo = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      agreementId: agreeTepeyac.id, // Aplicación del descuento del 15% escolar
      firstName: "Mateo",
      lastName: "Díaz",
      birthDate: birthDateMateo,
      gender: "MALE",
      email: "padre.mateo@dentalwarner.local", // Correo del padre
      phone: "+525577665544",
      occupation: "Estudiante Primaria",
      referredBy: "Convenio del Colegio Tepeyac",
      source: "Convenio Institucional",
      status: "ACTIVE"
    }
  });

  // Odontograma selladores preventivos
  const pedTeeth = ["74", "75", "84", "85"];
  for (const tooth of pedTeeth) {
    const recPed = await prisma.odontogramRecord.create({
      data: { patientId: patientMateo.id, professionalId: profGomez.id, toothNumber: tooth, surface: "O", condition: "Sellador Preventivo Aplicado", status: ToothProcedureStatus.COMPLETED }
    });
    await prisma.toothCondition.create({
      data: { patientId: patientMateo.id, odontogramRecordId: recPed.id, toothNumber: tooth, surface: "O", condition: "Sellador" }
    });
  }

  // Plan e items Mateo
  const planMateo = await prisma.treatmentPlan.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientMateo.id,
      professionalId: profGomez.id,
      name: "Plan de Prevención Bucal Infantil - Mateo Díaz",
      description: "Profilaxis integral infantil y aplicación de selladores en molares primarios.",
      status: "COMPLETED",
      acceptedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  const secMateo = await prisma.treatmentPlanSection.create({
    data: { treatmentPlanId: planMateo.id, name: "Fase Preventiva", sortOrder: 1 }
  });

  // Precios: Profilaxis infantil ($600) + 4 * Selladores ($450 c/u) = $2,400.
  // Con 15% Descuento = $2,400 - $360 = $2,040 total.
  const tpPedProf = await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: planMateo.id,
      sectionId: secMateo.id,
      procedureId: procProfilaxisInfantil.id,
      quantity: 1,
      unitPrice: 600.00,
      discount: 90.00, // 15% de $600
      total: 510.00,
      status: "COMPLETED",
      agreementId: agreeTepeyac.id,
      agreementCoverage: 90.00,
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  const tpSelladores: any[] = [];
  for (const tooth of pedTeeth) {
    const itemS = await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: planMateo.id,
        sectionId: secMateo.id,
        procedureId: procSelladores.id,
        toothNumber: tooth,
        quantity: 1,
        unitPrice: 450.00,
        discount: 67.50, // 15% de $450
        total: 382.50,
        status: "COMPLETED",
        agreementId: agreeTepeyac.id,
        agreementCoverage: 67.50,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    });
    tpSelladores.push(itemS);
  }

  // Presupuesto Mateo
  const budgetMateo = await prisma.budget.create({
    data: {
      organizationId: organization.id,
      treatmentPlanId: planMateo.id,
      patientId: patientMateo.id,
      professionalId: profGomez.id,
      subtotal: 2400.00,
      discountTotal: 360.00,
      total: 2040.00,
      status: "ACCEPTED",
      acceptedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.budgetItem.create({
    data: {
      budgetId: budgetMateo.id,
      treatmentPlanItemId: tpPedProf.id,
      description: "Profilaxis Infantil y Fluoración de Alta Densidad",
      quantity: 1,
      unitPrice: 600.00,
      discount: 90.00,
      total: 510.00
    }
  });

  for (let idx = 0; idx < pedTeeth.length; idx++) {
    await prisma.budgetItem.create({
      data: {
        budgetId: budgetMateo.id,
        treatmentPlanItemId: tpSelladores[idx].id,
        description: `Sellador de fosetas y fisuras preventivo en pieza ${pedTeeth[idx]}`,
        quantity: 1,
        unitPrice: 450.00,
        discount: 67.50,
        total: 382.50
      }
    });
  }

  // Registrar Cita de Mateo hace 3 días
  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientMateo.id,
      professionalId: profGomez.id,
      chairId: chairVerde.id,
      specialtyId: specPediatria.id,
      title: "Control Dental Infantil y Selladores - Mateo Díaz",
      reason: "Higiene general infantil y protección oclusal",
      status: AppointmentStatus.COMPLETED,
      startAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
      endAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      createdById: adminUser.id
    }
  });

  // SOAP Infantil
  await prisma.clinicalEvolution.create({
    data: {
      patientId: patientMateo.id,
      professionalId: profGomez.id,
      subjective: "Madre del paciente refiere que Mateo asiste para revisión de rutina. Comenta que en la escuela hay campaña de prevención.",
      objective: "Paciente cooperador. Dentición mixta temprana sana. Ausencia de caries clínicamente activa.",
      assessment: "Paciente infantil en óptimas condiciones de salud oclusal. Riesgo cariogénico bajo-medio.",
      plan: "Se realiza profilaxis dental ultrasónica con pasta abrasiva sabor cereza, seguida de aplicación de flúor en barniz al 5%. Posteriormente se realiza grabado ácido y colocación de selladores de fosetas y fisuras fotocurables en oclusal de molares temporales 74, 75, 84 y 85. Se instruye en técnica de cepillado.",
      signedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      signedById: adminUser.id,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  // Pago de Mateo
  const paymentMateo = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientMateo.id,
      receivedById: adminUser.id,
      amount: 2040.00,
      paymentMethodId: methodTarjeta.id,
      status: "ALLOCATED",
      reference: "TRANS-PEDIATRIA-MATEO",
      notes: "Cobro total de tratamiento preventivo con descuento de convenio aplicado",
      paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.paymentAllocation.create({
    data: { paymentId: paymentMateo.id, treatmentPlanItemId: tpPedProf.id, amount: 510.00 }
  });
  for (const itemS of tpSelladores) {
    await prisma.paymentAllocation.create({
      data: { paymentId: paymentMateo.id, treatmentPlanItemId: itemS.id, amount: 382.50 }
    });
  }

  // ==========================================
  // PACIENTE 5: Lucía Fernández
  // Módulo: Implantes de Titanio y Prótesis (Orden de Laboratorio Premium)
  // ==========================================
  console.log("Sembrando Paciente 5: Lucía Fernández (Implantes y Laboratorio)...");
  const birthDateLucia = new Date();
  birthDateLucia.setFullYear(birthDateLucia.getFullYear() - 52);

  const patientLucia = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      firstName: "Lucía",
      lastName: "Fernández",
      birthDate: birthDateLucia,
      gender: "FEMALE",
      documentType: "INE",
      documentNumber: "LUCI5492837492",
      email: "lucia.fernandez@dentalwarner.local",
      phone: "+525566554433",
      occupation: "Empresaria",
      referredBy: "Recomendación médica",
      source: "Recomendado Directo",
      status: "IN_TREATMENT"
    }
  });

  await prisma.medicalHistory.create({
    data: { patientId: patientLucia.id, bloodType: "O+", notes: "Osteoporosis leve en tratamiento médico con Calcio. Clínicamente apta para cirugía." }
  });

  // Odontograma Clínico Lucía
  const recImp24 = await prisma.odontogramRecord.create({
    data: { patientId: patientLucia.id, professionalId: profRuiz.id, toothNumber: "24", surface: "ALL", condition: "Implante de Titanio Oseo integrado", status: ToothProcedureStatus.COMPLETED }
  });
  await prisma.toothCondition.create({
    data: { patientId: patientLucia.id, odontogramRecordId: recImp24.id, toothNumber: "24", surface: "ALL", condition: "Implante" }
  });

  const recImp25 = await prisma.odontogramRecord.create({
    data: { patientId: patientLucia.id, professionalId: profRuiz.id, toothNumber: "25", surface: "ALL", condition: "Implante de Titanio Oseo integrado", status: ToothProcedureStatus.COMPLETED }
  });
  await prisma.toothCondition.create({
    data: { patientId: patientLucia.id, odontogramRecordId: recImp25.id, toothNumber: "25", surface: "ALL", condition: "Implante" }
  });

  // Plan e items Lucía
  // Total: Implantes ($18,000 c/u) + Coronas ($6,500 c/u) = $49,000.
  const planLucia = await prisma.treatmentPlan.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientLucia.id,
      professionalId: profRuiz.id,
      name: "Rehabilitación de Premolares con Implantes Dentales - Lucía F.",
      description: "Cirugía de implantes en brecha 24 y 25 y posterior carga protésica estético funcional.",
      status: "IN_PROGRESS",
      acceptedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
    }
  });

  const secLucia = await prisma.treatmentPlanSection.create({
    data: { treatmentPlanId: planLucia.id, name: "Fase Quirúrgica y Protésica", sortOrder: 1 }
  });

  const itemImp24 = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planLucia.id, sectionId: secLucia.id, procedureId: procImplanteTitanio.id, toothNumber: "24", quantity: 1, unitPrice: 18000.00, total: 18000.00, status: "COMPLETED", completedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  });

  const itemImp25 = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planLucia.id, sectionId: secLucia.id, procedureId: procImplanteTitanio.id, toothNumber: "25", quantity: 1, unitPrice: 18000.00, total: 18000.00, status: "COMPLETED", completedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  });

  const itemCor24 = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planLucia.id, sectionId: secLucia.id, procedureId: procCoronaZirconio.id, toothNumber: "24", quantity: 1, unitPrice: 6500.00, total: 6500.00, status: "ACCEPTED" }
  });

  const itemCor25 = await prisma.treatmentPlanItem.create({
    data: { treatmentPlanId: planLucia.id, sectionId: secLucia.id, procedureId: procCoronaZirconio.id, toothNumber: "25", quantity: 1, unitPrice: 6500.00, total: 6500.00, status: "ACCEPTED" }
  });

  // Presupuesto Lucía
  const budgetLucia = await prisma.budget.create({
    data: {
      organizationId: organization.id,
      treatmentPlanId: planLucia.id,
      patientId: patientLucia.id,
      professionalId: profRuiz.id,
      subtotal: 49000.00,
      discountTotal: 0.00,
      total: 49000.00,
      status: "ACCEPTED",
      acceptedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.budgetItem.createMany({
    data: [
      { budgetId: budgetLucia.id, treatmentPlanItemId: itemImp24.id, description: "Implante dental Straumann pieza 24", quantity: 1, unitPrice: 18000, total: 18000 },
      { budgetId: budgetLucia.id, treatmentPlanItemId: itemImp25.id, description: "Implante dental Straumann pieza 25", quantity: 1, unitPrice: 18000, total: 18000 },
      { budgetId: budgetLucia.id, treatmentPlanItemId: itemCor24.id, description: "Corona Zirconio monolítico sobre implante pieza 24", quantity: 1, unitPrice: 6500, total: 6500 },
      { budgetId: budgetLucia.id, treatmentPlanItemId: itemCor25.id, description: "Corona Zirconio monolítico sobre implante pieza 25", quantity: 1, unitPrice: 6500, total: 6500 }
    ]
  });

  // Pago inicial para Implantes ($36,000 transferidos)
  const paymentLucia = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientLucia.id,
      receivedById: adminUser.id,
      amount: 36000.00,
      paymentMethodId: methodTransfer.id,
      status: "ALLOCATED",
      reference: "TRANS-QUIRURGICO-LUCIA",
      notes: "Cobro total de la fase quirúrgica implantes 24 y 25",
      paidAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.paymentAllocation.create({
    data: { paymentId: paymentLucia.id, treatmentPlanItemId: itemImp24.id, amount: 18000.00 }
  });
  await prisma.paymentAllocation.create({
    data: { paymentId: paymentLucia.id, treatmentPlanItemId: itemImp25.id, amount: 18000.00 }
  });

  // Citas de Cirugía
  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientLucia.id,
      professionalId: profRuiz.id,
      chairId: chairNaranja.id,
      specialtyId: specImplantologia.id,
      title: "Cirugía Colocación Implantes Straumann",
      reason: "Colocación de dos cuerpos de implantes de titanio en 24 y 25",
      status: AppointmentStatus.COMPLETED,
      startAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      durationMinutes: 60,
      createdById: adminUser.id
    }
  });

  // Próxima Cita Mañana para cementar coronas
  await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientLucia.id,
      professionalId: profMendoza.id,
      chairId: chairAzul.id,
      specialtyId: specImplantologia.id,
      title: "Cementación y Carga Protésica de Zirconio - Lucía",
      reason: "Cementado final de coronas de zirconio sobre implantes",
      status: AppointmentStatus.SCHEDULED,
      startAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // Mañana a las 11am
      endAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      durationMinutes: 60,
      createdById: adminUser.id
    }
  });

  // SOAP de Cirugía
  await prisma.clinicalEvolution.create({
    data: {
      patientId: patientLucia.id,
      professionalId: profRuiz.id,
      subjective: "Paciente asiste para fase quirúrgica activa. Refiere estar lista, habiendo tomado el antibiótico profiláctico.",
      objective: "Brecha desdentada en 24 y 25. Hueso remanente de excelente densidad.",
      assessment: "Cirugía de implantes planificada.",
      plan: "Se realiza colgajo de espesor total, fresado secuencial y colocación exitosa de 2 implantes Straumann de 4.1 x 10mm en piezas 24 y 25. Torques de inserción primaria superiores a 35 Ncm. Sutura con hilo seda 4-0.",
      signedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      signedById: adminUser.id,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  });

  // Configurar Proveedor de Laboratorio y Órdenes
  console.log("Configurando proveedores de laboratorio...");
  const labProvider = await prisma.labProvider.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Laboratorio Premium Dental" } },
    update: { isActive: true },
    create: {
      organizationId: organization.id,
      name: "Laboratorio Premium Dental",
      phone: "+525588334411",
      email: "contacto@premiumdental.local",
      address: "Av. de los Insurgentes Sur 432, CDMX",
      isActive: true
    }
  });

  // Orden de Laboratorio para Lucía Fernández
  const labOrder = await prisma.labOrder.create({
    data: {
      organizationId: organization.id,
      patientId: patientLucia.id,
      treatmentPlanId: planLucia.id,
      professionalId: profMendoza.id,
      labProviderId: labProvider.id,
      status: LabOrderStatus.RECEIVED,
      sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      expectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      receivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      cost: 4400.00,
      notes: "El zirconio requiere un acabado glaseado de alta translucidez A2"
    }
  });

  await prisma.labOrderItem.createMany({
    data: [
      { labOrderId: labOrder.id, description: "Corona de Zirconio Monolítico sobre implante", quantity: 1, unitCost: 2200, toothNumber: "24" },
      { labOrderId: labOrder.id, description: "Corona de Zirconio Monolítico sobre implante", quantity: 1, unitCost: 2200, toothNumber: "25" }
    ]
  });

  // ==========================================
  // MÓDULO DE INVENTARIO Y PROVEEDORES DE INSUMOS
  // ==========================================
  console.log("Configurando módulos de inventarios e insumos...");
  const suppDepot = await prisma.supplier.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Dental Depot de México" } },
    update: { isActive: true },
    create: { organizationId: organization.id, name: "Dental Depot de México", phone: "+525544992211", email: "ventas@dentaldepot.local", isActive: true }
  });

  const suppOrto = await prisma.supplier.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Orthodontic Supply Co." } },
    update: { isActive: true },
    create: { organizationId: organization.id, name: "Orthodontic Supply Co.", phone: "+525599008811", email: "pedidos@orthosupply.local", isActive: true }
  });

  // Artículos de Inventario en Sucursal Matriz
  const itemResina = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      name: "Resina Filtek Supreme 3M A2 (Jeringa 4g)",
      sku: "INV-RES-3M",
      category: "Materiales Dentales",
      unit: "Jeringa",
      stock: 15.00,
      minStock: 5.00,
      branchId: branch.id,
      supplierId: suppDepot.id,
      isActive: true
    }
  });

  const itemBrackets = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      name: "Kit Brackets Autoligados Damon Estéticos (Caso Completo)",
      sku: "INV-BRACK-AL",
      category: "Ortodoncia",
      unit: "Kit",
      stock: 3.00, // Stock bajo, activará alerta de inventario en dashboard
      minStock: 5.00,
      branchId: branch.id,
      supplierId: suppOrto.id,
      isActive: true
    }
  });

  const itemAnestesico = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      name: "Anestésico Mepivacaína 2% con Epinefrina (Caja 50 Cartuchos)",
      sku: "INV-ANES-MEP",
      category: "Farmacia y Anestésicos",
      unit: "Caja",
      stock: 45.00,
      minStock: 10.00,
      branchId: branch.id,
      supplierId: suppDepot.id,
      isActive: true
    }
  });

  // Movimientos de inventario iniciales (Entradas)
  await prisma.inventoryMovement.createMany({
    data: [
      { inventoryItemId: itemResina.id, branchId: branch.id, type: InventoryMovementType.IN, quantity: 20.00, reason: "Carga inicial de stock", createdById: adminUser.id },
      { inventoryItemId: itemResina.id, branchId: branch.id, type: InventoryMovementType.OUT, quantity: 5.00, reason: "Consumo diario en operatoria general", createdById: adminUser.id },
      { inventoryItemId: itemBrackets.id, branchId: branch.id, type: InventoryMovementType.IN, quantity: 4.00, reason: "Entrada por compra", createdById: adminUser.id },
      { inventoryItemId: itemBrackets.id, branchId: branch.id, type: InventoryMovementType.OUT, quantity: 1.00, reason: "Colocación en caso de Sofia Castro", createdById: adminUser.id },
      { inventoryItemId: itemAnestesico.id, branchId: branch.id, type: InventoryMovementType.IN, quantity: 50.00, reason: "Compra global de insumos", createdById: adminUser.id },
      { inventoryItemId: itemAnestesico.id, branchId: branch.id, type: InventoryMovementType.OUT, quantity: 5.00, reason: "Uso en cirugías de implantes y endodoncia", createdById: adminUser.id }
    ]
  });

  // ==========================================
  // MÓDULO DE CAJA DIARIA (CASH REGISTER Y MOVIMIENTOS)
  // ==========================================
  console.log("Configurando flujos de Caja y contabilidad...");

  // Caja 1: Abierta ayer, cerrada ayer con balance positivo
  const cashRegYesterday = await prisma.cashRegister.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      openedById: adminUser.id,
      closedById: adminUser.id,
      openingAmount: 2000.00,
      closingAmount: 7000.00,
      status: CashRegisterStatus.CLOSED,
      openedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000), // Ayer mañana
      closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000) // Ayer tarde
    }
  });

  // Movimientos de ayer
  await prisma.cashMovement.createMany({
    data: [
      { cashRegisterId: cashRegYesterday.id, type: CashMovementType.OPENING, amount: 2000.00, description: "Apertura de caja de ayer con saldo mínimo", createdById: adminUser.id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000) },
      // Cobro en efectivo ingresado
      { cashRegisterId: cashRegYesterday.id, type: CashMovementType.INCOME, amount: 6500.00, description: "Ingreso por pago de prótesis dental en efectivo", createdById: adminUser.id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000) },
      // Gasto de insumos registrado en efectivo de la caja
      { cashRegisterId: cashRegYesterday.id, type: CashMovementType.EXPENSE, amount: 1500.00, description: "Compra urgente de fresas diamantadas a Dental Depot", createdById: adminUser.id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000) },
      { cashRegisterId: cashRegYesterday.id, type: CashMovementType.CLOSING, amount: 7000.00, description: "Cierre diario de caja cuadradro sin faltantes", createdById: adminUser.id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000) }
    ]
  });

  // Caja 2: Caja de Hoy abierta
  const cashRegToday = await prisma.cashRegister.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      openedById: adminUser.id,
      openingAmount: 7000.00, // Arrastre del saldo de cierre de ayer
      status: CashRegisterStatus.OPEN,
      openedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // Abierta hace 2 horas
    }
  });

  await prisma.cashMovement.create({
    data: { cashRegisterId: cashRegToday.id, type: CashMovementType.OPENING, amount: 7000.00, description: "Apertura de caja diaria", createdById: adminUser.id, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
  });

  // Carlos Montes acaba de pagar la Endodoncia en efectivo hoy
  const paymentCarlosCash = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      patientId: patientCarlos.id,
      receivedById: adminUser.id,
      amount: 6300.00,
      paymentMethodId: methodEfectivo.id,
      status: "ALLOCATED",
      reference: "PAGO-ENDO-EFECTIVO",
      notes: "Cobro total de tratamiento de urgencia de conductos en 46",
      paidAt: new Date()
    }
  });

  await prisma.paymentAllocation.create({
    data: { paymentId: paymentCarlosCash.id, treatmentPlanItemId: itemEndo.id, amount: 4500.00 }
  });
  await prisma.paymentAllocation.create({
    data: { paymentId: paymentCarlosCash.id, treatmentPlanItemId: itemRecon.id, amount: 1800.00 }
  });

  // Registrar el flujo de caja del cobro en la caja abierta de hoy
  await prisma.cashMovement.create({
    data: {
      cashRegisterId: cashRegToday.id,
      type: CashMovementType.INCOME,
      amount: 6300.00,
      paymentId: paymentCarlosCash.id,
      description: "Cobro en efectivo de Endodoncia - Carlos Montes",
      createdById: adminUser.id
    }
  });

  console.log("Sembrando agenda de hoy con flujo completo de estados...");
  await prisma.appointment.createMany({
    data: [
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientJuan.id,
        professionalId: profMendoza.id,
        chairId: chairAzul.id,
        specialtyId: specGeneral.id,
        title: "[DEMO] Valoracion general - Juan",
        reason: "Revision inicial y diagnostico",
        status: AppointmentStatus.SCHEDULED,
        ...demoDateRange(8, 30, 30),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientSofia.id,
        professionalId: profVega.id,
        chairId: chairVerde.id,
        specialtyId: specOrtodoncia.id,
        title: "[DEMO] Control ortodoncia - Sofia",
        reason: "Cambio de ligas y control mensual",
        status: AppointmentStatus.CONFIRMED,
        ...demoDateRange(9, 0, 30),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientMateo.id,
        professionalId: profGomez.id,
        chairId: chairAzul.id,
        specialtyId: specPediatria.id,
        title: "[DEMO] Selladores preventivos - Mateo",
        reason: "Confirmacion pendiente por tutor",
        status: AppointmentStatus.PENDING_CONFIRMATION,
        ...demoDateRange(9, 30, 30),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientJuan.id,
        professionalId: profMendoza.id,
        chairId: chairAzul.id,
        specialtyId: specGeneral.id,
        title: "[DEMO] Profilaxis y resina - Juan",
        reason: "Paciente en sala de espera",
        status: AppointmentStatus.WAITING_ROOM,
        ...demoDateRange(11, 30, 45),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientSofia.id,
        professionalId: profVega.id,
        chairId: chairVerde.id,
        specialtyId: specOrtodoncia.id,
        title: "[DEMO] Llegada control ortodoncia",
        reason: "Paciente llego a clinica",
        status: AppointmentStatus.ARRIVED,
        ...demoDateRange(12, 30, 30),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientMateo.id,
        professionalId: profGomez.id,
        chairId: chairAzul.id,
        specialtyId: specPediatria.id,
        title: "[DEMO] Atencion pediatrica activa",
        reason: "Tratamiento en curso",
        status: AppointmentStatus.IN_PROGRESS,
        ...demoDateRange(13, 0, 45),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientLucia.id,
        professionalId: profRuiz.id,
        chairId: chairNaranja.id,
        specialtyId: specImplantologia.id,
        title: "[DEMO] Control implantes - no asistio",
        reason: "Paciente no asistio",
        status: AppointmentStatus.NO_SHOW,
        ...demoDateRange(15, 0, 45),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientLucia.id,
        professionalId: profMendoza.id,
        chairId: chairAzul.id,
        specialtyId: specGeneral.id,
        title: "[DEMO] Cita cancelada por paciente",
        reason: "Reagendara por telefono",
        status: AppointmentStatus.CANCELLED_BY_PATIENT,
        cancellationReason: "Paciente solicito cancelar",
        ...demoDateRange(16, 0, 30),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: null,
        professionalId: profVega.id,
        chairId: chairVerde.id,
        specialtyId: specOrtodoncia.id,
        title: "[DEMO] Bloqueo capacitacion interna",
        reason: "Bloqueo de agenda",
        status: AppointmentStatus.BLOCKED,
        ...demoDateRange(17, 0, 60),
        createdById: adminUser.id
      },
      {
        organizationId: organization.id,
        branchId: branch.id,
        patientId: patientLucia.id,
        professionalId: profRuiz.id,
        chairId: chairNaranja.id,
        specialtyId: specImplantologia.id,
        title: "[DEMO] Cita reagendada implantes",
        reason: "Paciente pidio mover el horario",
        status: AppointmentStatus.RESCHEDULED,
        ...demoDateRange(18, 0, 45),
        createdById: adminUser.id
      }
    ]
  });

  console.log("-----------------------------------------------------------------");
  console.log("¡ÉXITO! Seed premium multiespecialidad completado exitosamente.");
  console.log("5 Pacientes insertados/limpiados:");
  console.log("  1. Juan Demostración: General y Mora activa ($2,000 MXN vencidos).");
  console.log("  2. Sofía Castro: Ortodoncia Estética Damon ($25,000 MXN, Plan de cuotas activo).");
  console.log("  3. Carlos Montes: Endodoncia de Urgencia en 46 ($6,300 MXN, Pagado hoy en efectivo).");
  console.log("  4. Mateo Díaz: Preventivo infantil ($2,040 MXN, Convenio escolar 15% aplicado).");
  console.log("  5. Lucía Fernández: Implantes quirúrgicos en 24 y 25 ($49,000 MXN, Laboratorio recibido).");
  console.log("Inventarios cargados (3 artículos), Caja diaria activa y cuadradada.");
  console.log("-----------------------------------------------------------------");
}

main()
  .catch((error) => {
    console.error("Error en la ejecución del seed premium:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
