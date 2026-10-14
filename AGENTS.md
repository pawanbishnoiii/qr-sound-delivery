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
