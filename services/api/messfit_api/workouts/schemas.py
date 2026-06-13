"""Pydantic schemas for the workouts API."""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ExerciseDetail(BaseModel):
    id: str
    name: str
    primary_muscle: str
    secondary_muscles: list[str]
    equipment: list[str]
    default_sets: int
    default_reps: str
    rest_seconds: int
    youtube_video_id: str | None
    instruction_text: str | None
    common_mistakes: list[str]

    model_config = ConfigDict(from_attributes=True)


class WorkoutExercise(BaseModel):
    """One exercise in today's session: the template's sets/reps merged with the
    exercise's display detail."""

    exercise_id: str
    name: str
    primary_muscle: str
    sets: int
    reps: str
    rest_seconds: int
    youtube_video_id: str | None
    instruction_text: str | None
    common_mistakes: list[str]


class TodayWorkout(BaseModel):
    template_id: str
    template_name: str
    goal: str
    week: int
    day: int
    day_name: str
    exercises: list[WorkoutExercise]


class TemplateSummary(BaseModel):
    id: str
    name: str
    goal: str
    equipment_required: list[str]
    duration_minutes: int
    days_per_week: int

    model_config = ConfigDict(from_attributes=True)


class ExerciseDone(BaseModel):
    exercise_id: str
    sets_done: int = Field(ge=0)
    reps_done: list[int] = Field(default_factory=list)


class WorkoutLogIn(BaseModel):
    date: datetime.date
    template_id: str
    exercises_done: list[ExerciseDone] = Field(default_factory=list)
    status: Literal["done", "partial", "skipped"]
    skip_reason: str | None = None


class WorkoutLogOut(BaseModel):
    id: uuid.UUID
    date: datetime.date
    template_id: str
    exercises_done: list[Any]
    status: str
    skip_reason: str | None

    model_config = ConfigDict(from_attributes=True)
