import type {
  IntensityMethod,
  MovementFamilyId,
  ProgressionTrackType,
  TrainingBlockType,
} from "./types";

export type V2TemplateId =
  | "mixed_strength_6w"
  | "mixed_strength_8w_testing"
  | "endurance_capacity_6w"
  | "gymnastics_capacity_6w"
  | "bar_muscle_up_6w"
  | "masters_open_6w"
  | "masters_open_preparation_six_week"
  | "olympic_lifting_6w"
  | "general_crossfit_6w"
  | "deload_1w";

export interface V2TemplateDefinition {
  id: V2TemplateId;
  blockType: TrainingBlockType;
  name: string;
  goal: string;
  supportedFrequencies: ReadonlyArray<2 | 3 | 4>;
  durationWeeks: number;
  deloadWeek: number | null;
}

export const V2_TEMPLATE_REGISTRY: ReadonlyArray<V2TemplateDefinition> =
  Object.freeze([
    {
      id: "mixed_strength_6w",
      blockType: "mixed_strength",
      name: "Six-week mixed-strength block",
      goal: "Progress squat strength, Olympic lifting, gymnastics, and engine work.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "mixed_strength_8w_testing",
      blockType: "mixed_strength",
      name: "Eight-week strength testing block",
      goal: "Build strength and technical consistency before a planned max assessment week.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 8,
      deloadWeek: 7,
    },
    {
      id: "endurance_capacity_6w",
      blockType: "aerobic_capacity",
      name: "Six-week aerobic-capacity block",
      goal: "Build repeatable aerobic work while preserving strength quality.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "gymnastics_capacity_6w",
      blockType: "gymnastics_capacity",
      name: "Six-week gymnastics-capacity block",
      goal: "Build measurable strict pulling, midline, and gymnastics capacity.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "bar_muscle_up_6w",
      blockType: "gymnastics_capacity",
      name: "Six-week bar-muscle-up block",
      goal: "Progress strict pulling, transition strength, and bar-muscle-up skill.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "masters_open_6w",
      blockType: "competition_preparation",
      name: "Six-week Masters/Open preparation block",
      goal: "Build durable strength, engine, and competition-specific capacity.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "masters_open_preparation_six_week",
      blockType: "masters_open_preparation",
      name: "Six-week Masters/Open preparation block",
      goal: "Prepare pacing, gymnastics standards, barbell cycling, transitions, and repeatable Open-style efforts.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "olympic_lifting_6w",
      blockType: "olympic_lifting_development",
      name: "Six-week Olympic-lifting development block",
      goal: "Build snatch and clean-and-jerk consistency with specific positional strength.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "general_crossfit_6w",
      blockType: "mixed_strength",
      name: "Six-week general CrossFit progression",
      goal: "Build balanced strength, skill, and repeatable mixed-modal capacity.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
    {
      id: "deload_1w",
      blockType: "deload",
      name: "One-week deload block",
      goal: "Reduce training stress while preserving movement quality.",
      supportedFrequencies: [2, 3, 4],
      durationWeeks: 6,
      deloadWeek: 6,
    },
  ]);

export function getV2TemplateDefinition(
  id: string | null | undefined,
  options: { allowDefault?: boolean } = {},
): V2TemplateDefinition {
  const match = V2_TEMPLATE_REGISTRY.find((template) => template.id === id);
  if (match) return match;
  if (options.allowDefault && (id == null || id === "")) {
    return V2_TEMPLATE_REGISTRY[0]!;
  }
  throw new Error(`UNSUPPORTED_TEMPLATE:${String(id)}`);
}

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

export const TESTING_STRENGTH_TEMPLATE: ReadonlyArray<MixedStrengthWeekTemplate> =
  Object.freeze([
    ...MIXED_STRENGTH_TEMPLATE.slice(0, 6),
    ...[7, 8].map((weekNumber) => {
      const source = MIXED_STRENGTH_TEMPLATE[weekNumber === 7 ? 4 : 5]!;
      return {
        weekNumber,
        theme:
          weekNumber === 7
            ? "Taper and opener practice"
            : "Planned strength and technical testing",
        day1ConditioningMinutes: weekNumber === 7 ? 6 : 5,
        day2ConditioningMinutes: weekNumber === 7 ? 7 : 5,
        steps: source.steps.map((item) => ({
          ...item,
          weekNumber,
          sets: weekNumber === 7 ? Math.min(item.sets, 3) : item.sets,
          reps: weekNumber === 7 ? 1 : item.reps,
          intensityMin:
            weekNumber === 7
              ? Math.min(item.intensityMin ?? 80, 90)
              : item.intensityMin,
          intensityMax:
            weekNumber === 7
              ? Math.min(item.intensityMax ?? 90, 92)
              : item.intensityMax,
          estimatedDurationMinutes:
            weekNumber === 7
              ? Math.max(4, Math.round(item.estimatedDurationMinutes * 0.7))
              : item.estimatedDurationMinutes,
        })),
      };
    }),
  ]);

function cloneProgrammeTemplate(
  source: ReadonlyArray<MixedStrengthWeekTemplate>,
  transform: (step: TemplateProgressionStep) => TemplateProgressionStep,
  conditioning: (
    week: MixedStrengthWeekTemplate,
  ) => Partial<MixedStrengthWeekTemplate>,
): ReadonlyArray<MixedStrengthWeekTemplate> {
  return Object.freeze(
    source.map((week) => ({
      ...week,
      ...conditioning(week),
      steps: week.steps.map((item) => transform({ ...item })),
    })),
  );
}

export const PROGRAMME_TEMPLATES: Readonly<
  Record<string, ReadonlyArray<MixedStrengthWeekTemplate>>
> = Object.freeze({
  mixed_strength_6w: MIXED_STRENGTH_TEMPLATE,
  general_crossfit_6w: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) => ({
      ...item,
      progressionObjective: `General CrossFit progression: ${item.progressionObjective}`,
    }),
    (week) => ({
      day1ConditioningMinutes: week.day1ConditioningMinutes + 1,
      day2ConditioningMinutes: week.day2ConditioningMinutes + 1,
    }),
  ),
  masters_open_6w: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) =>
      item.trackType === "front_squat"
        ? {
            ...item,
            movementId: "back_squat",
            movementFamilyId: "back_squat",
            technicalIntent:
              "Build durable squat strength with controlled depth and recovery-aware volume.",
            progressionObjective:
              "Develop repeatable squat strength for Masters/Open demands.",
          }
        : item,
    (week) => ({
      theme: `Masters/Open: ${week.theme}`,
      day1ConditioningMinutes: Math.max(7, week.day1ConditioningMinutes - 2),
      day2ConditioningMinutes: Math.max(8, week.day2ConditioningMinutes - 2),
    }),
  ),
  masters_open_preparation_six_week: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) => {
      if (item.role === "primary") {
        return {
          ...item,
          trackType:
            item.sessionNumber === 1 ? "front_squat" : "clean_and_jerk",
          movementId:
            item.sessionNumber === 1 ? "front_squat" : "hang_clean_and_jerk",
          sets: Math.max(2, Math.min(3, item.sets - 1)),
          reps: item.weekNumber >= 4 ? 2 : item.reps,
          intensityMin:
            item.weekNumber >= 4 ? 65 : Math.min(80, item.intensityMin ?? 70),
          intensityMax:
            item.weekNumber >= 4 ? 75 : Math.min(85, item.intensityMax ?? 80),
          technicalIntent:
            "Maintain strength without grinding before competition work.",
          progressionObjective:
            "Maintain useful strength while prioritizing Open readiness.",
        };
      }
      return {
        ...item,
        trackType: "strict_pull",
        movementFamilyId: "strict_pull",
        movementId: "strict_pull_up",
        intensityMethod: "bodyweight",
        intensityMin: null,
        intensityMax: null,
        sets: Math.max(2, Math.min(3, item.sets)),
        reps: null,
        repRangeMin: 4,
        repRangeMax: 8,
        technicalIntent:
          "Preserve gymnastics standards under controlled fatigue.",
        progressionObjective:
          "Build repeatable pulling capacity for Open-style workouts.",
        stoppingRule: GYMNASTICS_STOP,
      };
    },
    (week) => ({
      theme:
        week.weekNumber === 4
          ? "Competition specificity and Open test"
          : week.weekNumber === 5
            ? "Peak simulation and repeatability"
            : week.weekNumber === 6
              ? "Taper and readiness"
              : `Open preparation: ${week.theme}`,
      day1ConditioningMinutes:
        week.weekNumber === 6 ? 8 : week.weekNumber >= 4 ? 14 : 12,
      day2ConditioningMinutes:
        week.weekNumber === 6 ? 8 : week.weekNumber >= 4 ? 10 : 12,
    }),
  ),
  olympic_lifting_6w: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) => {
      if (item.sessionNumber === 1 && item.role === "primary") {
        return {
          ...item,
          trackType: "snatch",
          movementFamilyId: "snatch",
          movementId: item.weekNumber >= 4 ? "snatch" : "hang_power_snatch",
          sets: Math.max(4, item.sets),
          reps: item.weekNumber >= 4 ? 1 : 2,
          technicalIntent:
            "Prioritize receiving position, bar proximity, and stable overhead control.",
          progressionObjective:
            "Develop the snatch through consistent positional singles.",
        };
      }
      if (item.sessionNumber === 1 && item.role === "secondary") {
        return {
          ...item,
          movementId: "snatch_pull",
          movementFamilyId: "snatch",
        };
      }
      if (item.sessionNumber === 2 && item.role === "primary") {
        return {
          ...item,
          movementId: "clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
          reps: item.weekNumber >= 4 ? 1 : 2,
        };
      }
      if (item.sessionNumber === 2 && item.role === "secondary") {
        return {
          ...item,
          movementId: "hang_clean_and_jerk",
          movementFamilyId: "clean_and_jerk",
        };
      }
      return item;
    },
    (week) => ({
      theme: `Olympic lifting: ${week.theme}`,
      day1ConditioningMinutes: Math.max(5, week.day1ConditioningMinutes - 3),
      day2ConditioningMinutes: Math.max(5, week.day2ConditioningMinutes - 3),
    }),
  ),
  endurance_capacity_6w: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) => ({
      ...item,
      sets: Math.max(2, item.sets - 1),
      progressionObjective: `Aerobic-support strength: ${item.progressionObjective}`,
    }),
    (week) => ({
      theme: `Engine-focused: ${week.theme}`,
      day1ConditioningMinutes: week.day1ConditioningMinutes + 6,
      day2ConditioningMinutes: week.day2ConditioningMinutes + 7,
    }),
  ),
  gymnastics_capacity_6w: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) =>
      item.sessionNumber === 1 && item.role === "secondary"
        ? {
            ...item,
            trackType: "strict_pull",
            movementFamilyId: "strict_pull",
            movementId: "strict_pull_up",
            intensityMethod: "bodyweight",
            intensityMin: null,
            intensityMax: null,
            technicalIntent:
              "Build strict pulling capacity without losing hollow-body control.",
            progressionObjective:
              "Progress strict gymnastics strength and repeatable pulling volume.",
            stoppingRule:
              "Stop the set when pulling speed or hollow-body position breaks down.",
          }
        : item,
    (week) => ({
      theme: `Gymnastics capacity: ${week.theme}`,
      day1ConditioningMinutes: Math.max(6, week.day1ConditioningMinutes - 1),
      day2ConditioningMinutes: week.day2ConditioningMinutes + 2,
    }),
  ),
  deload_1w: cloneProgrammeTemplate(
    MIXED_STRENGTH_TEMPLATE,
    (item) => ({
      ...item,
      sets: Math.max(2, Math.min(3, item.sets - 2)),
      intensityMin:
        item.intensityMin == null ? null : Math.max(45, item.intensityMin - 15),
      intensityMax:
        item.intensityMax == null ? null : Math.max(55, item.intensityMax - 15),
      progressionObjective:
        "Deload: preserve movement quality without accumulating fatigue.",
    }),
    () => ({
      theme: "Deload and movement quality",
      day1ConditioningMinutes: 6,
      day2ConditioningMinutes: 6,
    }),
  ),
});

