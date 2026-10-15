import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const phoneEmail = (phone: string) => `p${phone}@phone.bnoy.app`;

const schema = z.object({
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(72),
  otp: z.string().regex(/^[0-9]{4}$/),
});

/** Phone-only signup. DEMO: OTP is fixed (1234) until an SMS provider is connected. */
export const signUpWithPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    if (data.otp !== "1234") return { error: "Incorrect OTP" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: phoneEmail(data.phone),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: "+91" + data.phone, phone_verified_demo: true },
    });
    if (error) console.error("phone signup failed:", error.message);
    if (error) return { error: /already/i.test(error.message) ? "This number is already registered — sign in instead" : "Could not create account" };
    return { error: null };
  });
