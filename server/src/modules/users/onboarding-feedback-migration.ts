export const onboardingFeedbackMigrationStatements = [
  `CREATE FUNCTION pg_temp.normalize_music_metadata(value jsonb) RETURNS jsonb
   LANGUAGE plpgsql AS $$
   DECLARE result jsonb; item jsonb; field text;
   BEGIN
     IF jsonb_typeof(value) = 'object' THEN
       result := '{}'::jsonb;
       FOR field, item IN SELECT * FROM jsonb_each(value) LOOP
         IF field = 'genre' AND jsonb_typeof(item) = 'string' THEN
           item := to_jsonb(CASE item #>> '{}' WHEN 'Soul' THEN 'R&B / Soul' WHEN 'R&B' THEN 'R&B / Soul' WHEN 'Hip-Hop' THEN 'Hip-hop' ELSE item #>> '{}' END);
         ELSIF field = 'genres' AND jsonb_typeof(item) = 'array' THEN
           SELECT COALESCE(jsonb_agg(genre ORDER BY first_seen), '[]'::jsonb) INTO item FROM (
             SELECT genre, MIN(position) AS first_seen FROM (
               SELECT CASE entry #>> '{}' WHEN 'Soul' THEN 'R&B / Soul' WHEN 'R&B' THEN 'R&B / Soul' WHEN 'Hip-Hop' THEN 'Hip-hop' ELSE entry #>> '{}' END AS genre, position
               FROM jsonb_array_elements(item) WITH ORDINALITY AS elements(entry,position)
             ) mapped GROUP BY genre
           ) unique_genres;
         ELSE
           item := pg_temp.normalize_music_metadata(item);
         END IF;
         IF field = 'socialLinks' AND jsonb_typeof(item) = 'object' THEN item := item - 'soundcloud'; END IF;
         result := result || jsonb_build_object(field,item);
       END LOOP;
       RETURN result;
     ELSIF jsonb_typeof(value) = 'array' THEN
       SELECT COALESCE(jsonb_agg(pg_temp.normalize_music_metadata(entry) ORDER BY position), '[]'::jsonb)
       INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS elements(entry,position);
       RETURN result;
     END IF;
     RETURN value;
   END $$`,
  ...["users", "tracks", "releases"].map(
    (table) =>
      `UPDATE ${table} SET payload=pg_temp.normalize_music_metadata(payload) WHERE payload IS DISTINCT FROM pg_temp.normalize_music_metadata(payload)`,
  ),
  `UPDATE users SET onboarding_step=CASE WHEN primary_intent IN ('artist','both') THEN 'artist_identity' ELSE 'visuals' END,
    payload=jsonb_set(payload,'{onboardingStep}',to_jsonb(CASE WHEN primary_intent IN ('artist','both') THEN 'artist_identity'::text ELSE 'visuals'::text END))
    WHERE onboarding_status <> 'complete' AND onboarding_step='personalize'`,
  "DROP FUNCTION pg_temp.normalize_music_metadata(jsonb)",
];
