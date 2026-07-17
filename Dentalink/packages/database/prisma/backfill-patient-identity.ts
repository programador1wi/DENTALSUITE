import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function normalizePhone(value: string, country: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  const input = raw.startsWith("+") || digits.length > 10 ? `+${digits}` : raw;
  const parsed = parsePhoneNumberFromString(input, country.toUpperCase() as CountryCode);
  if (!parsed?.isValid()) return null;
  return {
    rawValue: raw,
    normalizedValue: parsed.number,
    countryCode: parsed.country ?? country.toUpperCase(),
    nationalNumber: parsed.nationalNumber,
    callingCode: `+${parsed.countryCallingCode}`,
    phoneType: parsed.getType()
  };
}

async function main() {
  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true }
  });
  let linked = 0;
  let invalid = 0;
  let ambiguous = 0;

  for (const organization of organizations) {
    const config = await prisma.patientIdentityConfig.upsert({
      where: { organizationId: organization.id },
      create: { organizationId: organization.id },
      update: {}
    });
    const patients = await prisma.patient.findMany({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        OR: [{ phone: { not: null } }, { alternatePhone: { not: null } }]
      },
      select: { id: true, phone: true, alternatePhone: true }
    });

    for (const patient of patients) {
      const values = [
        { field: "phone", value: patient.phone, isPrimary: true },
        { field: "alternatePhone", value: patient.alternatePhone, isPrimary: false }
      ];
      const seen = new Set<string>();
      for (const item of values) {
        if (!item.value) continue;
        const normalized = normalizePhone(item.value, config.defaultCountry);
        if (!normalized) {
          invalid += 1;
          await prisma.auditLog.create({
            data: {
              organizationId: organization.id,
              entity: "Patient",
              entityId: patient.id,
              action: "patient_contact_backfill_failed",
              after: { field: item.field, reason: "INVALID_PHONE" }
            }
          });
          continue;
        }
        if (seen.has(normalized.normalizedValue)) continue;
        seen.add(normalized.normalizedValue);
        const contactPoint = await prisma.contactPoint.upsert({
          where: {
            organizationId_type_normalizedValue: {
              organizationId: organization.id,
              type: "PHONE",
              normalizedValue: normalized.normalizedValue
            }
          },
          create: { organizationId: organization.id, type: "PHONE", status: "UNVERIFIED", ...normalized },
          update: { rawValue: normalized.rawValue, version: { increment: 1 } }
        });
        if (item.isPrimary) {
          await prisma.patientContactLink.updateMany({
            where: { patientId: patient.id, role: "PERSONAL", isPrimary: true },
            data: { isPrimary: false, version: { increment: 1 } }
          });
        }
        await prisma.patientContactLink.upsert({
          where: {
            patientId_contactPointId_role: {
              patientId: patient.id,
              contactPointId: contactPoint.id,
              role: "PERSONAL"
            }
          },
          create: {
            organizationId: organization.id,
            patientId: patient.id,
            contactPointId: contactPoint.id,
            role: "PERSONAL",
            isPrimary: item.isPrimary,
            consentStatus: "ACCEPTED"
          },
          update: { isPrimary: item.isPrimary, validUntil: null, version: { increment: 1 } }
        });
        linked += 1;
      }
    }

    const sharedContacts = await prisma.patientContactLink.groupBy({
      by: ["contactPointId"],
      where: {
        organizationId: organization.id,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
      },
      _count: { patientId: true },
      having: { patientId: { _count: { gt: 1 } } }
    });
    for (const sharedContact of sharedContacts) {
      const belongsToFamily = await prisma.familyGroupContact.findFirst({
        where: {
          organizationId: organization.id,
          contactPointId: sharedContact.contactPointId,
          familyGroup: { status: "ACTIVE" }
        },
        select: { id: true }
      });
      await prisma.contactPoint.update({
        where: { id: sharedContact.contactPointId },
        data: { status: belongsToFamily ? "FAMILY_SHARED" : "AMBIGUOUS" }
      });
      if (!belongsToFamily) ambiguous += 1;
    }

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        entity: "ContactPoint",
        action: "patient_contact_backfill_completed",
        after: { patients: patients.length, linked, invalid, ambiguous }
      }
    });
  }

  console.log(JSON.stringify({ organizations: organizations.length, linked, invalid, ambiguous }, null, 2));
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
