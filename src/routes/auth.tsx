import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { phoneEmail, signUpWithPhone } from "@/lib/phone-auth.functions";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";
import hero from "@/assets/bnoy-operations.webp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Bnoy Logistics OS" },
      { name: "description", content: "Sign in to manage shipments, teams and QR scanning." },
      { property: "og:title", content: "Sign in — Bnoy Logistics OS" },
      { property: "og:description", content: "Sign in to manage shipments, teams and QR scanning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const phoneSignUp = useServerFn(signUpWithPhone);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const id = form.email.trim();
        const digits = id.replace(/[^0-9]/g, "").replace(/^91(?=[6-9][0-9]{9}$)/, "");
        const email = id.includes("@") ? id : /^[6-9][0-9]{9}$/.test(digits) ? phoneEmail(digits) : id;
        const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
        if (error) throw new Error(id.includes("@") ? error.message : "Wrong mobile number or password");
        navigate({ to: "/dashboard", replace: true });
      } else {
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters");
        const phone = form.phone.replace(/[^0-9]/g, "");
        if (!/^[6-9][0-9]{9}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number");
        if (!otpSent) { setOtpSent(true); toast.success("OTP sent to +91 " + phone + " (demo OTP: 1234)"); return; }
        if (otp !== "1234") throw new Error("Incorrect OTP");
        if (!form.email.trim()) {
          const r = await phoneSignUp({ data: { phone, name: form.name, password: form.password, otp } });
          if (r.error) throw new Error(r.error);
          const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: form.password });
          if (error) throw error;
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: form.name, phone: "+91" + form.phone.replace(/[^0-9]/g, ""), phone_verified_demo: true } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
    else if (!r.redirected) navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Brand />
          <h1 className="mt-10 text-3xl font-bold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "in" ? "Sign in to your delivery command center." : "The very first account becomes the Admin."}
          </p>

          <Button variant="outline" className="mt-8 h-11 w-full" onClick={google} type="button">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"/></svg>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            )}
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex gap-2"><span className="grid h-10 place-items-center rounded-md border px-3 text-sm text-muted-foreground">+91</span>
                <Input id="phone" type="tel" inputMode="numeric" required maxLength={10} disabled={otpSent} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
            )}
            {mode === "up" && otpSent && (
              <div className="space-y-1.5">
                <Label htmlFor="otp">OTP sent to your mobile</Label>
                <Input id="otp" inputMode="numeric" required maxLength={4} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))} placeholder="4-digit code" className="font-mono tracking-[0.5em]" />
                <p className="text-xs text-muted-foreground">Demo mode: use 1234. <button type="button" className="text-primary" onClick={() => { setOtpSent(false); setOtp(""); }}>Change number</button></p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{mode === "in" ? "Email or mobile number" : "Email (optional)"}</Label>
              <Input id="email" type={mode === "in" ? "text" : "email"} required={mode === "in"} autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" required minLength={mode === "up" ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {mode === "in" ? "Sign in" : otpSent ? "Verify OTP & create account" : "Send OTP"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "in" ? "New here?" : "Already have an account?"}{" "}
            <button className="font-semibold text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
        <img src={hero} alt="Delivery rider with QR-labelled parcel" width={1280} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy to-transparent p-10 text-navy-foreground">
          <p className="font-display text-2xl font-bold">Scan. Assign. Deliver.</p>
          <p className="mt-1 text-sm opacity-80">Admin → Distributor → Manager → Rider, all in one flow.</p>
        </div>
      </div>
    </div>
  );
}
