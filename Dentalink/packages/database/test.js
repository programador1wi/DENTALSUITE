const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.specialtyAppointmentReason.findMany().then(r => console.log(r)).finally(() => prisma.$disconnect());
