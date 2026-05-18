"""Goal engine tests.

These describe the expected behaviour of the goal engine. They are
written *before* the implementation as the source of truth — every
nutrition decision MessFit makes flows from here, so we want this math
locked down with tests, not assumptions.

Reference values were computed by hand using:
- Mifflin-St Jeor BMR (1990 paper, the modern standard)
- Asia-Pacific BMI cutoffs (WHO 2004 — different from Western!)
- Activity factors: 1.2, 1.375, 1.55, 1.725, 1.9 (sedentary -> very active)
- 7700 kcal per kg of body fat (textbook)
- Daily calorie delta capped at +/- 500 kcal/day for safety
"""

from __future__ import annotations

from datetime import date

import pytest

from messfit_api.profile.goal_engine import (
    classify_bmi,
    compute_age,
    compute_bmi,
    compute_bmr_mifflin_st_jeor,
    compute_daily_kcal,
    compute_macros,
    compute_targets,
    compute_tdee,
)


# ────────────────────────────────────────────────────────────────────────
#  age
# ────────────────────────────────────────────────────────────────────────
class TestAge:
    def test_age_after_birthday(self):
        assert compute_age(date(2000, 5, 1), date(2026, 5, 18)) == 26

    def test_age_before_birthday(self):
        # birthday is later this year -> still 25
        assert compute_age(date(2000, 12, 31), date(2026, 5, 18)) == 25

    def test_age_on_birthday(self):
        assert compute_age(date(2000, 5, 18), date(2026, 5, 18)) == 26

    def test_age_day_before_birthday(self):
        assert compute_age(date(2000, 5, 19), date(2026, 5, 18)) == 25

    def test_age_leap_year_birthday(self):
        # Feb 29 child, asked on a non-leap year — treat as not-yet-birthday
        # until Mar 1 (compute_age compares (month, day) tuples).
        assert compute_age(date(2000, 2, 29), date(2026, 2, 28)) == 25
        assert compute_age(date(2000, 2, 29), date(2026, 3, 1)) == 26


# ────────────────────────────────────────────────────────────────────────
#  bmi
# ────────────────────────────────────────────────────────────────────────
class TestBMI:
    @pytest.mark.parametrize(
        "h_cm, w_kg, expected",
        [
            (175, 70, 22.9),
            (160, 50, 19.5),
            (180, 90, 27.8),
            (150, 35, 15.6),
            (170, 65, 22.5),
            (165, 55, 20.2),
        ],
    )
    def test_bmi_calculation(self, h_cm, w_kg, expected):
        assert compute_bmi(h_cm, w_kg) == pytest.approx(expected, abs=0.1)

    @pytest.mark.parametrize(
        "bmi, expected_class",
        [
            # Asia-Pacific (WHO 2004) cutoffs:
            #   < 18.5  underweight
            #   18.5–22.9  normal
            #   23.0–24.9  overweight
            #   >= 25.0  obese
            (15.0, "underweight"),
            (18.0, "underweight"),
            (18.4, "underweight"),
            (18.5, "normal"),  # boundary
            (20.0, "normal"),
            (22.9, "normal"),  # boundary
            (23.0, "overweight"),  # Asia-Pacific cutoff
            (24.0, "overweight"),
            (24.9, "overweight"),  # boundary
            (25.0, "obese"),  # Asia-Pacific cutoff
            (30.0, "obese"),
            (40.0, "obese"),
        ],
    )
    def test_classification(self, bmi, expected_class):
        assert classify_bmi(bmi) == expected_class


