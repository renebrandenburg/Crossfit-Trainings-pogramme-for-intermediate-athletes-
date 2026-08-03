export const ENGINE_VERSION = "v2" as const;
export const PROGRAMMING_ENGINE_V2_FEATURE_FLAG =
  "crossfit_programming_engine_v2" as const;
export const PROGRAM_SCHEMA_VERSION = 2 as const;
export const TEMPLATE_VERSION = "mixed-strength-6w-v1" as const;
export const CATALOG_VERSION = 1 as const;
export const VALIDATOR_VERSION = 1 as const;

export type ProgrammingEngineVersion = "v1" | "v2";

export type ProgrammingEngine = ProgrammingEngineVersion;

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type V2ProgrammingGoal =
  | "strength"
  | "endurance"
  | "gymnastics"
  | "bar_muscle_up"
  | "masters_open"
  | "mixed";

export interface V2GenerationPreferences {
  preferredDays: Weekday[];
  frequency: 2 | 3 | 4;
  goal: V2ProgrammingGoal;
  blockType: TrainingBlockType;
  athleteLevel: "beginner" | "intermediate" | "advanced";
  availableEquipment: string[];
  weightIncrementKg: 1 | 2 | 2.5 | 5;
  roundingMode: "nearest" | "down" | "up";
  templateId?: string;
}

export type TrainingStimulus =
  | "squat"
  | "hinge"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "olympic_lifting"
  | "gymnastics"
  | "short_conditioning"
  | "medium_conditioning"
  | "long_conditioning"
  | "aerobic"
  | "sprint";

export interface V2CalendarSession {
  id: string;
  engineVersion: "v2";
  week: number;
  weekNumber: number;
  sessionNumber: number;
  preferredDay: Weekday;
  weekday: string;
  title: string;
  shortTitle: string;
  focus: string;
  duration: number;
  status: TrainingSession["status"];
  movementPatterns: TrainingStimulus[];
  v2Session: TrainingSession;
}

export type TrainingBlockType =
  | "mixed_strength"
  | "front_squat_accumulation"
  | "back_squat_strength"
  | "olympic_lifting_development"
  | "snatch_development"
  | "clean_and_jerk_development"
  | "gymnastics_capacity"
  | "aerobic_capacity"
  | "competition_preparation"
  | "deload";

export type MaxTestType =
  "true_1rm" | "technical_1rm" | "estimated_1rm" | "rep_max" | "heavy_single";

export type TrainingSessionType =
  "normal" | "deload" | "max_test" | "benchmark" | "recovery";

export type MaxAttemptType =
  | "opener"
  | "second_attempt"
  | "personal_record_attempt"
  | "optional_final_attempt";

export type MaxAttemptResultStatus = "success" | "failure" | "skipped";

export type TechnicalQuality = "good" | "acceptable" | "poor" | "invalid";

export interface TechnicalStandard {
  movementId: string;
  criteria: string[];
  invalidationCriteria: string[];
}

export interface MaxTestWarmupSet {
  percentage: number | null;
  loadKg: number | null;
  reps: number;
  restSeconds: number;
  purpose: string;
}

export interface PlannedMaxAttempt {
  attemptNumber: number;
  attemptType: MaxAttemptType;
  percentageOfPreviousMax: number | null;
  suggestedLoadKg: number | null;
  restSeconds: number;
  optional: boolean;
}

export interface MaxAttemptResult {
  attemptNumber: number;
  loadKg: number;
  result: MaxAttemptResultStatus;
  perceivedRpe: number | null;
  technicalQuality: TechnicalQuality | null;
  painReported: boolean;
  notes: string | null;
}

export interface MaxTestEligibility {
  movementId: string;
  eligible: boolean;
  reasons: string[];
  completedPrerequisiteSessions: number;
  requiredPrerequisiteSessions: number;
  recentPainReported: boolean;
  recentFailureCount: number;
  recentHeavySingleCompleted: boolean;
  daysSinceLastTest: number | null;
  readinessScore: number;
}

export interface MaxUpdate {
  accepted: boolean;
  maxKg: number | null;
  trainingMaxKg: number | null;
  recordType: MaxTestType | null;
  confirmedAt: string | null;
}

export interface MaxTestPrescription {
  id: string;
  sessionId: string;
  movementId: string;
  movementName: string;
  athleteLevel: "beginner" | "intermediate" | "advanced";
  testType: MaxTestType;
  previousMaxKg: number | null;
  trainingMaxKg: number | null;
  estimatedCurrentMaxKg: number | null;
  fallbackTestType: MaxTestType;
  fallbackPrescription: string;
  eligibility: MaxTestEligibility;
  warmupSets: MaxTestWarmupSet[];
  plannedAttempts: PlannedMaxAttempt[];
  attemptResults: MaxAttemptResult[];
  minimumRestSeconds: number;
  maximumAttempts: number;
  technicalStandards: TechnicalStandard | null;
  stoppingRules: string[];
  estimatedDurationMinutes: number;
  maxUpdate: MaxUpdate | null;
}

