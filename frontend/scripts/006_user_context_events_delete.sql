-- Allow users to delete their own context events (e.g. clear uploaded syllabus PDF)

CREATE POLICY "user_context_events_delete_own"
  ON public.user_context_events FOR DELETE
  USING (auth.uid() = user_id);
