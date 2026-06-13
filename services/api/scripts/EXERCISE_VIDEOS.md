# Exercise demo video curation

`scripts/seed_exercises.py` seeds all 50 exercises with full form metadata but
leaves `youtube_video_id` **NULL** on purpose. Video IDs must be curated by hand
— generated IDs would be hallucinated and point to broken or wrong videos.

This is the outstanding Phase 5 data task (the quality gate: *"all 50 exercises
have a working YouTube embed, manually verified"*).

## How to curate
For each exercise, find ONE high-quality demo from a reputable channel
(Athlean-X, Jeff Nippard, Jeremy Ethier, etc.) and **confirm the video allows
embedding** — some channels disable it (you'll see "Video unavailable" in the
iframe). The `youtube_video_id` is the part after `v=` in the URL
(`https://www.youtube.com/watch?v=`**`IODxDxX7oi4`**).

## How to apply
Update rows directly, e.g.:
```sql
UPDATE exercises SET youtube_video_id = 'IODxDxX7oi4' WHERE id = 'pushup';
```
Re-running `seed_exercises.py` is safe — it upserts metadata but **does not**
overwrite a curated `youtube_video_id` back to NULL.

## Current state
Until IDs are filled in, the `/workout` UI shows a "demo coming soon" placeholder
instead of the video — everything else works.
