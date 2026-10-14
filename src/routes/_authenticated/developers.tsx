import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, Send, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/lib/auth";
import { fmtDate } from "@/lib/status";
import { pageHead } from "@/lib/seo";
import { createApiKey, createWebhook, testWebhook } from "@/lib/developer.functions";

export const Route = createFileRoute("/_authenticated/developers")({
  head: () => pageHead("API & webhooks", "Create API keys for partners and subscribe to signed shipment events."),
  component: Developers,
});

const EVENTS = ["shipment.created", "shipment.updated", "return.updated"] as const;
const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

function Developers() {
  const { role } = useMe();
  const qc = useQueryClient();
  const mkKey = useServerFn(createApiKey);
  const mkHook = useServerFn(createWebhook);
  const ping = useServerFn(testWebhook);
  const [keyName, setKeyName] = useState("");
  const [hook, setHook] = useState({ name: "", url: "" });
  const [events, setEvents] = useState<string[]>([...EVENTS]);
  const [shown, setShown] = useState<{ label: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useQuery({ queryKey: ["api_keys"], enabled: role === "admin", queryFn: async () => (await supabase.from("api_keys").select("id,name,prefix,last_used_at,revoked_at,created_at").order("created_at", { ascending: false })).data ?? [] });
  const hooks = useQuery({ queryKey: ["webhooks"], enabled: role === "admin", queryFn: async () => (await supabase.from("webhook_endpoints").select("id,name,url,events,active,last_status,last_delivery_at").order("created_at", { ascending: false })).data ?? [] });
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (role && role !== "admin") return <AppShell title="API & webhooks"><p className="text-sm text-muted-foreground">Only admins can manage API access.</p></AppShell>;

  async function run(fn: () => Promise<void>): Promise<void> { setBusy(true); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); } }

  return (
    <AppShell title="API & webhooks">
      {shown && (
        <div role="status" className="mb-6 rounded-md border border-primary bg-accent p-4">
          <p className="text-sm font-semibold">{shown.label} — copy it now, it won't be shown again.</p>
          <div className="mt-2 flex gap-2"><code className="flex-1 break-all rounded bg-background p-2 text-xs">{shown.value}</code><Button size="sm" variant="outline" onClick={() => copy(shown.value)}><Copy /></Button></div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShown(null)}>Done</Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><KeyRound className="size-4" /> API keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">Give a partner or store a key so they can create and read orders.</p>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await mkKey({ data: { name: keyName } }); setShown({ label: "New API key", value: r.key }); setKeyName(""); qc.invalidateQueries({ queryKey: ["api_keys"] }); }); }}>
            <Input aria-label="Key name" placeholder="Partner name, e.g. Acme Store" value={keyName} onChange={(e) => setKeyName(e.target.value)} required minLength={2} maxLength={80} />
            <Button disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create</Button>
          </form>
          <ul className="mt-4 divide-y text-sm">
            {(keys.data ?? []).map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0"><p className="font-medium">{k.name}</p><p className="font-mono text-xs text-muted-foreground">{k.prefix}… · used {fmtDate(k.last_used_at)}</p></div>
                {k.revoked_at ? <span className="text-xs text-destructive">Revoked</span> :
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", k.id); qc.invalidateQueries({ queryKey: ["api_keys"] }); }}>Revoke</Button>}
              </li>
            ))}
            {keys.data?.length === 0 && <li className="py-2 text-muted-foreground">No keys yet.</li>}
          </ul>
        </section>

        <section className="rounded-md border bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><Webhook className="size-4" /> Webhooks</h2>
          <p className="mt-1 text-sm text-muted-foreground">We POST signed events to your partner's URL when orders or returns change.</p>
          <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await mkHook({ data: { ...hook, events: events as typeof EVENTS[number][] } }); setShown({ label: "Signing secret", value: r.secret }); setHook({ name: "", url: "" }); qc.invalidateQueries({ queryKey: ["webhooks"] }); }); }}>
            <Input aria-label="Webhook name" placeholder="Name" value={hook.name} onChange={(e) => setHook({ ...hook, name: e.target.value })} required minLength={2} />
            <Input aria-label="Webhook URL" type="url" placeholder="https://partner.example.com/hooks/bnoy" value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} required pattern="https://.*" />
            <div className="flex flex-wrap gap-3 text-xs">{EVENTS.map((ev) => <label key={ev} className="flex items-center gap-1"><input type="checkbox" checked={events.includes(ev)} onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))} />{ev}</label>)}</div>
            <Button disabled={busy || events.length === 0}>Add webhook</Button>
          </form>
          <ul className="mt-4 divide-y text-sm">
            {(hooks.data ?? []).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0"><p className="font-medium">{h.name}</p><p className="truncate text-xs text-muted-foreground">{h.url} · last {h.last_status ?? "—"}</p></div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { const r = await ping({ data: { id: h.id } }); r.ok ? toast.success(`Delivered (${r.status})`) : toast.error(`Delivery failed (${r.status ?? "no response"})`); qc.invalidateQueries({ queryKey: ["webhooks"] }); })}><Send /> Test</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await supabase.from("webhook_endpoints").delete().eq("id", h.id); qc.invalidateQueries({ queryKey: ["webhooks"] }); }}>Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-md bg-navy p-5 text-sm text-navy-foreground">
        <h2 className="font-bold">Quick reference</h2>
        <pre className="mt-3 overflow-x-auto rounded bg-navy-foreground/10 p-3 text-xs">{`# Create an order
curl -X POST ${origin}/api/public/v1/shipments \\
  -H "Authorization: Bearer bnoy_live_..." -H "Content-Type: application/json" \\
  -d '{"receiver_name":"Asha","receiver_phone":"9876543210","receiver_address":"12 MG Road","city":"Jaipur","pincode":"302001","sender_name":"Acme","cod_amount":499}'

# List your orders
curl ${origin}/api/public/v1/shipments?limit=20 -H "Authorization: Bearer bnoy_live_..."

# Public tracking (no key)
curl ${origin}/api/public/track/<tracking-code-or-order-id>

# Webhook signature: X-Bnoy-Signature = "sha256=" + HMAC_SHA256(secret, raw body)`}</pre>
      </section>
    </AppShell>
  );
}
