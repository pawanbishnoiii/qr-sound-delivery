import { useEffect, useRef, useState } from "react";
import { CameraOff, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { onScan: (text: string) => void; paused?: boolean };

/** Camera QR scanner. html5-qrcode is loaded only in the browser. */
export function QrScanner({ onScan, paused }: Props) {
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const scanner = useRef<any>(null);
  const cb = useRef(onScan);
  const pausedRef = useRef(paused);
  cb.current = onScan;
  pausedRef.current = paused;
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(id.current, { verbose: false });
        scanner.current = s;
        await s.start(
          { facingMode: facing },
          { fps: 10, qrbox: (w: number, h: number) => { const m = Math.floor(Math.min(w, h) * 0.7); return { width: m, height: m }; } },
          (text: string) => { if (!pausedRef.current) cb.current(text); },
          () => {},
        );
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      const s = scanner.current;
      scanner.current = null;
      if (s) s.stop().then(() => s.clear()).catch(() => {});
    };
  }, [facing]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy">
      <div id={id.current} className="aspect-square w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {!error && <div className="pointer-events-none absolute inset-x-[15%] h-0.5 bg-lime shadow-glow animate-scanline" />}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-navy-foreground">
          <div>
            <CameraOff className="mx-auto mb-3 h-10 w-10 opacity-70" />
            <p className="font-semibold">Camera not available</p>
            <p className="mt-1 text-sm opacity-70">Allow camera permission, or type the tracking code below.</p>
          </div>
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute right-3 top-3 rounded-full"
        onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
        aria-label="Switch camera"
      >
        <SwitchCamera />
      </Button>
    </div>
  );
}
