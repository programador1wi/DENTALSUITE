import { randomInt } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Generates a unique 6-digit random patient number between 100000 and 999999.
 * Retries up to maxAttempts to prevent collision against existing records.
 */
export async function generateUniquePatientNumber(
  client: PrismaClient | Prisma.TransactionClient,
  maxAttempts = 25
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = randomInt(100000, 1000000);
    const existing = await client.patient.findUnique({
      where: { patientNumber: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
  }
  throw new ConflictException("No fue posible generar un número de paciente único.");
}
