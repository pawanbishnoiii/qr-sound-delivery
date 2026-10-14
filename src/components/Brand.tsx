import { Link } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
        <RouteIcon className="h-5 w-5" />
      </span>
      <span className={`font-display text-lg font-bold leading-none ${light ? "text-navy-foreground" : "text-foreground"}`}>
        RouteFlow <span className="text-gradient-brand">OS</span>
      </span>
    </Link>
  );
}
