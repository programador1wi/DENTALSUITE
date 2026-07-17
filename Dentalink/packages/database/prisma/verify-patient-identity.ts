import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const [
    contactPoints,
    links,
    linkGroups,
    familyGroups,
    sessions,
    familySharedContactPoints,
    ambiguousContactPoints,
    openBookingIncidents,
    activeSelectedSessions,
    invalidLegacyValues
  ] = await Promise.all([
    prisma.contactPoint.count(),
    prisma.patientContactLink.count({ where: { validUntil: null } }),
    prisma.patientContactLink.groupBy({
      by: ["contactPointId"],
      where: { validUntil: null },
      _count: { _all: true }
    }),
    prisma.familyGroup.count({ where: { status: "ACTIVE" } }),
    prisma.bookingIdentitySession.count(),
    prisma.contactPoint.count({ where: { status: "FAMILY_SHARED" } }),
    prisma.contactPoint.count({ where: { status: "AMBIGUOUS" } }),
    prisma.bookingIdentityIncident.count({ where: { status: "OPEN" } }),
    prisma.bookingIdentitySession.count({
      where: {
        status: "SELECTED",
        selectedPatientId: { not: null },
        selectionExpiresAt: { gt: new Date() }
      }
    }),
    prisma.auditLog.count({ where: { action: "patient_contact_backfill_failed" } })
  ]);
  const shared = linkGroups.filter((group) => group._count._all > 1);
  console.log(
    JSON.stringify(
      {
        contactPoints,
        activePatientContactLinks: links,
        sharedContactPoints: shared.length,
        patientsUsingSharedContacts: shared.reduce((sum, group) => sum + group._count._all, 0),
        familyGroups,
        bookingIdentitySessions: sessions,
        familySharedContactPoints,
        ambiguousContactPoints,
        openBookingIncidents,
        activeSelectedSessions,
        invalidLegacyValues
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