# ────────────────────────────────────────────────────────────────────────
#  bmr (mifflin-st jeor)
# ────────────────────────────────────────────────────────────────────────
class TestBMR:
    def test_male_bmr(self):
        # 175 cm, 70 kg, 25 y male
        # base = 10*70 + 6.25*175 - 5*25 = 700 + 1093.75 - 125 = 1668.75
        # male offset +5 -> 1673.75
        assert compute_bmr_mifflin_st_jeor(70, 175, 25, "male") == pytest.approx(
            1673.75, abs=0.01
        )

    def test_female_bmr(self):
        # 160 cm, 55 kg, 25 y female -> 10*55 + 6.25*160 - 5*25 - 161 = 1264.0
        assert compute_bmr_mifflin_st_jeor(55, 160, 25, "female") == pytest.approx(
            1264.0, abs=0.01
        )

    def test_other_bmr_uses_female_offset(self):
        # 'other' is treated like 'female' (-161 offset). Documented choice.
        assert compute_bmr_mifflin_st_jeor(55, 160, 25, "other") == pytest.approx(
            1264.0, abs=0.01
        )

    def test_male_vs_female_diff(self):
        # Same body, +5 vs -161 means males have 166 kcal higher BMR
        male = compute_bmr_mifflin_st_jeor(70, 175, 25, "male")
        female = compute_bmr_mifflin_st_jeor(70, 175, 25, "female")
        assert male - female == pytest.approx(166.0, abs=0.01)

    def test_low_weight(self):
        # 150 cm, 40 kg, 18 y female
        # 10*40 + 6.25*150 - 5*18 - 161 = 400 + 937.5 - 90 - 161 = 1086.5
        assert compute_bmr_mifflin_st_jeor(40, 150, 18, "female") == pytest.approx(
            1086.5, abs=0.01
        )


# ────────────────────────────────────────────────────────────────────────
#  tdee
# ────────────────────────────────────────────────────────────────────────
class TestTDEE:
    @pytest.mark.parametrize(
        "level, factor",
        [(1, 1.2), (2, 1.375), (3, 1.55), (4, 1.725), (5, 1.9)],
    )
    def test_activity_factors(self, level, factor):
        bmr = 1500.0
        assert compute_tdee(bmr, level) == pytest.approx(bmr * factor, abs=0.01)


# ────────────────────────────────────────────────────────────────────────
#  daily kcal target (with safety cap at +/-500)
# ────────────────────────────────────────────────────────────────────────
class TestDailyKcal:
    def test_maintenance(self):
        assert compute_daily_kcal(2000, 0.0) == 2000

    def test_modest_surplus(self):
        # 0.25 kg/week -> 0.25*7700/7 = 275 kcal/day surplus
        assert compute_daily_kcal(2000, 0.25) == 2275

    def test_modest_deficit(self):
        # -0.25 kg/week -> -275 kcal/day
        assert compute_daily_kcal(2000, -0.25) == 1725

    def test_aggressive_surplus_capped(self):
        # 1 kg/week would mean +1100 kcal/day; we cap at +500
        assert compute_daily_kcal(2000, 1.0) == 2500

    def test_aggressive_deficit_capped(self):
        # -1 kg/week would mean -1100 kcal/day; we cap at -500
        assert compute_daily_kcal(2000, -1.0) == 1500

    def test_at_cap_boundary_surplus(self):
        # Exactly at the 500 kcal/day boundary (rate ~0.4545 kg/week)
        assert compute_daily_kcal(2000, 0.5) == 2500

    def test_at_cap_boundary_deficit(self):
        assert compute_daily_kcal(2000, -0.5) == 1500


