-- Migration: Create dish_feedback table for crowdsourcing (D25)
-- Run manually against the Supabase database.
-- This table stores one vote per user per dish per meal per day.

CREATE TABLE IF NOT EXISTS dish_feedback (
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE        NOT NULL,
    meal_type  TEXT        NOT NULL,
    dish_id    UUID        NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    vote       TEXT        NOT NULL CHECK (vote IN ('confirm', 'deny')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, date, meal_type, dish_id)
);

-- Index for fast aggregation queries (counting votes per dish per meal per day)
CREATE INDEX IF NOT EXISTS idx_dish_feedback_lookup
    ON dish_feedback (date, meal_type, dish_id);
