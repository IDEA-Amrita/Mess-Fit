// Realistic, made-up data for the README screenshots: one student on a
// maintain-weight plan eating at a South Indian hostel mess. Shapes follow
// src/lib/*-api.ts; nothing here reaches a real backend.

const today = new Date();
const iso = (d: Date) => d.toLocaleDateString("en-CA");
export const TODAY = iso(today);
const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 86_400_000));

const item = (
  dish_id: string,
  name: string,
  portions: number,
  serving_unit: string,
  portion_icon: string,
  grams: number,
  kcal: number,
  protein_g: number,
  carbs_g: number,
  fats_g: number,
  reason: string,
) => ({ dish_id, name, portions, serving_unit, portion_icon, grams, kcal, protein_g, carbs_g, fats_g, reason });

export const PLATE = {
  plan: {
    breakfast: [
      item("d1", "Idli", 3, "piece", "piece", 120, 174, 6, 36, 1, "Light, steamed carbs to start the day"),
      item("d2", "Sambar", 1, "katori", "katori", 150, 120, 6, 16, 4, "Lentils add protein to the idli"),
      item("d3", "Boiled Egg", 2, "piece", "piece", 100, 155, 13, 1, 11, "Cheapest complete protein on the menu"),
    ],
    lunch: [
      item("d4", "Chapati", 3, "piece", "piece", 120, 297, 9, 54, 5, "Steadier energy than a second rice helping"),
      item("d5", "Dal Tadka", 1.5, "katori", "katori", 225, 236, 14, 32, 6, "Main protein source at lunch"),
      item("d6", "Steamed Rice", 1, "katori", "katori", 150, 195, 4, 43, 0, "Fills the remaining carb gap"),
      item("d7", "Curd", 1, "small_katori", "small_katori", 100, 61, 4, 5, 3, "Protein plus probiotics, easy on the stomach"),
    ],
    snack: [
      item("d8", "Sundal (Chana)", 1, "small_katori", "small_katori", 100, 164, 9, 27, 3, "High-fibre evening snack"),
      item("d9", "Banana", 1, "piece", "piece", 118, 105, 1, 27, 0, "Quick carbs before the workout"),
    ],
    dinner: [
      item("d10", "Chapati", 2, "piece", "piece", 80, 198, 6, 36, 3, "Kept moderate for dinner"),
      item("d11", "Paneer Butter Masala", 1, "katori", "katori", 150, 330, 14, 12, 25, "Hits the protein target for the day"),
      item("d12", "Mixed Veg Poriyal", 1, "katori", "katori", 120, 110, 3, 14, 5, "Vegetables and micronutrients"),
    ],
  },
  daily_totals: { kcal: 2155, protein_g: 89, carbs_g: 297, fats_g: 66 },
  daily_targets: { kcal: 2250, protein_g: 110, carbs_g: 290, fats_g: 70 },
  gap_fills: [
    {
      item_id: "c1",
      name: "Milk (canteen)",
      portions: 1,
      cost_inr: 20,
      kcal: 150,
      protein_g: 8,
      carbs_g: 12,
      fats_g: 8,
      text: "Add a glass of milk from the canteen (₹20) to close the protein gap.",
    },
  ],
  solver_status: "Optimal",
  solve_time_ms: 84,
};

export const TODAY_LOGS = {
  date: TODAY,
  meals: [
    { id: "m1", date: TODAY, meal_type: "breakfast", status: "as_planned", notes: null, kcal: 449, protein_g: 25, carbs_g: 53, fats_g: 16 },
    { id: "m2", date: TODAY, meal_type: "lunch", status: "as_planned", notes: null, kcal: 789, protein_g: 31, carbs_g: 134, fats_g: 14 },
  ],
  weight: { date: TODAY, weight_kg: 68.4 },
  subjective: { date: TODAY, energy: 4, hunger: 3, mood: 4 },
  workout_status: null,
};

// A gentle, noisy downward trend over 30 days.
const weights = [70.6, 70.4, 70.5, 70.2, 70.3, 70.0, 69.9, 70.0, 69.8, 69.6, 69.7, 69.5, 69.4, 69.5, 69.2, 69.1, 69.2, 69.0, 68.9, 69.0, 68.8, 68.7, 68.8, 68.6, 68.5, 68.6, 68.4, 68.5, 68.3, 68.4];

export const progress = (range: string) => {
  const n = range === "7d" ? 7 : range === "90d" ? 30 : 30;
  const series = weights.slice(-n).map((w, i, a) => ({ date: daysAgo(a.length - 1 - i), weight_kg: w }));
  return {
    range,
    weight_series: series,
    adherence_rate: 0.86,
    macro_hit_rate: 0.78,
    projection: {
      available: true,
      stalled: false,
      moving_wrong_direction: false,
      current_rate_kg_per_week: -0.5,
      target_rate_kg_per_week: -0.5,
      projected_target_date: daysAgo(-49),
      on_track: true,
    },
    streak_days: 12,
    adaptive_tdee: { available: true, tdee: 2410, confidence: "medium", data_days: 30 },
  };
};

export const LEADERBOARD = {
  entries: [
    { rank: 1, is_you: false, display_name: "Arjun K.", meals_followed: 26, workouts_done: 6, score: 92 },
    { rank: 2, is_you: true, display_name: "You", meals_followed: 24, workouts_done: 5, score: 85 },
    { rank: 3, is_you: false, display_name: "Divya S.", meals_followed: 22, workouts_done: 5, score: 81 },
  ],
  user_rank: null,
};

const ex = (
  exercise_id: string,
  name: string,
  primary_muscle: string,
  sets: number,
  reps: string,
  rest_seconds: number,
  instruction_text: string,
  common_mistakes: string[],
) => ({ exercise_id, name, primary_muscle, sets, reps, rest_seconds, youtube_video_id: null, instruction_text, common_mistakes });

export const WORKOUT = {
  template_id: "t1",
  template_name: "Full Body A",
  goal: "maintain",
  week: 3,
  day: 2,
  day_name: "Upper body + core",
  exercises: [
    ex("e1", "Push-ups", "chest", 4, "12", 60, "Hands under shoulders, body in one straight line.", ["Sagging hips", "Flaring elbows"]),
    ex("e2", "Pike Push-ups", "shoulders", 3, "8", 75, "Hips high, lower your head toward the floor.", ["Bending the knees"]),
    ex("e3", "Backpack Rows", "back", 4, "12", 60, "Load a backpack with books; pull to your belly button.", ["Rounding the back"]),
    ex("e4", "Chair Dips", "triceps", 3, "10", 60, "Use a sturdy chair; keep your back close to it.", ["Shrugging shoulders"]),
    ex("e5", "Plank", "core", 3, "40s", 45, "Squeeze glutes, ribs down.", ["Hips too high"]),
  ],
};

export const CHAT_QUESTION = "Is mess sambar enough protein if I'm vegetarian?";

export const CHAT_ANSWER =
  "A katori of sambar is about **6 g of protein**, so stack it with:\n\n" +
  "- **Dal:** 1.5 katori ≈ 14 g\n" +
  "- **Curd:** ≈ 4 g a meal\n" +
  "- **Paneer or chana:** 9–14 g when served\n\n" +
  "That reaches 90–110 g a day without supplements.";

export const CHAT_CITATIONS = [
  { chunk_id: "k1", source: "learn", title: "Cheap protein sources in India", slug: "cheap-protein-india" },
  { chunk_id: "k2", source: "learn", title: "Protein 101 for hostel students", slug: "protein-101" },
];
