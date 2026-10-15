DROP POLICY "signed in read payout rates" ON public.payout_settings;
DROP POLICY "signed in read bonuses" ON public.payout_bonuses;
CREATE POLICY "admin reads payout rates" ON public.payout_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin reads bonuses" ON public.payout_bonuses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));