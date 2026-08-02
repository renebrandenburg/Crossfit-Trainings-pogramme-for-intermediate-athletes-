import type {
  IntensityMethod,
  MovementFamilyId,
  ProgressionTrackType,
} from "./types";

export interface TemplateProgressionStep {
  weekNumber: number;
  sessionNumber: 1 | 2;
  role: "primary" | "secondary";
  trackType: ProgressionTrackType;
  movementFamilyId: MovementFamilyId;
  movementId: string;
  sets: number;
  reps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  durationSeconds: number | null;
  intensityMethod: IntensityMethod;
  intensityMin: number | null;
  intensityMax: number | null;
  restSeconds: number;
  technicalIntent: string;
  progressionObjective: string;
  stoppingRule: string | null;
  estimatedDurationMinutes: number;
}

export interface MixedStrengthWeekTemplate {
  weekNumber: number;
  theme: string;
  day1ConditioningMinutes: number;
  day2ConditioningMinutes: number;
  steps: TemplateProgressionStep[];
}

function step(
  value: Omit<
    TemplateProgressionStep,
    "repRangeMin" | "repRangeMax" | "durationSeconds" | "stoppingRule"
  > &
    Partial<
      Pick<
        TemplateProgressionStep,
        "repRangeMin" | "repRangeMax" | "durationSeconds" | "stoppingRule"
      >
    >,
): TemplateProgressionStep {
  return {
    repRangeMin: null,
    repRangeMax: null,
    durationSeconds: null,
    stoppingRule: null,
    ...value,
  };
}

const GYMNASTICS_STOP =
  "Stop the set when strict pulling speed or hollow-body position breaks down.";

