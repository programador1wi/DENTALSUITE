import { z } from "zod";

const emailLike = (message = "Correo invalido") =>
  z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);

export const loginSchema = z.object({
  email: emailLike(),
  password: z.string().min(8, "Minimo 8 caracteres")
});

export type LoginSchema = z.infer<typeof loginSchema>;

