<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Team hierarchy lives in `profiles.parent_id` + `user_roles`; visibility uses `is_ancestor()` security-definer RPC — why: one recursive check reused by every RLS policy.
- Shipment ownership columns (created_by, distributor_id, manager_id) are filled by DB trigger from the rider/creator chain — why: clients can't spoof hierarchy.
- Creating/removing/moving team members goes through server functions in `src/lib/team.functions.ts` (admin client after role checks) — why: auth user creation needs privileged access.
- Public tracking uses the `track_shipment` RPC only — why: never expose shipments table to anon.

- Courier accounts reuse platform admin authorization; exchange rows are admin-only with RLS — why: credentials and external orders must not leak across operational roles.
- Courier secrets are deployment secrets read inside server handlers, never partner metadata — why: partner configuration is visible to clients.
- Custom webhooks accept only the normalized order-exchange contract; native callbacks require provider-specific verification — why: unsupported payload and signature formats must not be guessed.
- Public visual content uses individual bundled logistics photos and GSAP matchMedia cleanup — why: predictable rendering and reduced-motion accessibility.
- Returns/cancellations live in `return_requests` (+ events, photos in private `return-photos` bucket under `<return_id>/`); shipment status side effects run in DB triggers — why: tracking and permissions stay consistent for every client.
- Partner API keys are stored only as SHA-256 hashes; `/api/public/v1/*` verifies the key before using the admin client, and outbound webhooks are HMAC-signed via `src/lib/webhooks.server.ts` — why: keys and secrets must never be recoverable or spoofable.
- Phone OTP at signup is demo-only (fixed code) until an SMS provider is connected — why: no SMS credentials exist.
