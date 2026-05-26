import { z } from "zod";

const emailLike = (message = "Correo invalido") =>
  z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);

export const loginSchema = z.object({
  email: emailLike(),
  password: z.string().min(8, "Minimo 8 caracteres")
});

export const registerOrganizationSchema = z.object({
  organizationName: z.string().min(2),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  organizationPhone: z.string().optional(),
  organizationEmail: emailLike().optional().or(z.literal("")),
  organizationAddress: z.string().optional(),
  branchName: z.string().min(2),
  branchPhone: z.string().optional(),
  branchEmail: emailLike().optional().or(z.literal("")),
  branchAddress: z.string().optional(),
  branchCity: z.string().optional(),
  branchState: z.string().optional(),
  branchCountry: z.string().optional(),
  branchTimezone: z.string().optional(),
  adminFirstName: z.string().min(2),
  adminLastName: z.string().min(2),
  adminEmail: emailLike(),
  adminPhone: z.string().optional(),
  adminPassword: z.string().min(8)
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterOrganizationSchema = z.infer<typeof registerOrganizationSchema>;
