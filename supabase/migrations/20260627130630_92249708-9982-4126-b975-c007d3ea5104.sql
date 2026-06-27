
CREATE POLICY "lm pod read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pod-lastmile' AND public.has_system_access(auth.uid(), 'pxlog-tms'));
CREATE POLICY "lm pod write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pod-lastmile' AND public.has_system_access(auth.uid(), 'pxlog-tms'));
CREATE POLICY "lm pod update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pod-lastmile' AND public.has_system_access(auth.uid(), 'pxlog-tms'));
CREATE POLICY "lm pod delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pod-lastmile' AND public.has_system_access(auth.uid(), 'pxlog-tms'));
