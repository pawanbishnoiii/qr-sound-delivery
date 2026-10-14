import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, ScanLine, Volume2, Users, IndianRupee, Radio, Building2, Briefcase, Bike, Crown, Check } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { QrCode as Qr } from "@/components/QrCode";
import hero from "@/assets/hero-rider.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RouteFlow OS — QR Delivery Automation SaaS" },
      { name: "description", content: "Generate QR parcel labels, scan with any phone camera, and run your admin → distributor → manager → rider delivery network." },
      { property: "og:title", content: "RouteFlow OS — QR Delivery Automation SaaS" },
      { property: "og:description", content: "QR labels, phone-camera scanning with sound alerts, and a flexible delivery team hierarchy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: QrCode, title: "Instant QR labels", text: "Every shipment gets a unique QR label, ready to print in one tap." },
  { icon: ScanLine, title: "Scan with any phone", text: "No hardware. Riders use their phone camera to pick up and deliver." },
  { icon: Volume2, title: "Sound & vibration", text: "Clear success chime and error buzz so riders never miss a scan." },
  { icon: Radio, title: "Live status", text: "Status changes sync instantly across every dashboard in your team." },
  { icon: IndianRupee, title: "COD tracking", text: "Know exactly how much cash is pending collection per rider." },
  { icon: Users, title: "Flexible hierarchy", text: "Riders under managers or directly under distributors — your call." },
];

const STEPS = ["Created", "Assigned", "Picked up", "Out for delivery", "Delivered"];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-hero text-navy-foreground">
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <Brand light />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/track" search={{}} className="hidden text-sm font-medium opacity-80 hover:opacity-100 sm:block">Track parcel</Link>
            <Link to="/auth" className="text-sm font-medium opacity-80 hover:opacity-100">Login</Link>
            <Button asChild variant="hero" size="sm"><Link to="/auth">Get started <ArrowRight /></Link></Button>
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2 lg:pb-24 lg:pt-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/20 px-3 py-1 text-xs font-semibold animate-rise">
              <span className="h-2 w-2 rounded-full bg-lime" /> Built for Indian last-mile delivery
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] sm:text-6xl animate-rise" style={{ animationDelay: "80ms" }}>
              Scan the parcel.<br /><span className="text-gradient-brand">Automate the rest.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base opacity-80 sm:text-lg animate-rise" style={{ animationDelay: "160ms" }}>
              QR labels, phone-camera scanning with sound alerts, and one command center for admins, distributors, managers and riders.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-rise" style={{ animationDelay: "240ms" }}>
              <Button asChild variant="hero" size="lg" className="h-12"><Link to="/auth">Start free <ArrowRight /></Link></Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-navy-foreground/30 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground">
                <Link to="/track" search={{}}><ScanLine /> Track a parcel</Link>
              </Button>
            </div>
          </div>
          <div className="relative animate-rise" style={{ animationDelay: "200ms" }}>
            <img src={hero} alt="Rider on scooter with QR-labelled delivery box" width={1280} height={1024} className="w-full rounded-3xl shadow-glow" />
            <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-card p-3 text-card-foreground shadow-card animate-float sm:left-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/15 text-success"><Check /></span>
              <div><p className="text-sm font-bold">Delivered</p><p className="font-mono text-xs text-muted-foreground">RF261014A7K2Q</p></div>
            </div>
          </div>
        </div>
        <svg className="absolute inset-x-0 bottom-0 h-24 w-full opacity-40" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden>
          <path d="M0 80 C 300 10, 500 100, 760 50 S 1200 0, 1440 60" fill="none" stroke="var(--lime)" strokeWidth="2" strokeDasharray="6 8" className="animate-dash" />
        </svg>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">Everything a delivery network needs, nothing it doesn’t.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card p-6 sm:p-8">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-lime">Who does what</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">A team tree that bends to your business</h2>
            <p className="mt-4 opacity-75">Each level sees only its own network. Add people below you in seconds — they log in with the email and password you set.</p>
          </div>
          <ol className="space-y-3">
            {[
              { i: Crown, r: "Admin", t: "Owns the platform, sees everything, adds distributors." },
              { i: Building2, r: "Distributor", t: "Runs a region. Adds managers and riders." },
              { i: Briefcase, r: "Manager", t: "Runs a hub inside a distributor. Adds riders, assigns parcels." },
              { i: Bike, r: "Rider", t: "Scans, picks up and delivers. Collects COD." },
            ].map((x, idx) => (
              <li key={x.r} className="flex items-center gap-4 rounded-2xl border border-navy-foreground/10 bg-navy-foreground/5 p-4" style={{ marginLeft: idx * 20 }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-brand"><x.i className="h-5 w-5" /></span>
                <div><p className="font-bold">{x.r}</p><p className="text-sm opacity-70">{x.t}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-sm rounded-3xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground"><span>ROUTEFLOW OS</span><span>COD ₹1,250</span></div>
          <div className="mt-4 flex justify-center"><Qr value="RF-DEMO-LABEL" size={180} /></div>
          <p className="mt-4 text-center font-mono text-lg font-bold">RF-DEMO-LABEL</p>
          <p className="text-center text-xs text-muted-foreground">Sample label · Sri Ganganagar</p>
        </div>
        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">From label to doorstep in five scans</h2>
          <ol className="mt-8 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand font-bold text-primary-foreground tabular">{i + 1}</span>
                <span className="font-semibold">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-brand p-10 text-center text-primary-foreground sm:p-16">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to automate your deliveries?</h2>
          <p className="mx-auto mt-3 max-w-lg opacity-90">The first account you create becomes the Admin. Then build your team.</p>
          <Button asChild size="lg" variant="secondary" className="mt-8 h-12"><Link to="/auth">Create admin account <ArrowRight /></Link></Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Brand />
          <div className="flex gap-6"><Link to="/track" search={{}}>Track</Link><Link to="/auth">Login</Link></div>
          <p>© {new Date().getFullYear()} RouteFlow OS</p>
        </div>
      </footer>
    </div>
  );
}
