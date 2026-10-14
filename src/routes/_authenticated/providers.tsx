import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageSquareText, Truck, CreditCard, ShoppingBag, Map, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/providers")({
  head: () => ({ meta: [{ title: "Providers — RouteFlow OS" }, { name: "description", content: "SMS, courier, payment and store integrations" }] }),
  component: ProvidersPage,
});

const CATS = [
  { id: "sms", label: "SMS & OTP", icon: MessageSquareText },
  { id: "courier", label: "Courier partners", icon: Truck },
  { id: "payment", label: "Payments & COD", icon: CreditCard },
  { id: "ecommerce", label: "Stores & marketplaces", icon: ShoppingBag },
  { id: "maps", label: "Maps", icon: Map },
];

function ProvidersPage() {
  const { role } = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["providers"], queryFn: async () => (await supabase.from("providers").select("*").order("name")).data ?? [] });
  const isAdmin = role === "admin";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function toggle(id: string, enabled: boolean) {
    const { error } = await supabase.from("providers").update({ enabled }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(enabled ? "Enabled" : "Disabled"); qc.invalidateQueries({ queryKey: ["providers"] }); }
  }

  return (
    <AppShell title="Providers">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Everything runs in demo mode until real accounts are connected. OTPs are sent by the demo SMS provider (code <b>1234</b>).
      </p>
      {q.isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="space-y-8">
          {CATS.map((c) => {
            const list = (q.data ?? []).filter((p) => p.category === c.id);
            if (!list.length) return null;
            return (
              <section key={c.id}>
                <h2 className="mb-3 flex items-center gap-2 font-bold"><c.icon className="h-4 w-4 text-primary" /> {c.label}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((p) => (
                    <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border bg-card p-4 shadow-card">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.mode === "live" ? "bg-success/15 text-success" : "bg-warning/30"}`}>
                          {p.mode === "live" ? "Live" : "Demo mode · not connected"}
                        </span>
                      </div>
                      <Switch checked={p.enabled} disabled={!isAdmin} onCheckedChange={(v) => toggle(p.id, v)} aria-label={`Toggle ${p.name}`} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="rounded-2xl bg-navy p-5 text-navy-foreground">
            <h2 className="flex items-center gap-2 font-bold"><Code2 className="h-4 w-4 text-lime" /> Tracking API</h2>
            <p className="mt-1 text-sm opacity-75">Let stores and partners fetch live status by tracking code or order ID.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-navy-foreground/10 p-3 text-xs">GET {origin}/api/public/track/RF261014ABCDE</pre>
          </section>
        </div>
      )}
    </AppShell>
  );
}
