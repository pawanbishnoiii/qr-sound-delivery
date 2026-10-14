CREATE POLICY "Return photos readable by team" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'return-photos' AND public.can_see_return(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Return photos uploadable by team" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'return-photos' AND public.can_see_return(((storage.foldername(name))[1])::uuid));