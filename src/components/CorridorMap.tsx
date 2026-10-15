import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import type { Shipment } from "@/lib/status";

// Approximate positions on a 400x460 India canvas (lon/lat projected).
const HUBS: Record<string, { x: number; y: number }> = {
  Delhi: { x: 150, y: 110 }, Jaipur: { x: 125, y: 150 }, Lucknow: { x: 215, y: 140 }, Kolkata: { x: 315, y: 215 },
  Ahmedabad: { x: 85, y: 205 }, Indore: { x: 140, y: 220 }, Mumbai: { x: 85, y: 280 }, Pune: { x: 100, y: 295 },
  Hyderabad: { x: 165, y: 315 }, Bengaluru: { x: 150, y: 385 }, Chennai: { x: 200, y: 385 },
};
const CORRIDORS: Array<[string, string]> = [
  ["Delhi", "Mumbai"], ["Delhi", "Indore"], ["Indore", "Mumbai"], ["Mumbai", "Bengaluru"], ["Delhi", "Bengaluru"],
  ["Delhi", "Kolkata"], ["Bengaluru", "Chennai"], ["Mumbai", "Pune"], ["Hyderabad", "Bengaluru"], ["Delhi", "Jaipur"],
];
const OPEN = ["assigned", "picked_up", "in_transit", "out_for_delivery", "created"];
const SLA_H = 48;
const norm = (c: string) => Object.keys(HUBS).find((k) => c.toLowerCase().includes(k.toLowerCase()) || (k === "Bengaluru" && /bangalore/i.test(c)) || (k === "Delhi" && /gurgaon|gurugram|noida/i.test(c)));

function slaOf(list: Shipment[]) {
  const done = list.filter((r) => r.status === "delivered" && r.delivered_at);
  if (!done.length) return null;
  const ok = done.filter((r) => new Date(r.delivered_at!).getTime() - new Date(r.created_at).getTime() <= SLA_H * 36e5).length;
  return Math.round((ok / done.length) * 100);
}
const tone = (p: number | null) => (p === null ? "var(--muted-foreground)" : p >= 90 ? "var(--primary)" : p >= 75 ? "var(--chart-4, orange)" : "var(--destructive)");

export function CorridorAnalytics({ rows, now }: { rows: Shipment[]; now: number }) {
  const [sel, setSel] = useState<string>("Delhi-Mumbai");
  const byHub = useMemo(() => {
    const m = new Map<string, Shipment[]>();
    for (const r of rows) { const h = norm(r.city); if (h) m.set(h, [...(m.get(h) ?? []), r]); }
    return m;
  }, [rows]);
  const corridors = CORRIDORS.map(([a, b]) => {
    const list = [...(byHub.get(a) ?? []), ...(byHub.get(b) ?? [])];
    return { id: `${a}-${b}`, a, b, total: list.length, sla: slaOf(list), list };
  });
  const active = corridors.find((c) => c.id === sel) ?? corridors[0]!;

  const weeks = useMemo(() => {
    const out: { label: string; sla: number | null; n: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const end = now - w * 7 * 864e5, start = end - 7 * 864e5;
      const list = active.list.filter((r) => { const t = new Date(r.created_at).getTime(); return t > start && t <= end; });
      out.push({ label: w === 0 ? "This wk" : `-${w}w`, sla: slaOf(list), n: list.length });
    }
    return out;
  }, [active, now]);

  const breaches = rows
    .filter((r) => OPEN.includes(r.status) && now - new Date(r.created_at).getTime() > SLA_H * 36e5)
    .map((r) => ({ r, hours: Math.round((now - new Date(r.created_at).getTime()) / 36e5) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section className="rounded-lg border bg-card shadow-card">
        <div className="border-b p-4"><h2 className="font-bold">Logistics corridors</h2>{byHub.size === 0 && <p className="mt-1 text-xs text-muted-foreground">No parcels in these metro cities yet. SLA fills in once parcels ship to them.</p>}</div>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <svg viewBox="0 0 400 460" className="w-full max-h-[460px]" role="img" aria-label="India corridor map">
            <path d="M150 40 L200 60 L235 110 L300 150 L360 170 L340 230 L290 250 L250 300 L215 360 L200 420 L170 440 L140 400 L110 330 L80 290 L60 240 L40 200 L70 170 L110 150 L120 100 Z" fill="var(--muted)" stroke="var(--border)" strokeWidth="2" />
            {corridors.map((c) => {
              const A = HUBS[c.a]!, B = HUBS[c.b]!, on = c.id === active.id;
              return (
                <g key={c.id} onClick={() => setSel(c.id)} className="cursor-pointer">
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="transparent" strokeWidth="14" />
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={tone(c.sla)} strokeWidth={on ? 4 : 2} strokeDasharray={on ? undefined : "5 5"} opacity={on ? 1 : 0.7} />
                </g>
              );
            })}
            {Object.entries(HUBS).map(([name, p]) => {
              const n = byHub.get(name)?.length ?? 0;
              return (
                <g key={name}>
                  <circle cx={p.x} cy={p.y} r={4 + Math.min(n, 20) / 3} fill="var(--primary)" opacity={n ? 0.9 : 0.35} />
                  <text x={p.x + 8} y={p.y + 4} fontSize="11" fill="var(--foreground)" fontWeight={600}>{name}</text>
                </g>
              );
            })}
          </svg>
          <ul className="space-y-1.5 text-sm">
            {corridors.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSel(c.id)} className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left ${c.id === active.id ? "border-primary bg-accent" : ""}`}>
                  <span className="truncate">{c.a} ⇄ {c.b}</span>
                  <span className="tabular font-semibold" style={{ color: tone(c.sla) }}>{c.sla === null ? "—" : `${c.sla}%`}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-lg border bg-card p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="size-4 text-primary" />On-time SLA trend · {active.a} ⇄ {active.b}</h2>
          <p className="text-xs text-muted-foreground">Delivered within {SLA_H}h, last 8 weeks · {active.total} parcels</p>
          <div className="mt-4 flex h-40 items-end gap-2">
            {weeks.map((w) => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular text-muted-foreground">{w.sla === null ? "—" : `${w.sla}%`}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(4, w.sla ?? 0)}%`, background: tone(w.sla) }} />
                <span className="text-[10px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border bg-card shadow-card">
          <h2 className="flex items-center gap-2 border-b p-4 font-bold"><AlertTriangle className="size-4 text-destructive" />Transit breach alerts</h2>
          {breaches.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No open parcels past the {SLA_H}h SLA.</p> : (
            <ul className="divide-y text-sm">
              {breaches.map(({ r, hours }) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><a href={`/shipments/${r.id}`} className="font-mono font-semibold text-primary">{r.tracking_code}</a><p className="truncate text-xs text-muted-foreground">{r.city} · {r.status.replace(/_/g, " ")}</p></div>
                  <span className="shrink-0 rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">+{hours - SLA_H}h late</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