# ────────────────────────────────────────────────────────────────────────
#  macros
# ────────────────────────────────────────────────────────────────────────
class TestMacros:
    def test_gain_protein_per_kg(self):
        # gain goal -> 1.6 g/kg protein
        p, _, _ = compute_macros(2500, 60, "gain", [])
        assert p == 96  # 1.6 * 60

    def test_lose_protein_per_kg(self):
        # lose goal -> 2.0 g/kg protein (preserve muscle in deficit)
        p, _, _ = compute_macros(1800, 60, "lose", [])
        assert p == 120  # 2.0 * 60

    def test_maintain_protein_per_kg(self):
        # maintain goal -> 1.2 g/kg protein
        p, _, _ = compute_macros(2200, 60, "maintain", [])
        assert p == 72  # 1.2 * 60

    def test_pcos_protein_bump(self):
        p_normal, _, _ = compute_macros(1800, 60, "lose", [])
        p_pcos, _, _ = compute_macros(1800, 60, "lose", ["pcos"])
        assert p_pcos > p_normal
        # +0.1 g/kg bump for PCOS -> 60 * 0.1 = 6 g extra protein
        assert p_pcos == p_normal + 6

    def test_diabetes_lower_carb(self):
        _, c_normal, _ = compute_macros(2000, 70, "maintain", [])
        _, c_diabetes, _ = compute_macros(2000, 70, "maintain", ["diabetes"])
        assert c_diabetes < c_normal

    def test_pcos_lower_carb(self):
        _, c_normal, _ = compute_macros(2000, 70, "maintain", [])
        _, c_pcos, _ = compute_macros(2000, 70, "maintain", ["pcos"])
        assert c_pcos < c_normal

    def test_macros_sum_to_kcal_within_tolerance(self):
        # protein 4 kcal/g, carbs 4 kcal/g, fats 9 kcal/g
        # rounding tolerance: 5%
        for kcal in (1500, 1800, 2000, 2500, 3000, 3500):
            p, c, f = compute_macros(kcal, 70, "maintain", [])
            total = p * 4 + c * 4 + f * 9
            ratio = abs(total - kcal) / kcal
            assert ratio < 0.05, f"kcal={kcal}: macros total {total}, ratio {ratio}"

    def test_fats_floor_at_0_8_g_per_kg(self):
        # fats should be at least 0.8 g/kg even at low calorie targets
        _, _, f = compute_macros(1200, 60, "lose", [])
        assert f >= int(round(60 * 0.8))

    def test_carbs_never_negative(self):
        # Even with tight protein/fats budget, carbs should not go negative
        for kcal in (1200, 1500, 1800):
            _, c, _ = compute_macros(kcal, 80, "lose", [])
            assert c >= 0

    def test_unknown_condition_ignored(self):
        # Unknown / unrecognised condition strings should not crash or
        # affect output.
        baseline = compute_macros(2000, 70, "maintain", [])
        with_unknown = compute_macros(2000, 70, "maintain", ["alien_disease"])
        assert baseline == with_unknown