export interface MaxAttemptInput {
  program: ProgramV2;
  sessionId: string;
  result: MaxAttemptResult;
}

export interface MaxUpdateInput {
  program: ProgramV2;
  sessionId: string;
  confirmedAt: string;
  trainingMaxPercentage?: number;
}

export interface EstimatedOneRepMaxResult {
  movementId: string;
  loadKg: number;
  reps: number;
  achievedRpe: number | null;
  formula: "epley" | "brzycki";
  estimatedOneRepMaxKg: number;
}

export interface AthleteMovementMax {
  athleteId: string | null;
  movementId: string;
  testedOneRepMaxKg: number | null;
  technicalOneRepMaxKg: number | null;
  estimatedOneRepMaxKg: number | null;
  trainingMaxKg: number | null;
  source:
    "true_1rm_test" | "technical_1rm_test" | "estimated_1rm" | "manual_entry";
  testedAt: string | null;
  updatedAt: string;
}

export interface PersonalRecord {
  id: string;
  athleteId: string | null;
  movementId: string;
  recordType: "true_1rm" | "technical_1rm" | "estimated_1rm" | "3rm" | "5rm";
  loadKg: number;
  achievedAt: string;
  sessionId: string | null;
  previousRecordKg: number | null;
}

export type ProgressionTrackType =
  | "front_squat"
  | "back_squat"
  | "snatch"
  | "clean_and_jerk"
  | "upper_body_press"
  | "strict_pull"
  | "gymnastics_skill"
  | "engine";

export type MovementFamilyId =
  | "front_squat"
  | "back_squat"
  | "hinge"
  | "horizontal_press"
  | "vertical_press"
  | "strict_pull"
  | "kipping_pull"
  | "toes_to_bar"
  | "bar_muscle_up"
  | "ring_muscle_up"
  | "handstand"
  | "snatch"
  | "clean"
  | "jerk"
  | "clean_and_jerk"
  | "running"
  | "rowing"
  | "bike"
  | "ski"
  | "carry"
  | "core"
  | "jumping"
  | "burpee"
  | "accessory";

export type MovementCategory =
  "strength" | "olympic_lifting" | "gymnastics" | "conditioning" | "accessory";

export type MovementContext =
  | "warmup"
  | "primary"
  | "secondary"
  | "skill"
  | "conditioning"
  | "accessory"
  | "cooldown";

export type IntensityMethod =
  | "percentage_1rm"
  | "percentage_training_max"
  | "rpe"
  | "rir"
  | "fixed_load"
  | "bodyweight"
  | "quality"
  | "none";

export type ExerciseSection = MovementContext;

export type ConditioningFormat =
  "for_time" | "amrap" | "emom" | "intervals" | "rounds_for_quality" | "zone_2";

export type EmomExecutionMode = "rotate" | "all-every-minute";

export type DurationValidationStatus =
  "within_target" | "warning_short" | "warning_long" | "invalid_too_long";

export type FatigueFocus =
  "lower_body" | "upper_body" | "grip" | "mixed" | "recovery";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Movement {
  id: string;
  name: string;
  familyId: MovementFamilyId;
  category: MovementCategory;
  difficulty: "beginner" | "intermediate" | "advanced";
  purposes: string[];
  prerequisites: string[];
  allowedContexts: MovementContext[];
  unilateral: boolean;
  loadable: boolean;
  requiresPercentageReference: boolean;
  equipment: string[];
  secondsPerRep: number;
  isTechniqueDrill?: boolean;
  isIsometric?: boolean;
}

export interface ScalingOption {
  level: "rx" | "intermediate" | "scaled";
  movementId: string | null;
  movementName: string;
  prescriptionAdjustment: string;
  measurableTarget: string;
}

export interface ExercisePrescription {
  id: string;
  sessionId: string;
  progressionTrackId: string | null;
  progressionStepNumber: number | null;
  groupId: string | null;
  section: ExerciseSection;
  movementId: string;
  movementName: string;
  movementFamilyId: MovementFamilyId;
  sets: number | null;
  reps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  calories: number | null;
  intensityMethod: IntensityMethod;
  intensityValue: number | null;
  intensityMax: number | null;
  loadKg: number | null;
  referenceMaxKg: number | null;
  referenceLift: string | null;
  restSeconds: number | null;
  tempo: string | null;
  pauseDescription: string | null;
  technicalIntent: string;
  progressionObjective: string | null;
  stoppingRule: string | null;
  coachingCues: string[];
  scalingOptions: ScalingOption[];
  equipment: string[];
  warmupSetCount: number;
  setupMinutes: number;
  estimatedDurationMinutes: number;
}

