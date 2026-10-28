-- BarrioAI: free-tier guard for the public `menus` Storage bucket.
--
-- WHY: Supabase Free includes only 1 GB of file storage and 5 GB of
-- egress. The API already rejects photos above LIMIT_UPLOAD_MAX_IMAGE_BYTES
-- (default 4 MB, see lib/limits.ts), but a bucket-level limit is defence
-- in depth: no client, script, or future route can store a larger object
-- (or a non-image such as SVG/HTML) in this public bucket.
update storage.buckets
set
  file_size_limit = 4194304,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'menus';
