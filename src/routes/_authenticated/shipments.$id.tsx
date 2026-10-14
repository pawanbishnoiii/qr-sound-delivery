import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowLeft, Printer, ChevronRight, XCircle, Undo2, IndianRupee, Trash2, Loader2, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { useMe, useTeam } from "@/lib/auth";
import { trackUrl, useShipments } from "@/lib/shipments";
import { selectCls } from "@/lib/ui";
import { STATUS_META, fmtDate, inr, nextStatus, type Shipment, type ShipmentStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/shipments/$id")({
  head: () => ({ meta: [{ title: "Shipment — RouteFlow OS" }, { name: "description", content: "Shipment details and QR label" }] }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role, user } = useMe();
  useShipments(); // live updates
  const { data: team = [] } = useTeam();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["shipment", id],
    queryFn: async () => {
      const [{ data: s, error }, { data: ev }] = await Promise.all([
        supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
        supabase.from("shipment_events").select("*").eq("shipment_id", id).order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      return { s: s as Shipment | null, events: ev ?? [] };
    },
  });
  const s = q.data?.s;
  const names = new Map(team.map((t) => [t.id, t.full_name]));

  async function update(patch: Partial<Shipment>, msg: string) {
    setBusy(true);
    const { error } = await supabase.from("shipments").update(patch).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["shipment", id] });
    qc.invalidateQueries({ queryKey: ["shipments"] });
  }

  async function printLabel() {
    if (!s) return;
    const img = await QRCode.toDataURL(trackUrl(s.tracking_code), { width: 400, margin: 1 });
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { toast.error("Allow pop-ups to print labels"); return; }
    const esc = (v: string | null) => (v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    w.document.write(`<html><head><title>${esc(s.tracking_code)}</title><style>
      body{font-family:system-ui,sans-serif;margin:0;padding:16px}
      .l{border:2px solid #111;border-radius:10px;padding:16px;width:360px}
      h1{font-size:14px;margin:0 0 8px;letter-spacing:.08em}
      .c{font:700 22px monospace;margin:8px 0}.r{font-size:13px;line-height:1.4}
      .cod{margin-top:10px;padding:6px 10px;background:#111;color:#fff;display:inline-block;border-radius:6px;font-weight:700}
    </style></head><body><div class="l"><h1>ROUTEFLOW OS</h1>
      <img src="${img}" width="200" height="200"/><div class="c">${esc(s.tracking_code)}</div>
      <div class="r"><b>To:</b> ${esc(s.receiver_name)} · ${esc(s.receiver_phone)}<br/>${esc(s.receiver_address)}<br/>${esc(s.city)} ${esc(s.pincode)}</div>
      <div class="r" style="margin-top:6px"><b>From:</b> ${esc(s.sender_name)} ${esc(s.sender_phone)}</div>
      <div class="r">Weight: ${s.weight_kg} kg</div>
      ${Number(s.cod_amount) > 0 ? `<div class="cod">COD ₹${Number(s.cod_amount).toLocaleString("en-IN")}</div>` : `<div class="cod">PREPAID</div>`}
    </div><script>onload=()=>{print()}</script></body></html>`);
    w.document.close();
  }

  if (q.isLoading) return <AppShell title="Shipment"><div className="grid place-items-center py-24"><Loader2 className="animate-spin" /></div></AppShell>;
  if (!s) return <AppShell title="Shipment"><div className="py-24 text-center"><p className="font-semibold">Shipment not found or not in your team.</p><Link to="/shipments" className="text-primary">Back to shipments</Link></div></AppShell>;

  const next = nextStatus(s.status);
  const isRider = role === "rider";
  const closed = ["delivered", "failed", "returned"].includes(s.status);
  const riders = team.filter((t) => t.role === "rider");

  return (
    <AppShell
      title={s.tracking_code}
      actions={<Button variant="outline" size="sm" onClick={printLabel}><Printer /> <span className="hidden sm:inline">Print label</span></Button>}
    >
      <Link to="/shipments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Shipments</Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Receiver</p>
                <p className="truncate text-xl font-bold">{s.receiver_name}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <a href={`tel:${s.receiver_phone}`} className="flex items-center gap-2 text-primary"><Phone className="h-4 w-4" /> {s.receiver_phone}</a>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(`${s.receiver_address}, ${s.city} ${s.pincode ?? ""}`)}`} target="_blank" rel="noreferrer" className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" /> {s.receiver_address}, {s.city} {s.pincode}</a>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4">
              <Info k="COD" v={<span className="tabular">{inr(Number(s.cod_amount))}{Number(s.cod_amount) > 0 && (s.cod_collected ? " ✓" : "")}</span>} />
              <Info k="Weight" v={`${s.weight_kg} kg`} />
              <Info k="Sender" v={s.sender_name} />
              <Info k="Created" v={fmtDate(s.created_at)} />
              <Info k="Distributor" v={s.distributor_id ? names.get(s.distributor_id) ?? "—" : "—"} />
              <Info k="Manager" v={s.manager_id ? names.get(s.manager_id) ?? "—" : "—"} />
              <Info k="Rider" v={s.rider_id ? names.get(s.rider_id) ?? "—" : "Unassigned"} />
              <Info k="Delivered" v={fmtDate(s.delivered_at)} />
            </dl>
            {s.notes && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{s.notes}</p>}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="font-bold">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {next && next !== "assigned" && !closed && (
                <Button variant="hero" disabled={busy} onClick={() => update({ status: next }, `Marked ${STATUS_META[next].label}`)}>
                  Mark {STATUS_META[next].label} <ChevronRight />
                </Button>
              )}
              {!closed && s.status !== "created" && (
                <Button variant="outline" disabled={busy} onClick={() => update({ status: "failed" }, "Marked failed")}><XCircle /> Failed attempt</Button>
              )}
              {s.status === "failed" && (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => update({ status: "out_for_delivery" }, "Retry scheduled")}>Retry delivery</Button>
                  <Button variant="outline" disabled={busy} onClick={() => update({ status: "returned" }, "Marked returned")}><Undo2 /> Return to sender</Button>
                </>
              )}
              {s.status === "delivered" && Number(s.cod_amount) > 0 && !s.cod_collected && (
                <Button variant="coral" disabled={busy} onClick={() => update({ cod_collected: true }, "COD collected")}><IndianRupee /> COD collected</Button>
              )}
              {(role === "admin" || (s.created_by === user?.id && s.status === "created")) && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("Delete this shipment?")) return;
                    const { error } = await supabase.from("shipments").delete().eq("id", id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Deleted");
                    navigate({ to: "/shipments" });
                  }}
                ><Trash2 /> Delete</Button>
              )}
            </div>
            {!isRider && !closed && (
              <div className="mt-5 max-w-sm space-y-1.5">
                <p className="text-sm font-medium">Assign rider</p>
                <select
                  className={selectCls}
                  value={s.rider_id ?? ""}
                  disabled={busy}
                  onChange={(e) => update({ rider_id: e.target.value || null }, e.target.value ? "Rider assigned" : "Rider removed")}
                >
                  <option value="">Unassigned</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                </select>
                {riders.length === 0 && <p className="text-xs text-muted-foreground">No riders yet — add them on the Team page.</p>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="font-bold">Timeline</h2>
            <ol className="relative mt-4 space-y-4 border-l pl-5">
              {q.data!.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-gradient-brand ring-4 ring-card" />
                  <p className="text-sm font-semibold">{STATUS_META[e.status as ShipmentStatus].label}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}{e.actor_id && names.get(e.actor_id) ? ` · by ${names.get(e.actor_id)}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-5 text-center shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Parcel QR label</p>
          <div className="mx-auto mt-3 w-fit rounded-xl border p-3"><QrCode value={trackUrl(s.tracking_code)} size={200} /></div>
          <p className="mt-3 font-mono text-lg font-bold">{s.tracking_code}</p>
          <p className="text-xs text-muted-foreground">Scan in the app to update status, or by the customer to track.</p>
          <Button className="mt-4 w-full" variant="hero" onClick={printLabel}><Printer /> Print label</Button>
        </aside>
      </div>
    </AppShell>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v}</dd></div>;
}
