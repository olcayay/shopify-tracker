import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  name: z.string().min(1, "Name is required").max(100),
  accountName: z.string().min(1, "Account name is required").max(100),
  company: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    emailDigestEnabled: z.boolean().optional(),
    timezone: z.string().max(100).optional(),
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((data) => !data.newPassword || data.currentPassword, {
    message: "Current password is required to set new password",
    path: ["currentPassword"],
  });
