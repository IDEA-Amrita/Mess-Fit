import type { Progress } from "./tracking-api";

export type Tone = "good" | "bad" | "neutral";

/**
 * Is a weight change *good*? That depends on the user's goal — someone bulking
 * wants to go up, someone cutting wants to go down — so colour by movement
 * toward the goal, never by raw direction.
 *
 * When the backend can't tell us the goal's direction (no projection yet, a
 * stalled trend, or a "maintain" goal with a zero target rate) stay neutral
 * rather than guess.
 */
export function weightTone(delta: number, projection: Progress["projection"]): Tone {
  if (delta === 0 || !projection.available) return "neutral";
  if (projection.moving_wrong_direction) return "bad";
  const target = projection.target_rate_kg_per_week;
  if (!target) return "neutral";
  return Math.sign(delta) === Math.sign(target) ? "good" : "bad";
}
