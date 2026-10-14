// Server-only: outbound webhook delivery with HMAC-SHA256 signatures.
async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function dispatchEvent(event: string, data: unknown, onlyEndpointId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("webhook_endpoints").select("id,url,secret,events").eq("active", true);
  if (onlyEndpointId) q = q.eq("id", onlyEndpointId);
  const { data: endpoints } = await q;
  const results: { id: string; ok: boolean; status: number | null }[] = [];
  for (const ep of endpoints ?? []) {
    if (!onlyEndpointId && !ep.events.includes(event)) continue;
    const body = JSON.stringify({ id: crypto.randomUUID(), event, created_at: new Date().toISOString(), data });
    let status: number | null = null; let error: string | null = null;
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bnoy-Event": event, "X-Bnoy-Signature": `sha256=${await hmac(ep.secret, body)}` },
        body, signal: AbortSignal.timeout(8000),
      });
      status = res.status;
    } catch (e) { error = e instanceof Error ? e.message.slice(0, 200) : "Delivery failed"; }
    const ok = status !== null && status >= 200 && status < 300;
    await supabaseAdmin.from("webhook_deliveries").insert({ endpoint_id: ep.id, event, status_code: status, ok, error });
    await supabaseAdmin.from("webhook_endpoints").update({ last_status: status, last_delivery_at: new Date().toISOString() }).eq("id", ep.id);
    results.push({ id: ep.id, ok, status });
  }
  return results;
}