export const MIXED_STRENGTH_TEMPLATE: ReadonlyArray<MixedStrengthWeekTemplate> =
  Object.freeze([
    {
      weekNumber: 1,
      theme: "Base volume and technical quality",
      day1ConditioningMinutes: 9,
      day2ConditioningMinutes: 13,
      steps: [
        step({
          weekNumber: 1,
          sessionNumber: 1,
          role: "primary",
          trackType: "front_squat",
          movementFamilyId: "front_squat",
          movementId: "front_squat",
          sets: 5,
          reps: 5,
          intensityMethod: "percentage_1rm",
          intensityMin: 72,
          intensityMax: 75,
          restSeconds: 120,
          technicalIntent:
            "Build repeatable volume with an upright, braced torso.",
          progressionObjective: "Establish the front-squat volume baseline.",
          estimatedDurationMinutes: 20,
        }),
        step({
          weekNumber: 1,
          sessionNumber: 1,
          role: "secondary",
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: "muscle_snatch",
          sets: 5,
          reps: 3,
          intensityMethod: "percentage_1rm",
          intensityMin: 55,
          intensityMax: 65,
          restSeconds: 90,
          technicalIntent:
            "Keep the bar close and finish with a fast turnover.",
          progressionObjective:
            "Establish snatch bar path and turnover quality.",
          estimatedDurationMinutes: 10,
        }),
        step({
          weekNumber: 1,
          sessionNumber: 2,
          role: "primary",
          trackType: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          movementId: "clean_and_jerk",
          sets: 5,
          reps: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 60,
          intensityMax: 70,
          restSeconds: 120,
          technicalIntent:
            "Use consistent footwork and finish every jerk in balance.",
          progressionObjective: "Establish repeatable clean-and-jerk doubles.",
          estimatedDurationMinutes: 18,
        }),
        step({
          weekNumber: 1,
          sessionNumber: 2,
          role: "secondary",
          trackType: "strict_pull",
          movementFamilyId: "strict_pull",
          movementId: "strict_pull_up",
          sets: 4,
          reps: null,
          repRangeMin: 5,
          repRangeMax: 8,
          intensityMethod: "bodyweight",
          intensityMin: null,
          intensityMax: null,
          restSeconds: 75,
          technicalIntent:
            "Maintain hollow-body tension and finish without kipping.",
          progressionObjective:
            "Build strict pulling volume with repeatable shapes.",
          stoppingRule: GYMNASTICS_STOP,
          estimatedDurationMinutes: 10,
        }),
      ],
    },
    {
      weekNumber: 2,
      theme: "Slight volume increase",
      day1ConditioningMinutes: 9,
      day2ConditioningMinutes: 13,
      steps: [
        step({
          weekNumber: 2,
          sessionNumber: 1,
          role: "primary",
          trackType: "front_squat",
          movementFamilyId: "front_squat",
          movementId: "front_squat",
          sets: 6,
          reps: 4,
          intensityMethod: "percentage_1rm",
          intensityMin: 75,
          intensityMax: 77,
          restSeconds: 120,
          technicalIntent: "Preserve bar speed while adding one working set.",
          progressionObjective:
            "Increase front-squat volume without technical loss.",
          estimatedDurationMinutes: 20,
        }),
        step({
          weekNumber: 2,
          sessionNumber: 1,
          role: "secondary",
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: "hang_power_snatch",
          sets: 6,
          reps: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 60,
          intensityMax: 70,
          restSeconds: 90,
          technicalIntent: "Finish extension before pulling under the bar.",
          progressionObjective:
            "Transfer bar-path work to a power receiving position.",
          estimatedDurationMinutes: 10,
        }),
        step({
          weekNumber: 2,
          sessionNumber: 2,
          role: "primary",
          trackType: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          movementId: "hang_clean_and_jerk",
          sets: 5,
          reps: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 65,
          intensityMax: 72,
          restSeconds: 120,
          technicalIntent:
            "Drive vertically from the hang and recover every jerk under control.",
          progressionObjective:
            "Develop hang-clean power and jerk consistency.",
          estimatedDurationMinutes: 18,
        }),
        step({
          weekNumber: 2,
          sessionNumber: 2,
          role: "secondary",
          trackType: "strict_pull",
          movementFamilyId: "strict_pull",
          movementId: "strict_pull_up",
          sets: 4,
          reps: null,
          repRangeMin: 6,
          repRangeMax: 8,
          intensityMethod: "bodyweight",
          intensityMin: null,
          intensityMax: null,
          restSeconds: 75,
          technicalIntent:
            "Accumulate clean strict reps without losing scapular control.",
          progressionObjective:
            "Add one strict rep per set where quality permits.",
          stoppingRule: GYMNASTICS_STOP,
          estimatedDurationMinutes: 9,
        }),
      ],
    },
    {
      weekNumber: 3,
      theme: "Moderate intensity increase",
      day1ConditioningMinutes: 11,
      day2ConditioningMinutes: 14,
      steps: [
        step({
          weekNumber: 3,
          sessionNumber: 1,
          role: "primary",
          trackType: "front_squat",
          movementFamilyId: "front_squat",
          movementId: "front_squat",
          sets: 5,
          reps: 4,
          intensityMethod: "percentage_1rm",
          intensityMin: 78,
          intensityMax: 80,
          restSeconds: 135,
          technicalIntent:
            "Brace before every descent and keep the elbows high.",
          progressionObjective:
            "Increase intensity while retaining useful volume.",
          estimatedDurationMinutes: 20,
        }),
        step({
          weekNumber: 3,
          sessionNumber: 1,
          role: "secondary",
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: "hang_squat_snatch",
          sets: 5,
          reps: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 65,
          intensityMax: 75,
          restSeconds: 105,
          technicalIntent:
            "Meet the bar actively and stabilize before standing.",
          progressionObjective:
            "Progress from power receiving to a full squat position.",
          estimatedDurationMinutes: 11,
        }),
        step({
          weekNumber: 3,
          sessionNumber: 2,
          role: "primary",
          trackType: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          movementId: "clean_and_jerk",
          sets: 6,
          reps: null,
          repRangeMin: 1,
          repRangeMax: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 70,
          intensityMax: 78,
          restSeconds: 135,
          technicalIntent:
            "Choose doubles only while both lifts remain technically repeatable.",
          progressionObjective:
            "Increase clean-and-jerk intensity without misses.",
          estimatedDurationMinutes: 18,
        }),
        step({
          weekNumber: 3,
          sessionNumber: 2,
          role: "secondary",
          trackType: "gymnastics_skill",
          movementFamilyId: "strict_pull",
          movementId: "strict_pull_up",
          sets: 4,
          reps: null,
          repRangeMin: 6,
          repRangeMax: 9,
          intensityMethod: "bodyweight",
          intensityMin: null,
          intensityMax: null,
          restSeconds: 75,
          technicalIntent:
            "Keep every rep strict and pair pulling with controlled midline work.",
          progressionObjective:
            "Build gymnastics capacity without failed reps.",
          stoppingRule: GYMNASTICS_STOP,
          estimatedDurationMinutes: 10,
        }),
      ],
    },
    {
      weekNumber: 4,
      theme: "Highest useful training volume",
      day1ConditioningMinutes: 9,
      day2ConditioningMinutes: 12,
      steps: [
        step({
          weekNumber: 4,
          sessionNumber: 1,
          role: "primary",
          trackType: "front_squat",
          movementFamilyId: "front_squat",
          movementId: "front_squat",
          sets: 5,
          reps: 3,
          intensityMethod: "percentage_1rm",
          intensityMin: 82,
          intensityMax: 85,
          restSeconds: 150,
          technicalIntent:
            "Complete crisp triples without grinding the final repetition.",
          progressionObjective:
            "Reach the highest useful front-squat loading week.",
          estimatedDurationMinutes: 20,
        }),
        step({
          weekNumber: 4,
          sessionNumber: 1,
          role: "secondary",
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: "squat_snatch",
          sets: 6,
          reps: null,
          repRangeMin: 1,
          repRangeMax: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 70,
          intensityMax: 80,
          restSeconds: 105,
          technicalIntent:
            "Use singles when doubles would reduce positional quality.",
          progressionObjective:
            "Express full-lift technique at moderate intensity.",
          estimatedDurationMinutes: 11,
        }),
        step({
          weekNumber: 4,
          sessionNumber: 2,
          role: "primary",
          trackType: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          movementId: "clean_and_jerk",
          sets: 6,
          reps: 1,
          intensityMethod: "percentage_1rm",
          intensityMin: 75,
          intensityMax: 82,
          restSeconds: 150,
          technicalIntent:
            "Treat every single as a technically complete competition lift.",
          progressionObjective: "Build moderate clean-and-jerk singles.",
          estimatedDurationMinutes: 18,
        }),
        step({
          weekNumber: 4,
          sessionNumber: 2,
          role: "secondary",
          trackType: "gymnastics_skill",
          movementFamilyId: "strict_pull",
          movementId: "strict_pull_up",
          sets: 5,
          reps: null,
          repRangeMin: 5,
          repRangeMax: 8,
          intensityMethod: "bodyweight",
          intensityMin: null,
          intensityMax: null,
          restSeconds: 75,
          technicalIntent:
            "Keep the same strict standard while adding one set.",
          progressionObjective:
            "Reach the highest useful strict-pulling volume.",
          stoppingRule: GYMNASTICS_STOP,
          estimatedDurationMinutes: 10,
        }),
      ],
    },
    {
      weekNumber: 5,
      theme: "Higher intensity and lower repetitions",
      day1ConditioningMinutes: 9,
      day2ConditioningMinutes: 14,
      steps: [
        step({
          weekNumber: 5,
          sessionNumber: 1,
          role: "primary",
          trackType: "front_squat",
          movementFamilyId: "front_squat",
          movementId: "front_squat",
          sets: 4,
          reps: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 87,
          intensityMax: 90,
          restSeconds: 180,
          technicalIntent: "Use strong doubles without technical grinding.",
          progressionObjective: "Express front-squat strength at lower volume.",
          estimatedDurationMinutes: 19,
        }),
        step({
          weekNumber: 5,
          sessionNumber: 1,
          role: "secondary",
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: "snatch",
          sets: 6,
          reps: 1,
          intensityMethod: "percentage_1rm",
          intensityMin: 78,
          intensityMax: 85,
          restSeconds: 120,
          technicalIntent:
            "Make controlled singles with no more than one technical miss.",
          progressionObjective:
            "Perform moderate-heavy technical snatch singles.",
          stoppingRule:
            "Stop after one technical miss or any loss of receiving stability.",
          estimatedDurationMinutes: 11,
        }),
        step({
          weekNumber: 5,
          sessionNumber: 2,
          role: "primary",
          trackType: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          movementId: "clean_and_jerk",
          sets: 6,
          reps: 1,
          intensityMethod: "percentage_1rm",
          intensityMin: 80,
          intensityMax: 87,
          restSeconds: 150,
          technicalIntent:
            "Prioritize jerk position over load and stop before a second miss.",
          progressionObjective:
            "Perform moderate-heavy clean-and-jerk singles.",
          stoppingRule:
            "Stop after one technical miss or if the jerk catch becomes unstable.",
          estimatedDurationMinutes: 18,
        }),
        step({
          weekNumber: 5,
          sessionNumber: 2,
          role: "secondary",
          trackType: "gymnastics_skill",
          movementFamilyId: "strict_pull",
          movementId: "strict_pull_up",
          sets: 3,
          reps: null,
          repRangeMin: 6,
          repRangeMax: 10,
          intensityMethod: "bodyweight",
          intensityMin: null,
          intensityMax: null,
          restSeconds: 90,
          technicalIntent:
            "Use a controlled capacity check with no failed repetitions.",
          progressionObjective:
            "Check strict-pull capacity while preserving movement quality.",
          stoppingRule: GYMNASTICS_STOP,
          estimatedDurationMinutes: 9,
        }),
      ],
    },
    {
      weekNumber: 6,
      theme: "Deload and controlled technical practice",
      day1ConditioningMinutes: 10,
      day2ConditioningMinutes: 15,
      steps: [
        step({
          weekNumber: 6,
          sessionNumber: 1,
          role: "primary",
          trackType: "front_squat",
          movementFamilyId: "front_squat",
          movementId: "front_squat",
          sets: 3,
          reps: 3,
          intensityMethod: "percentage_1rm",
          intensityMin: 60,
          intensityMax: 70,
          restSeconds: 120,
          technicalIntent:
            "Move every repetition quickly and finish fresher than you started.",
          progressionObjective:
            "Reduce squat fatigue while preserving movement quality.",
          estimatedDurationMinutes: 14,
        }),
        step({
          weekNumber: 6,
          sessionNumber: 1,
          role: "secondary",
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: "muscle_snatch",
          sets: 5,
          reps: 2,
          intensityMethod: "percentage_1rm",
          intensityMin: 50,
          intensityMax: 65,
          restSeconds: 75,
          technicalIntent:
            "Use a light bar and reinforce a close, vertical path.",
          progressionObjective: "Deload the snatch while retaining timing.",
          estimatedDurationMinutes: 9,
        }),
        step({
          weekNumber: 6,
          sessionNumber: 2,
          role: "primary",
          trackType: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          movementId: "clean_and_jerk",
          sets: 5,
          reps: 1,
          intensityMethod: "percentage_1rm",
          intensityMin: 55,
          intensityMax: 70,
          restSeconds: 105,
          technicalIntent:
            "Move with competition-quality positions at deliberately light load.",
          progressionObjective:
            "Deload clean-and-jerk fatigue while retaining coordination.",
          estimatedDurationMinutes: 14,
        }),
        step({
          weekNumber: 6,
          sessionNumber: 2,
          role: "secondary",
          trackType: "gymnastics_skill",
          movementFamilyId: "strict_pull",
          movementId: "strict_pull_up",
          sets: 3,
          reps: null,
          repRangeMin: 4,
          repRangeMax: 6,
          intensityMethod: "bodyweight",
          intensityMin: null,
          intensityMax: null,
          restSeconds: 75,
          technicalIntent:
            "Perform easy strict reps with perfect body position.",
          progressionObjective:
            "Reduce gymnastics volume and consolidate technique.",
          stoppingRule: GYMNASTICS_STOP,
          estimatedDurationMinutes: 7,
        }),
      ],
    },
  ]);

export const TRACK_ORDER: ReadonlyArray<ProgressionTrackType> = Object.freeze([
  "front_squat",
  "snatch",
  "clean_and_jerk",
  "strict_pull",
  "gymnastics_skill",
]);

export function templateStepFor(
  weekNumber: number,
  sessionNumber: number,
  trackType: ProgressionTrackType,
): TemplateProgressionStep | null {
  const week = MIXED_STRENGTH_TEMPLATE.find(
    (item) => item.weekNumber === weekNumber,
  );
  return (
    week?.steps.find(
      (item) =>
        item.sessionNumber === sessionNumber && item.trackType === trackType,
    ) ?? null
  );
}