# ────────────────────────────────────────────────────────────────────────
#  end-to-end: compute_targets
# ────────────────────────────────────────────────────────────────────────
class TestComputeTargets:
    def test_typical_underweight_male_bulker(self):
        # 19 y, 50 kg, 175 cm, moderate activity, gain 0.25 kg/week
        # BMI = 50 / 1.75**2 = 16.3 -> underweight
        t = compute_targets(
            dob=date(2007, 1, 1),
            sex="male",
            height_cm=175,
            current_weight_kg=50,
            target_rate_kg_per_week=0.25,
            goal="gain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.bmi_class == "underweight"
        assert t.daily_kcal > t.tdee
        # protein: 1.6 * 50 = 80
        assert t.daily_protein_g == 80

    def test_obese_female_pcos_cutter(self):
        t = compute_targets(
            dob=date(2003, 1, 1),
            sex="female",
            height_cm=160,
            current_weight_kg=70,
            target_rate_kg_per_week=-0.4,
            goal="lose",
            activity_level=2,
            conditions=["pcos", "diabetes", "anemia"],
            today=date(2026, 5, 18),
        )
        assert t.bmi_class == "obese"
        assert t.daily_kcal < t.tdee
        # PCOS bumps protein per kg to 2.1 -> 70 * 2.1 = 147
        assert t.daily_protein_g == 147
        # rationale should record the conditions we applied
        assert "pcos" in t.rationale["conditions_applied"]
        assert "diabetes" in t.rationale["conditions_applied"]

    def test_normal_athlete_maintain(self):
        t = compute_targets(
            dob=date(2002, 6, 15),
            sex="male",
            height_cm=178,
            current_weight_kg=72,
            target_rate_kg_per_week=0.0,
            goal="maintain",
            activity_level=4,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.bmi_class == "normal"
        assert t.daily_kcal == int(round(t.tdee))

    def test_rationale_contains_all_keys(self):
        t = compute_targets(
            dob=date(2005, 1, 1),
            sex="male",
            height_cm=170,
            current_weight_kg=65,
            target_rate_kg_per_week=0.2,
            goal="gain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        # The rationale dict powers the "Why these numbers?" UI panel.
        # If keys disappear we want to know in CI.
        for key in (
            "age",
            "bmi_formula",
            "bmi_classification_basis",
            "bmr_formula",
            "tdee_formula",
            "kcal_target_basis",
            "protein_basis",
            "fats_basis",
            "carbs_basis",
            "conditions_applied",
        ):
            assert key in t.rationale, f"missing rationale key: {key}"

    def test_rationale_strings_are_human_readable(self):
        t = compute_targets(
            dob=date(2005, 1, 1),
            sex="male",
            height_cm=170,
            current_weight_kg=65,
            target_rate_kg_per_week=0.2,
            goal="gain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        # We render these directly in the UI; should be non-empty strings.
        assert isinstance(t.rationale["bmr_formula"], str)
        assert "Mifflin" in t.rationale["bmr_formula"]
        assert isinstance(t.rationale["bmi_formula"], str)
        assert "kg" in t.rationale["bmi_formula"]

    def test_targets_is_immutable(self):
        # Targets is a frozen dataclass — accidental mutation should
        # raise rather than silently update.
        t = compute_targets(
            dob=date(2005, 1, 1),
            sex="male",
            height_cm=170,
            current_weight_kg=65,
            target_rate_kg_per_week=0.2,
            goal="gain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        with pytest.raises(Exception):
            t.daily_kcal = 9999  # type: ignore[misc]


# ────────────────────────────────────────────────────────────────────────
#  edge cases
# ────────────────────────────────────────────────────────────────────────
class TestEdgeCases:
    def test_very_low_bmi_marked_underweight(self):
        t = compute_targets(
            dob=date(2007, 1, 1),
            sex="male",
            height_cm=180,
            current_weight_kg=45,
            target_rate_kg_per_week=0.5,
            goal="gain",
            activity_level=2,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.bmi < 18.5
        assert t.bmi_class == "underweight"

    def test_very_high_bmi_marked_obese(self):
        t = compute_targets(
            dob=date(2000, 1, 1),
            sex="male",
            height_cm=160,
            current_weight_kg=95,
            target_rate_kg_per_week=-0.5,
            goal="lose",
            activity_level=1,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.bmi >= 25
        assert t.bmi_class == "obese"

    def test_youngest_likely_user(self):
        # 18 y is the realistic floor for hostel students
        t = compute_targets(
            dob=date(2008, 5, 18),
            sex="female",
            height_cm=160,
            current_weight_kg=50,
            target_rate_kg_per_week=0.0,
            goal="maintain",
            activity_level=2,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.daily_kcal > 0
        assert t.daily_protein_g > 0

    def test_oldest_likely_user(self):
        # 30 y as a reasonable upper bound for the pilot
        t = compute_targets(
            dob=date(1996, 1, 1),
            sex="male",
            height_cm=175,
            current_weight_kg=75,
            target_rate_kg_per_week=0.0,
            goal="maintain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.daily_kcal > 0

    def test_multiple_conditions_combine(self):
        # PCOS bumps protein, diabetes lowers carbs — both should apply
        baseline = compute_targets(
            dob=date(2003, 1, 1),
            sex="female",
            height_cm=160,
            current_weight_kg=65,
            target_rate_kg_per_week=-0.25,
            goal="lose",
            activity_level=2,
            conditions=[],
            today=date(2026, 5, 18),
        )
        combo = compute_targets(
            dob=date(2003, 1, 1),
            sex="female",
            height_cm=160,
            current_weight_kg=65,
            target_rate_kg_per_week=-0.25,
            goal="lose",
            activity_level=2,
            conditions=["pcos", "diabetes"],
            today=date(2026, 5, 18),
        )
        assert combo.daily_protein_g > baseline.daily_protein_g
        assert combo.daily_carbs_g < baseline.daily_carbs_g

    def test_zero_weight_change_target_equals_tdee(self):
        t = compute_targets(
            dob=date(2003, 1, 1),
            sex="male",
            height_cm=175,
            current_weight_kg=70,
            target_rate_kg_per_week=0.0,
            goal="maintain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        assert t.daily_kcal == int(round(t.tdee))

    def test_deterministic_same_inputs_same_outputs(self):
        # Pure function — calling twice with the same inputs must give
        # identical outputs (no randomness, no time-of-day drift).
        kwargs = dict(
            dob=date(2005, 1, 1),
            sex="male",
            height_cm=170,
            current_weight_kg=65,
            target_rate_kg_per_week=0.2,
            goal="gain",
            activity_level=3,
            conditions=[],
            today=date(2026, 5, 18),
        )
        a = compute_targets(**kwargs)
        b = compute_targets(**kwargs)
        assert a == b
