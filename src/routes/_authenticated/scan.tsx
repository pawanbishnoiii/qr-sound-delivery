import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CheckCircle2, XCircle, Volume2, VolumeX, Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { QrScanner } from "@/components/QrScanner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScanned } from "@/lib/shipments";
import { playError, playSuccess, unlockAudio } from "@/lib/sound";
import { STATUS_META, type Shipment, type ShipmentStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan parcels — RouteFlow OS" }, { name: "description", content: "Scan QR labels with your camera" }] }),
  component: ScanPage,
});

type Mode = "lookup" | Extract<ShipmentStatus, "picked_up" | "in_transit" | "out_for_delivery" | "delivered">;
const MODES: { id: Mode; label: string }[] = [
  { id: "lookup", label: "Lookup" },
  { id: "picked_up", label: "Pickup" },
  { id: "in_transit", label: "In transit" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
];

type Result = { ok: boolean; code: string; msg: string; shipment?: Shipment; at: number };

function ScanPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("lookup");
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<Result[]>([]);
  const last = useRef<{ code: string; t: number }>({ code: "", t: 0 });

  async function handle(raw: string) {
    const code = parseScanned(raw);
    const now = Date.now();
    if (!code || (code === last.current.code && now - last.current.t < 3000)) return;
    last.current = { code, t: now };
    setBusy(true);
    try {
      const { data: s, error } = await supabase.from("shipments").select("*").eq("tracking_code", code).maybeSingle();
      if (error) throw error;
      if (!s) throw new Error("Not found or not in your team");
      let shipment = s as Shipment;
      let msg = `Found · ${STATUS_META[shipment.status].label}`;
      if (mode !== "lookup") {
        if (shipment.status === mode) msg = `Already ${STATUS_META[mode].label}`;
        else if (shipment.status === "delivered" || shipment.status === "returned") throw new Error(`Already ${STATUS_META[shipment.status].label}`);
        else {
          const { data: u, error: ue } = await supabase.from("shipments").update({ status: mode }).eq("id", shipment.id).select("*").single();
          if (ue) throw ue;
          shipment = u as Shipment;
          msg = `Updated → ${STATUS_META[mode].label}`;
          qc.invalidateQueries({ queryKey: ["shipments"] });
        }
      }
      if (sound) playSuccess();
      setLog((l) => [{ ok: true, code, msg, shipment, at: now }, ...l].slice(0, 20));
    } catch (e) {
      if (sound) playError();
      setLog((l) => [{ ok: false, code, msg: e instanceof Error ? e.message : "Scan failed", at: now }, ...l].slice(0, 20));
    } finally {
      setBusy(false);
    }
  }

  const latest = log[0];

  return (
    <AppShell
      title="Scan parcels"
      actions={
        <Button variant="outline" size="icon" onClick={() => { unlockAudio(); setSound((v) => !v); }} aria-label="Toggle sound">
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      }
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <div onClick={unlockAudio}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${mode === m.id ? "border-transparent bg-gradient-brand text-primary-foreground shadow-glow" : "bg-card hover:border-primary"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <QrScanner onScan={handle} paused={busy} />
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); unlockAudio(); last.current = { code: "", t: 0 }; void handle(manual); setManual(""); }}>
            <div className="relative flex-1">
              <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type tracking code" className="pl-9 font-mono uppercase" maxLength={40} />
            </div>
            <Button type="submit" variant="hero" disabled={!manual.trim() || busy}>Go</Button>
          </form>
        </div>

        <div className="space-y-4">
          {latest ? (
            <div className={`rounded-2xl border-2 p-5 shadow-card animate-rise ${latest.ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}`} key={latest.at}>
              <div className="flex items-center gap-3">
                {latest.ok ? <CheckCircle2 className="h-8 w-8 shrink-0 text-success" /> : <XCircle className="h-8 w-8 shrink-0 text-destructive" />}
                <div className="min-w-0">
                  <p className="truncate font-mono text-lg font-bold">{latest.code}</p>
                  <p className="text-sm">{latest.msg}</p>
                </div>
              </div>
              {latest.shipment && (
                <Link to="/shipments/$id" params={{ id: latest.shipment.id }} className="mt-4 block rounded-xl bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <p className="truncate font-semibold">{latest.shipment.receiver_name}</p>
                    <StatusBadge status={latest.shipment.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{latest.shipment.receiver_address}, {latest.shipment.city}</p>
                  {Number(latest.shipment.cod_amount) > 0 && <p className="mt-1 text-sm font-bold text-coral tabular">Collect COD ₹{Number(latest.shipment.cod_amount).toLocaleString("en-IN")}</p>}
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Point the camera at a parcel QR label. Choose a mode above to update status automatically on each scan.
            </div>
          )}
          {log.length > 1 && (
            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="mb-2 text-sm font-bold">Scan history</p>
              <ul className="divide-y text-sm">
                {log.slice(1).map((r) => (
                  <li key={r.at} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-2">
                    {r.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="truncate"><span className="font-mono font-semibold">{r.code}</span> · {r.msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
