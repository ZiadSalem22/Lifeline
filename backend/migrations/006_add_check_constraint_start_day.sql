-- Migration: add CHECK constraint to enforce allowed values for start_day_of_week
ALTER TABLE user_profiles
ADD CONSTRAINT CK_user_profiles_start_day CHECK (
    start_day_of_week IN ('Saturday','Sunday','Monday') OR start_day_of_week IS NULL
);