export interface ConditioningMovement {
  movementId: string;
  movementName: string;
  movementFamilyId: MovementFamilyId;
  reps: number | null;
  calories: number | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  loadKg: number | null;
  percentageReference: number | null;
  equipment: string[];
}

export interface ConditioningEmomStation {
  minute: number;
  movement: ConditioningMovement;
}

export interface ConditioningPrescription {
  id: string;
  sessionId: string;
  format: ConditioningFormat;
  durationMinutes: number | null;
  rounds: number | null;
  timeCapMinutes: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intendedStimulus: string;
  targetDurationMin: number | null;
  targetDurationMax: number | null;
  targetRpe: number | null;
  movements: ConditioningMovement[];
  intervalSeconds: number | null;
  executionMode: EmomExecutionMode | null;
  stations: ConditioningEmomStation[];
  scalingOptions: ScalingOption[];
  estimatedDurationMinutes: number;
}

export interface WarmupExercise {
  movementId: string;
  movementName: string;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  equipment: string[];
}

export interface WarmupPrescription {
  id: string;
  sessionId: string;
  durationMinutes: number;
  rounds: number | null;
  exercises: WarmupExercise[];
  purpose: string;
}

export interface EquipmentTransition {
  fromEquipment: string[];
  toEquipment: string[];
  estimatedMinutes: number;
}

export interface SessionSection {
  id: string;
  sessionId: string;
  section:
    | "warmup"
    | "primary"
    | "secondary"
    | "conditioning"
    | "accessory"
    | "cooldown"
    | "transition";
  order: number;
  estimatedDurationMinutes: number;
}

export interface SessionStress {
  lowerBodyVolumeScore: number;
  upperBodyVolumeScore: number;
  gripVolumeScore: number;
  skillComplexityScore: number;
  conditioningStressScore: number;
  totalStressScore: number;
}

export interface TrackAssignment {
  progressionTrackId: string;
  progressionStepNumber: number;
  role: "primary" | "secondary";
}

export interface ActualExerciseResult {
  prescriptionId: string;
  progressionTrackId: string;
  completedSets: number;
  completedReps: number;
  loadKg: number | null;
  achievedRpe: number | null;
  successful: boolean;
  painReported: boolean;
}

export interface SessionFeedback {
  sessionId: string;
  completed: boolean;
  sessionRpe: number | null;
  fatigue: number | null;
  painReported: boolean;
  durationMinutesActual: number | null;
  notes: string | null;
  results: ActualExerciseResult[];
  completedAt: string;
}

