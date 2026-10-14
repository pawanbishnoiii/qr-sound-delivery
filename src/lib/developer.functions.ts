import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Admin access required");
}
const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ name: z.string().trim().min(2).max(80) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sha256Hex } = await import("./webhooks.server");
    const key = `bnoy_live_${rand(24)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("api_keys").insert({ name: data.name, prefix: key.slice(0, 14), key_hash: await sha256Hex(key), created_by: context.userId });
    if (error) throw new Error("Could not create key");
    return { key };
  });

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    name: z.string().trim().min(2).max(80),
    url: z.string().url().startsWith("https://").max(500),
    events: z.array(z.enum(["shipment.created", "shipment.updated", "return.updated"])).min(1),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const secret = `whsec_${rand(24)}`;
    const { error } = await context.supabase.from("webhook_endpoints").insert({ ...data, secret, created_by: context.userId });
    if (error) throw new Error("Could not save webhook");
    return { secret };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { dispatchEvent } = await import("./webhooks.server");
    const r = await dispatchEvent("ping", { message: "Test event from Bnoy" }, data.id);
    return r[0] ?? { ok: false, status: null };
  });

/** Notify subscribers after an in-app status change (caller must be able to see the shipment). */
export const notifyShipmentChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from("shipments").select("id,tracking_code,status,updated_at").eq("id", data.id).maybeSingle();
    if (!s) return { sent: 0 };
    const { dispatchEvent } = await import("./webhooks.server");
    return { sent: (await dispatchEvent("shipment.updated", s)).length };
  });
