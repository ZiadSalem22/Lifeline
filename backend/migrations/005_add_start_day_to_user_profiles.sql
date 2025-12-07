-- Migration: add start_day_of_week to user_profiles
ALTER TABLE user_profiles ADD start_day_of_week nvarchar(16) NULL;

-- Optional: create an index for faster lookups by start_day
-- CREATE INDEX IX_user_profiles_start_day ON user_profiles(start_day_of_week);