export function getV2ProgrammeTemplate(
  id: string,
): ReadonlyArray<MixedStrengthWeekTemplate> {
  if (id === "mixed_strength_8w_testing") return TESTING_STRENGTH_TEMPLATE;
  const template = PROGRAMME_TEMPLATES[id];
  if (!template) throw new Error(`UNSUPPORTED_TEMPLATE:${id}`);
  return template;
}

export function getV2TemplateForBlockType(
  blockType: TrainingBlockType,
): V2TemplateDefinition {
  switch (blockType) {
    case "masters_open_preparation":
      return getV2TemplateDefinition("masters_open_preparation_six_week");
    case "competition_preparation":
      return getV2TemplateDefinition("masters_open_6w");
    case "mixed_strength":
      return getV2TemplateDefinition("mixed_strength_6w");
    case "aerobic_capacity":
      return getV2TemplateDefinition("endurance_capacity_6w");
    case "gymnastics_capacity":
      return getV2TemplateDefinition("gymnastics_capacity_6w");
    case "olympic_lifting_development":
      return getV2TemplateDefinition("olympic_lifting_6w");
    case "deload":
      return getV2TemplateDefinition("deload_1w");
    case "front_squat_accumulation":
    case "back_squat_strength":
    case "snatch_development":
    case "clean_and_jerk_development":
      throw new Error(`UNSUPPORTED_BLOCK_TYPE:${blockType}`);
  }
}

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
