import { z } from "zod";

export const LoginRequest = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must contain only digits"),
});

export const LoginResponse = z.object({
  ok: z.boolean(),
  name: z.string().optional(),
  error: z.string().optional(),
});