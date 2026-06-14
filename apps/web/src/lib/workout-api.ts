import { apiFetch } from "./api";

export interface WorkoutExercise {
  exercise_id: string;
  name: string;
  primary_muscle: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  youtube_video_id: string | null;
  instruction_text: string | null;
  common_mistakes: string[];
}

export interface TodayWorkout {
  template_id: string;
  template_name: string;
  goal: string;
  week: number;
  day: number;
  day_name: string;
  exercises: WorkoutExercise[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  goal: string;
  equipment_required: string[];
  duration_minutes: number;
  days_per_week: number;
}

export interface ExerciseDone {
  exercise_id: string;
  sets_done: number;
  reps_done: number[];
}

export type WorkoutStatus = "done" | "partial" | "skipped";

export interface WorkoutLogIn {
  date: string; // YYYY-MM-DD
  template_id: string;
  exercises_done: ExerciseDone[];
  status: WorkoutStatus;
  skip_reason?: string | null;
}

export interface WorkoutLogOut {
  id: string;
  date: string;
  template_id: string;
  exercises_done: ExerciseDone[];
  status: string;
  skip_reason: string | null;
}

export async function getTodayWorkout(): Promise<TodayWorkout> {
  return apiFetch<TodayWorkout>("/api/v1/workouts/today");
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  return apiFetch<TemplateSummary[]>("/api/v1/workouts/templates");
}

export async function logWorkout(payload: WorkoutLogIn): Promise<WorkoutLogOut> {
  return apiFetch<WorkoutLogOut>("/api/v1/logs/workout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
