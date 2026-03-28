import { z } from "zod";

export const acceptInvitationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
