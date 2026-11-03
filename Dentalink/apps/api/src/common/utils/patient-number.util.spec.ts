import { generateUniquePatientNumber } from "./patient-number.util";
import { ConflictException } from "@nestjs/common";

describe("generateUniquePatientNumber", () => {
  it("generates a random 6-digit number between 100000 and 999999", async () => {
    const mockPrisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const num = await generateUniquePatientNumber(mockPrisma as any);

    expect(typeof num).toBe("number");
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
    expect(mockPrisma.patient.findUnique).toHaveBeenCalledWith({
      where: { patientNumber: num },
      select: { id: true }
    });
  });

  it("retries when a collision occurs and returns an available 6-digit number", async () => {
    const mockPrisma = {
      patient: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: "existing-1" })
          .mockResolvedValueOnce(null)
      }
    };

    const num = await generateUniquePatientNumber(mockPrisma as any);

    expect(typeof num).toBe("number");
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
    expect(mockPrisma.patient.findUnique).toHaveBeenCalledTimes(2);
  });

  it("throws ConflictException if max attempts are exceeded without finding a free number", async () => {
    const mockPrisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: "always-exists" })
      }
    };

    await expect(generateUniquePatientNumber(mockPrisma as any, 3)).rejects.toThrow(
      ConflictException
    );
    expect(mockPrisma.patient.findUnique).toHaveBeenCalledTimes(3);
  });
});
