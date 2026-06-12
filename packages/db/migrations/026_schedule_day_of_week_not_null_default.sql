UPDATE sites
SET schedule_day_of_week = 1
WHERE schedule_day_of_week IS NULL;

ALTER TABLE sites
  ALTER COLUMN schedule_day_of_week SET DEFAULT 1,
  ALTER COLUMN schedule_day_of_week SET NOT NULL;

