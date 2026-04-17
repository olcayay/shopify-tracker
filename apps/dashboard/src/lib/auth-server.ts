import { cache } from "react";
import { cookies } from "next/headers";

export const isSystemAdminServer = cache(async (): Promise<boolean> => {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    return Boolean(payload.isSystemAdmin);
  } catch {
    return false;
  }
});