export interface TrainingSession {
  id: string;
  trainingWeekId: string;
  sessionNumber: number;
  sessionType: TrainingSessionType;
  weekNumber: number;
  objective: string;
  intendedStimulus: string;
  expectedFatigue: "low" | "moderate" | "high";
  fatigueFocus: FatigueFocus;
  communityWorkoutAdvice: string;
  durationTargetMinutes: number;
  estimatedDurationMinutes: number;
  durationValidationStatus: DurationValidationStatus;
  provisional: boolean;
  status: "planned" | "completed" | "skipped" | "blocked";
  revision: number;
  trackAssignments: TrackAssignment[];
  warmup: WarmupPrescription;
  exercises: ExercisePrescription[];
  conditioning: ConditioningPrescription | null;
  equipmentTransitions: EquipmentTransition[];
  sections: SessionSection[];
  stress: SessionStress;
  feedback: SessionFeedback | null;
  maxTestPrescription: MaxTestPrescription | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingWeek {
  id: string;
  trainingBlockId: string;
  weekNumber: number;
  theme: string;
  status: "planned" | "active" | "completed";
  plannedSessionCount?: 2 | 3 | 4;
  sessions: TrainingSession[];
}

export interface ProgressionStep {
  id: string;
  progressionTrackId: string;
  stepNumber: number;
  weekNumber: number;
  movementId: string | null;
  movementFamilyId: MovementFamilyId;
  sets: number | null;
  reps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  intensityMethod: IntensityMethod;
  intensityMin: number | null;
  intensityMax: number | null;
  restSeconds: number | null;
  tempo: string | null;
  pauseDescription: string | null;
  technicalIntent: string;
  estimatedDurationMinutes: number;
}

export interface ProgressionTrack {
  id: string;
  trainingBlockId: string;
  trackType: ProgressionTrackType;
  movementFamilyId: MovementFamilyId;
  currentStep: number;
  totalSteps: number;
  status: "active" | "completed" | "paused";
  consecutiveFailures: number;
  metadata: Record<string, JsonValue>;
  steps: ProgressionStep[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainingBlock {
  id: string;
  programId: string;
  blockType: TrainingBlockType;
  name: string;
  goal: string;
  durationWeeks: number;
  currentWeek: number;
  status: "planned" | "active" | "completed";
  deloadWeek: number | null;
  startedAt: string | null;
  completedAt: string | null;
  endsWithTest: boolean;
  plannedTestMovementIds: string[];
  testWeekNumber: number | null;
  testStrategy:
    "none" | "true_1rm" | "technical_1rm" | "rep_max" | "estimated_1rm";
  progressionTracks: ProgressionTrack[];
  trainingWeeks: TrainingWeek[];
  createdAt: string;
  updatedAt: string;
  templateId?: string;
  plannedSessionCount?: 2 | 3 | 4;
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  validatorVersion: number;
  issues: ValidationIssue[];
}

export interface ProgramV2 {
  schemaVersion: typeof PROGRAM_SCHEMA_VERSION;
  engineVersion: typeof ENGINE_VERSION;
  templateVersion: typeof TEMPLATE_VERSION;
  catalogVersion: typeof CATALOG_VERSION;
  validatorVersion: typeof VALIDATOR_VERSION;
  id: string;
  ownerId: string | null;
  name: string;
  status: "planned" | "active" | "completed";
  activeTrainingBlockId: string;
  trainingBlocks: TrainingBlock[];
  movementMaxes: AthleteMovementMax[];
  personalRecords: PersonalRecord[];
  validation: ValidationResult;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteMaxes {
  front_squat?: number | null;
  back_squat?: number | null;
  snatch?: number | null;
  clean_and_jerk?: number | null;
  strict_press?: number | null;
}

export interface MovementRestrictions {
  movementIds: string[];
  movementFamilyIds: MovementFamilyId[];
  guidance: string | null;
}

export interface GenerateProgramInput {
  programId: string;
  ownerId: string | null;
  generatedAt: string;
  blockType?: TrainingBlockType;
  seed?: string;
  athleteLevel: "beginner" | "intermediate" | "advanced";
  maxes: AthleteMaxes;
  equipment: string[];
  restrictions: MovementRestrictions;
  weightIncrementKg: 1 | 2 | 2.5 | 5;
  roundingMode: "nearest" | "down" | "up";
  goal?: V2ProgrammingGoal;
  sessionCount?: 2 | 3 | 4;
  templateId?: string;
  allowBeginnerTrue1Rm?: boolean;
  movementMaxes?: AthleteMovementMax[];
}

export interface DurationEstimateInput {
  exercises: ExercisePrescription[];
  conditioning: ConditioningPrescription | null;
  equipmentTransitions: EquipmentTransition[];
  warmupMinutes: number;
  cooldownMinutes: number;
}

export interface DurationEstimate {
  totalMinutes: number;
  warmupMinutes: number;
  workMinutes: number;
  restMinutes: number;
  conditioningMinutes: number;
  transitionMinutes: number;
  cooldownMinutes: number;
}

export interface WeightCalculationInput {
  maxKg: number;
  percentage: number;
  incrementKg: 1 | 2 | 2.5 | 5;
  roundingMode: "nearest" | "down" | "up";
}

export type RegenerationScope =
  "conditioning" | "accessory" | "warmup" | "full_session";

export interface RegenerationInput {
  program: ProgramV2;
  sessionId: string;
  scope: RegenerationScope;
  seed: string;
}

export interface RegenerationResult {
  program: ProgramV2;
  validation: ValidationResult;
  changedSectionIds: string[];
}

export interface CompletionInput {
  program: ProgramV2;
  sessionId: string;
  expectedRevision: number;
  feedback: SessionFeedback;
}

export interface CompletionResult {
  program: ProgramV2;
  validation: ValidationResult;
  advancedTrackIds: string[];
  pausedTrackIds: string[];
  repeatedTrackIds: string[];
}

export interface RenderExercise {
  id: string;
  title: string;
  prescription: string;
  load: string;
  referenceMax: string | null;
  workingWeight: string | null;
  rest: string;
  intent: string;
  coachingCues: string[];
  scaling: string[];
  estimatedTime: string;
}

export interface RenderSection {
  id: string;
  title: string;
  estimatedTime: string;
  exercises: RenderExercise[];
  lines: string[];
}

export interface RenderSession {
  id: string;
  weekNumber: number;
  sessionNumber: number;
  heading: string;
  objective: string;
  estimatedTime: string;
  fatigue: string;
  provisional: boolean;
  communityWorkoutAdvice: string;
  sections: RenderSection[];
}

export interface ProgrammingFeatureFlag {
  enabled: boolean;
  source: "supabase" | "local_development" | "disabled";
}

export interface AiSectionRequest {
  sessionId: string;
  scope: "warmup" | "conditioning" | "coaching_cues" | "scaling";
  constraints: Record<string, JsonValue>;
}

export interface GenerationAdapter {
  readonly id: string;
  generate(request: AiSectionRequest): Promise<JsonValue>;
}
