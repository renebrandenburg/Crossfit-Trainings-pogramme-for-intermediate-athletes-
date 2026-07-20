"use strict";

const STORAGE_KEY = "forge-hour-state-v1";

const DEFAULT_PROFILE = {
  athleteName: "Intermediate athlete",
  age: 36,
  division: "men35to39",
  bodyweight: 85,
  maxes: {
    backSquat: 145,
    frontSquat: 125,
    deadlift: 180,
    strictPress: 60,
    thruster: 90,
    snatch: 75,
    cleanJerk: 100,
  },
  benchmarks: {
    row1k: "3:30",
    row2k: "7:30",
    run5k: "24:00",
    bike10MinCalories: 140,
    murph: "68:00",
    t2b: 8,
    pullUps: 10,
    chestToBar: 5,
    barMuscleUp: 0,
    ringMuscleUp: 0,
    strictHspu: 0,
    handstandWalk: 0,
    doubleUnders: 30,
  },
};

const WEEK_META = [
  {
    week: 1,
    title: "Week 1 - technical base",
    note: "Comfortably heavy. Keep reps crisp, preserve the intended stimulus, and learn your starting paces.",
  },
  {
    week: 2,
    title: "Week 2 - volume build",
    note: "Small overload through load, total reps, or meters. Add work only when positions stay clean.",
  },
  {
    week: 3,
    title: "Week 3 - intensity peak",
    note: "Heaviest week. Strength volume drops slightly while top percentages rise.",
  },
  {
    week: 4,
    title: "Week 4 - deload and control",
    note: "Lower fatigue, more skill quality, and a simple 1 km row check-in.",
  },
  {
    week: 5,
    title: "Week 5 - second build",
    note: "Start the second wave slightly heavier than week 2, but keep gymnastics submaximal.",
  },
  {
    week: 6,
    title: "Week 6 - strength emphasis",
    note: "Heavier doubles and sharper intervals. Scale the WOD before you let barbell positions degrade.",
  },
  {
    week: 7,
    title: "Week 7 - peak exposure",
    note: "Highest intensity week. Chase clean reps, controlled misses, and repeatable metcon pacing.",
  },
  {
    week: 8,
    title: "Week 8 - deload and tests",
    note: "Reduce volume, test selected benchmarks, and use the results to set the next cycle.",
  },
];

const PR_METRICS = [
  {
    id: "backSquat",
    name: "Back squat",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.backSquat",
  },
  {
    id: "frontSquat",
    name: "Front squat",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.frontSquat",
  },
  {
    id: "deadlift",
    name: "Deadlift",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.deadlift",
  },
  {
    id: "strictPress",
    name: "Strict press",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.strictPress",
  },
  {
    id: "thruster",
    name: "Thruster",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.thruster",
  },
  {
    id: "snatch",
    name: "Snatch",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.snatch",
  },
  {
    id: "cleanJerk",
    name: "Clean and jerk",
    unit: "kg",
    type: "number",
    direction: "higher",
    seed: "maxes.cleanJerk",
  },
  {
    id: "row1k",
    name: "1 km row",
    unit: "time",
    type: "time",
    direction: "lower",
    seed: "benchmarks.row1k",
  },
  {
    id: "row2k",
    name: "2 km row",
    unit: "time",
    type: "time",
    direction: "lower",
    seed: "benchmarks.row2k",
  },
  {
    id: "run5k",
    name: "5 km run",
    unit: "time",
    type: "time",
    direction: "lower",
    seed: "benchmarks.run5k",
  },
  {
    id: "bike10MinCalories",
    name: "10 min bike calories",
    unit: "cal",
    type: "number",
    direction: "higher",
    seed: "benchmarks.bike10MinCalories",
  },
  {
    id: "murph",
    name: "Murph",
    unit: "time",
    type: "time",
    direction: "lower",
    seed: "benchmarks.murph",
  },
  {
    id: "t2b",
    name: "Unbroken toes-to-bar",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.t2b",
  },
  {
    id: "pullUps",
    name: "Unbroken pull-ups",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.pullUps",
  },
  {
    id: "chestToBar",
    name: "Unbroken chest-to-bar",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.chestToBar",
  },
  {
    id: "barMuscleUp",
    name: "Bar muscle-up",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.barMuscleUp",
  },
  {
    id: "ringMuscleUp",
    name: "Ring muscle-up",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.ringMuscleUp",
  },
  {
    id: "strictHspu",
    name: "Strict handstand push-up",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.strictHspu",
  },
  {
    id: "handstandWalk",
    name: "Handstand walk",
    unit: "m",
    type: "number",
    direction: "higher",
    seed: "benchmarks.handstandWalk",
  },
  {
    id: "doubleUnders",
    name: "Unbroken double-unders",
    unit: "reps",
    type: "number",
    direction: "higher",
    seed: "benchmarks.doubleUnders",
  },
];

const READINESS_LABELS = {
  green: "Green",
  amber: "Amber",
  red: "Red",
};

const GOAL_LABELS = {
  stronger: "Get stronger",
  endurance: "More endurance",
  gymnastics: "Better gymnastics",
  barMuscleUp: "Get my first bar muscle-up",
  balanced: "All-round CrossFit",
  mastersRxOpen: "Masters 35-39 RX / Open Prep",
};

const BAR_MUSCLE_UP_LEVELS = {
  highPull: "Chest-to-bar / high pull, no turnover",
  assisted: "Jumping or band-assisted reps",
  singles: "Occasional unassisted singles",
};

const DIVISION_LABELS = {
  men35to39: "Men Masters 35-39",
};

const MASTERS_RX_TARGETS = {
  strength: {
    backSquat: {
      label: "Back squat",
      target: 170,
      unit: "kg",
      source: "maxes.backSquat",
    },
    frontSquat: {
      label: "Front squat",
      target: 140,
      unit: "kg",
      source: "maxes.frontSquat",
    },
    deadlift: {
      label: "Deadlift",
      target: 210,
      unit: "kg",
      source: "maxes.deadlift",
    },
    strictPress: {
      label: "Strict press",
      target: 75,
      unit: "kg",
      source: "maxes.strictPress",
    },
  },
  olympic: {
    snatch: { label: "Snatch", target: 95, unit: "kg", source: "maxes.snatch" },
    cleanJerk: {
      label: "Clean and jerk",
      target: 120,
      unit: "kg",
      source: "maxes.cleanJerk",
    },
    thruster: {
      label: "Thruster",
      target: 90,
      unit: "kg",
      source: "maxes.thruster",
    },
  },
  engine: {
    row1k: {
      label: "1 km row",
      target: 205,
      unit: "time",
      source: "benchmarks.row1k",
      direction: "lower",
    },
    row2k: {
      label: "2 km row",
      target: 435,
      unit: "time",
      source: "benchmarks.row2k",
      direction: "lower",
    },
    run5k: {
      label: "5 km run",
      target: 1380,
      unit: "time",
      source: "benchmarks.run5k",
      direction: "lower",
    },
    bike10MinCalories: {
      label: "10 min bike",
      target: 160,
      unit: "cal",
      source: "benchmarks.bike10MinCalories",
    },
  },
  gymnastics: {
    pullUps: {
      label: "Pull-ups",
      target: 25,
      unit: "reps",
      source: "benchmarks.pullUps",
    },
    chestToBar: {
      label: "Chest-to-bar",
      target: 18,
      unit: "reps",
      source: "benchmarks.chestToBar",
    },
    t2b: {
      label: "Toes-to-bar",
      target: 25,
      unit: "reps",
      source: "benchmarks.t2b",
    },
    barMuscleUp: {
      label: "Bar muscle-ups",
      target: 8,
      unit: "reps",
      source: "benchmarks.barMuscleUp",
    },
    ringMuscleUp: {
      label: "Ring muscle-ups",
      target: 4,
      unit: "reps",
      source: "benchmarks.ringMuscleUp",
    },
    strictHspu: {
      label: "Strict HSPU",
      target: 8,
      unit: "reps",
      source: "benchmarks.strictHspu",
    },
    handstandWalk: {
      label: "Handstand walk",
      target: 15,
      unit: "m",
      source: "benchmarks.handstandWalk",
    },
    doubleUnders: {
      label: "Double-unders",
      target: 100,
      unit: "reps",
      source: "benchmarks.doubleUnders",
    },
  },
};

const WEAKNESS_LABELS = {
  squat: "Squat strength",
  olympic: "Olympic lifting",
  rowing: "Rowing engine",
  running: "Running stamina",
  runningBodyweight: "Running and bodyweight capacity",
  pulling: "Pull-ups and chest-to-bar",
  muscleup: "Muscle-up skill",
  t2b: "Toes-to-bar",
};

function crossFitVideoSearch(query) {
  return `https://www.youtube.com/@CrossFit/search?query=${encodeURIComponent(query)}`;
}

const CROSSFIT_MOVEMENT_SOURCE =
  "https://www.crossfit.com/essentials/movements";

const MOVEMENT_LIBRARY = [
  {
    id: "strict-pull-up",
    name: "Strict pull-up",
    category: "Gymnastics",
    level: "Base strength",
    focus:
      "Build the pulling strength that makes kipping and chest-to-bar safer.",
    cues: [
      "Start from an active hang.",
      "Pull elbows toward the ribs.",
      "Finish chin clearly over the bar.",
    ],
    progressions: [
      "Ring row",
      "Band-assisted strict pull-up",
      "Eccentric pull-up",
      "Strict pull-up",
    ],
    scale: "Ring rows or banded strict pull-ups.",
    videoUrl: crossFitVideoSearch("strict pull-up CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "kipping-pull-up",
    name: "Kipping pull-up",
    category: "Gymnastics",
    level: "Intermediate",
    focus: "Use a controlled hollow-to-arch swing before adding speed.",
    cues: [
      "Keep arms long through the swing.",
      "Snap from arch to hollow.",
      "Press away from the bar on the way down.",
    ],
    progressions: [
      "Beat swing",
      "Kip swing with active shoulders",
      "Single kipping pull-up",
      "Small sets",
    ],
    scale: "Beat swings, jumping pull-ups, or strict volume.",
    videoUrl: crossFitVideoSearch("kipping pull-up CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "chest-to-bar",
    name: "Chest-to-bar pull-up",
    category: "Gymnastics",
    level: "Intermediate",
    focus: "Add range of motion and a stronger pull without losing rhythm.",
    cues: [
      "Open the shoulders in the arch.",
      "Drive hips before pulling.",
      "Pull the bar to the lower chest.",
    ],
    progressions: [
      "Kip swing",
      "Kipping pull-up",
      "Banded chest-to-bar",
      "Singles and doubles",
    ],
    scale: "Chin-over-bar pull-ups, banded chest-to-bar, or ring rows.",
    videoUrl: crossFitVideoSearch("chest-to-bar pull-up CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "toes-to-bar",
    name: "Toes-to-bar",
    category: "Gymnastics",
    level: "Intermediate",
    focus: "Connect lats and abs so the feet rise without a wild swing.",
    cues: [
      "Stay long in the arch.",
      "Press down on the bar.",
      "Close fast and push away after contact.",
    ],
    progressions: [
      "Hanging knee raise",
      "Kip swing",
      "Knees-to-elbows",
      "Toes-to-bar singles",
    ],
    scale: "Knees-to-chest, hanging knee raises, or lying leg raises.",
    videoUrl: crossFitVideoSearch("toes-to-bar CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "bar-muscle-up",
    name: "Bar muscle-up",
    category: "Gymnastics",
    level: "Advanced",
    focus:
      "Turn a strong kip and close pull into a fast turnover above the bar.",
    cues: [
      "Keep the bar close.",
      "Drive hips toward the bar.",
      "Turn over with fast elbows and press tall.",
    ],
    progressions: [
      "Chest-to-bar",
      "Box bar muscle-up transition",
      "Banded turnover",
      "Singles",
    ],
    scale:
      "Jumping bar muscle-ups, banded transitions, or chest-to-bar pull-ups.",
    videoUrl: crossFitVideoSearch("bar muscle-up CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-muscle-up",
  },
  {
    id: "ring-muscle-up",
    name: "Ring muscle-up",
    category: "Gymnastics",
    level: "Advanced",
    focus:
      "Combine false grip strength, a high pull, and a close ring transition.",
    cues: [
      "Keep rings close to the body.",
      "Pull low to the ribs.",
      "Sit through the transition before the dip.",
    ],
    progressions: [
      "False grip hang",
      "Low-ring transition",
      "Strict ring dip",
      "Assisted ring muscle-up",
    ],
    scale:
      "Low-ring transitions, banded ring muscle-ups, or ring rows plus dips.",
    videoUrl: crossFitVideoSearch("ring muscle-up CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-muscle-up",
  },
  {
    id: "ring-dip",
    name: "Ring dip",
    category: "Gymnastics",
    level: "Strength",
    focus: "Own support stability before adding depth or volume.",
    cues: [
      "Lock out with rings close.",
      "Lower under control.",
      "Keep shoulders away from the ears.",
    ],
    progressions: [
      "Top support hold",
      "Eccentric ring dip",
      "Banded ring dip",
      "Strict ring dip",
    ],
    scale: "Box dips, banded ring dips, or push-ups.",
    videoUrl: crossFitVideoSearch("ring dip CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "handstand-push-up",
    name: "Handstand push-up",
    category: "Gymnastics",
    level: "Intermediate",
    focus:
      "Stack the body, control the descent, and finish with a locked-out line.",
    cues: [
      "Hands just outside shoulder width.",
      "Lower head between the hands.",
      "Press through and finish ribs down.",
    ],
    progressions: [
      "Pike push-up",
      "Wall walk hold",
      "Strict negative",
      "Kipping handstand push-up",
    ],
    scale: "Pike push-ups, box handstand push-ups, or dumbbell strict press.",
    videoUrl: crossFitVideoSearch("handstand push-up CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "handstand-walk",
    name: "Handstand walk",
    category: "Gymnastics",
    level: "Advanced",
    focus:
      "Balance comes from a stacked line, fingertip pressure, and small steps.",
    cues: [
      "Push tall through the floor.",
      "Keep ribs tucked.",
      "Shift weight before moving the hands.",
    ],
    progressions: [
      "Wall walk",
      "Shoulder taps",
      "Box weight shifts",
      "Short freestanding walks",
    ],
    scale: "Wall walks, bear crawls, or handstand shoulder taps.",
    videoUrl: crossFitVideoSearch("handstand walk CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "rope-climb",
    name: "Rope climb",
    category: "Gymnastics",
    level: "Intermediate",
    focus: "Use the feet first so the arms do not become the limiter.",
    cues: [
      "Jump high and lock the feet.",
      "Stand before pulling.",
      "Reach long, then re-clamp.",
    ],
    progressions: [
      "Foot lock drill",
      "Rope pull from floor",
      "Half rope climb",
      "Full rope climb",
    ],
    scale: "Rope pulls from the floor or towel pull-ups.",
    videoUrl: crossFitVideoSearch("rope climb CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "pistol-squat",
    name: "Pistol squat",
    category: "Gymnastics",
    level: "Intermediate",
    focus:
      "Develop single-leg control through the whole range without collapsing the knee.",
    cues: [
      "Keep the working foot rooted.",
      "Reach the free leg forward.",
      "Stand through the midfoot.",
    ],
    progressions: [
      "Box pistol",
      "Counterweight pistol",
      "Assisted pistol",
      "Alternating pistols",
    ],
    scale: "Box pistols, step-ups, or assisted pistols.",
    videoUrl: crossFitVideoSearch("pistol squat CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "back-squat",
    name: "Back squat",
    category: "Weightlifting",
    level: "Strength",
    focus:
      "Build lower-body strength with a stable brace and full-foot pressure.",
    cues: [
      "Brace before the descent.",
      "Knees track over toes.",
      "Drive the floor away to stand.",
    ],
    progressions: [
      "Air squat",
      "Tempo goblet squat",
      "Light back squat",
      "Working sets",
    ],
    scale: "Goblet squat, box squat, or reduced range of motion.",
    videoUrl: crossFitVideoSearch("back squat CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "front-squat",
    name: "Front squat",
    category: "Weightlifting",
    level: "Strength",
    focus:
      "Train upright squatting and front-rack positions for cleans and thrusters.",
    cues: [
      "Elbows high.",
      "Stay tall through the torso.",
      "Keep pressure through the whole foot.",
    ],
    progressions: [
      "Goblet squat",
      "Front-rack hold",
      "Tempo front squat",
      "Front squat",
    ],
    scale: "Goblet squat, cross-arm front squat, or box front squat.",
    videoUrl: crossFitVideoSearch("front squat CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "overhead-squat",
    name: "Overhead squat",
    category: "Weightlifting",
    level: "Mobility and strength",
    focus: "Own the overhead position while squatting with control.",
    cues: [
      "Press up into the bar.",
      "Keep armpits forward.",
      "Sit straight down between the heels.",
    ],
    progressions: [
      "PVC pass-through",
      "PVC overhead squat",
      "Snatch balance",
      "Loaded overhead squat",
    ],
    scale: "PVC overhead squat, front squat, or reduced range.",
    videoUrl: crossFitVideoSearch("overhead squat CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "deadlift",
    name: "Deadlift",
    category: "Weightlifting",
    level: "Strength",
    focus: "Create a strong hinge pattern for pulling from the floor.",
    cues: [
      "Bar over midfoot.",
      "Lats tight before the bar leaves.",
      "Hips and shoulders rise together.",
    ],
    progressions: [
      "Kettlebell deadlift",
      "Romanian deadlift",
      "Tempo deadlift",
      "Working deadlift",
    ],
    scale: "Kettlebell deadlift, raised bar deadlift, or lighter sets.",
    videoUrl: crossFitVideoSearch("deadlift CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "shoulder-press",
    name: "Shoulder press",
    category: "Weightlifting",
    level: "Base strength",
    focus: "Build strict overhead strength without using the legs.",
    cues: [
      "Squeeze legs and glutes.",
      "Move the head back, then through.",
      "Finish with biceps by the ears.",
    ],
    progressions: [
      "Dumbbell strict press",
      "Barbell strict press",
      "Tempo strict press",
      "Heavy sets",
    ],
    scale: "Dumbbell strict press or seated press.",
    videoUrl: crossFitVideoSearch("shoulder press CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "push-press",
    name: "Push press",
    category: "Weightlifting",
    level: "Power",
    focus: "Transfer leg drive into the bar while keeping the torso vertical.",
    cues: [
      "Dip straight down.",
      "Drive hard with the legs.",
      "Press after the hips open.",
    ],
    progressions: [
      "Dip-drive drill",
      "Dumbbell push press",
      "Light barbell push press",
      "Cycling sets",
    ],
    scale: "Dumbbell push press or lighter barbell loads.",
    videoUrl: crossFitVideoSearch("push press CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "push-jerk",
    name: "Push jerk",
    category: "Weightlifting",
    level: "Power",
    focus: "Drive the bar up, then receive it with locked arms and bent knees.",
    cues: [
      "Dip vertical.",
      "Punch under the bar.",
      "Stand to finish before lowering.",
    ],
    progressions: [
      "Jump and land drill",
      "Tall jerk",
      "Push jerk from rack",
      "Cycling push jerks",
    ],
    scale: "Push press or light technique triples.",
    videoUrl: crossFitVideoSearch("push jerk CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
  {
    id: "split-jerk",
    name: "Split jerk",
    category: "Weightlifting",
    level: "Olympic lifting",
    focus: "Receive heavy loads overhead with a balanced split stance.",
    cues: [
      "Dip and drive vertical.",
      "Punch up as the feet split.",
      "Recover front foot, then back foot.",
    ],
    progressions: [
      "Jerk footwork",
      "Tall split jerk",
      "Paused split jerk",
      "Split jerk",
    ],
    scale: "Push jerk, power jerk, or footwork with an empty bar.",
    videoUrl: crossFitVideoSearch("split jerk CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-clean-and-jerk",
  },
  {
    id: "clean",
    name: "Clean",
    category: "Weightlifting",
    level: "Olympic lifting",
    focus:
      "Move the bar from the floor to the front rack with speed and a strong catch.",
    cues: [
      "Push the floor away.",
      "Keep the bar close.",
      "Receive with elbows fast and high.",
    ],
    progressions: [
      "Clean deadlift",
      "Hang power clean",
      "Front squat",
      "Squat clean",
    ],
    scale: "Hang clean, power clean, or medicine-ball clean.",
    videoUrl: crossFitVideoSearch("clean CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-clean-and-jerk",
  },
  {
    id: "power-clean",
    name: "Power clean",
    category: "Weightlifting",
    level: "Olympic lifting",
    focus: "Catch the bar above parallel with a fast turnover.",
    cues: [
      "Finish the pull.",
      "Move elbows around quickly.",
      "Meet the bar with a partial squat.",
    ],
    progressions: [
      "Clean pull",
      "Hang power clean",
      "Tall power clean",
      "Power clean",
    ],
    scale: "Hang power clean or medicine-ball clean.",
    videoUrl: crossFitVideoSearch("power clean CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-clean-and-jerk",
  },
  {
    id: "clean-and-jerk",
    name: "Clean and jerk",
    category: "Weightlifting",
    level: "Olympic lifting",
    focus: "Combine a stable clean with a decisive overhead finish.",
    cues: [
      "Reset the brace after the clean.",
      "Dip vertical.",
      "Lock out before recovering the feet.",
    ],
    progressions: [
      "Clean",
      "Front squat",
      "Push jerk",
      "Clean and jerk singles",
    ],
    scale: "Power clean and push press, or clean plus push jerk.",
    videoUrl: crossFitVideoSearch("clean and jerk CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-clean-and-jerk",
  },
  {
    id: "snatch",
    name: "Snatch",
    category: "Weightlifting",
    level: "Olympic lifting",
    focus: "Move the bar from floor to overhead in one fast, balanced motion.",
    cues: [
      "Stay patient to the knee.",
      "Jump vertically.",
      "Punch under and stabilize overhead.",
    ],
    progressions: [
      "Burgener warm-up",
      "Hang power snatch",
      "Overhead squat",
      "Squat snatch",
    ],
    scale: "Hang power snatch, dumbbell snatch, or PVC technique work.",
    videoUrl: crossFitVideoSearch("snatch CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-snatch",
  },
  {
    id: "power-snatch",
    name: "Power snatch",
    category: "Weightlifting",
    level: "Olympic lifting",
    focus: "Receive the snatch above parallel with speed and stable shoulders.",
    cues: ["Keep the bar close.", "Finish tall.", "Punch up as the feet move."],
    progressions: [
      "Snatch high pull",
      "Hang power snatch",
      "Tall power snatch",
      "Power snatch",
    ],
    scale: "Dumbbell snatch, hang power snatch, or PVC drills.",
    videoUrl: crossFitVideoSearch("power snatch CrossFit tutorial"),
    sourceUrl: "https://www.crossfit.com/essentials/the-snatch",
  },
  {
    id: "thruster",
    name: "Thruster",
    category: "Weightlifting",
    level: "CrossFit staple",
    focus: "Blend a front squat and push press into one smooth rep.",
    cues: [
      "Elbows stay high in the squat.",
      "Drive out of the legs.",
      "Finish locked out overhead.",
    ],
    progressions: [
      "Front squat",
      "Push press",
      "Pause thruster",
      "Cycling thrusters",
    ],
    scale:
      "Dumbbell thruster, lighter barbell, or front squat plus push press.",
    videoUrl: crossFitVideoSearch("thruster CrossFit tutorial"),
    sourceUrl: CROSSFIT_MOVEMENT_SOURCE,
  },
];

const WOD_SCHEMA_VERSION = 7;
const PLAN_SCHEMA_VERSION = 3;
const WORKOUT_DEFINITION_VERSION = 1;
const MASTERS_RX_MOVEMENT_VARIATIONS = [
  {
    matches: /wall balls?/i,
    instruction:
      "replace every wall-ball rep with one light dumbbell-thruster rep",
  },
  {
    matches: /wall balls?/i,
    instruction:
      "replace every wall-ball rep with one light sandbag-to-shoulder rep, alternating sides",
  },
  {
    matches: /box (?:jump|step)-overs?/i,
    instruction:
      "replace every box jump-over or step-over rep with one lateral burpee over a line",
  },
  {
    matches: /box (?:jump|step)-overs?/i,
    instruction:
      "replace every box jump-over or step-over rep with one alternating dumbbell step-over",
  },
  {
    matches: /toes-to-bar/i,
    instruction: "replace every toes-to-bar rep with one chest-to-bar pull-up",
  },
  {
    matches: /toes-to-bar/i,
    instruction:
      "replace every toes-to-bar rep with one controlled knee-to-elbow rep",
  },
  {
    matches: /overhead squats?/i,
    instruction:
      "replace every overhead-squat rep with one front squat at a comparable effort",
  },
  {
    matches: /overhead squats?/i,
    instruction:
      "replace every overhead-squat rep with one alternating single-arm dumbbell overhead squat",
  },
  {
    matches: /shuttle runs?|\b\d+\s*m run\b/i,
    instruction:
      "replace each running segment with an equal-duration bike or ski effort",
  },
  {
    matches: /shuttle runs?|\b\d+\s*m run\b/i,
    instruction:
      "replace each running segment with an equal-duration rowing effort",
  },
  {
    matches: /burpees?(?: over bar| to target)?/i,
    instruction: "replace every burpee rep with one box jump-over",
  },
  {
    matches: /burpees?(?: over bar| to target)?/i,
    instruction:
      "replace every burpee rep with one alternating dumbbell snatch",
  },
  {
    matches: /chest-to-bar pull-ups?/i,
    instruction: "replace every chest-to-bar pull-up with one toes-to-bar rep",
  },
  {
    matches: /chest-to-bar pull-ups?/i,
    instruction: "replace every chest-to-bar pull-up with one strict pull-up",
  },
  {
    matches: /\b(?:row|bike|ski)\b/i,
    instruction:
      "change the named machine to a different machine while keeping the listed calories or distance",
  },
  {
    matches: /\b(?:row|bike|ski)\b/i,
    instruction:
      "replace the named machine segment with an equal-duration shuttle-run effort",
  },
  {
    matches: /thrusters?/i,
    instruction:
      "replace every barbell-thruster rep with one dumbbell thruster using a sustainable pair",
  },
  {
    matches: /thrusters?/i,
    instruction:
      "replace every barbell-thruster rep with one dumbbell clean and push press",
  },
  {
    matches: /bar muscle-ups?/i,
    instruction:
      "replace every bar muscle-up with one ring muscle-up or low-ring transition",
  },
  {
    matches: /bar muscle-ups?/i,
    instruction:
      "replace every bar muscle-up with one chest-to-bar pull-up plus one box dip",
  },
  {
    matches: /double-unders?/i,
    instruction: "replace every double-under rep with one crossover",
  },
  {
    matches: /double-unders?/i,
    instruction:
      "replace every double-under rep with two fast single-unders and keep moving",
  },
  {
    matches: /(?:clean and jerks?|power cleans?|power snatches?)/i,
    instruction:
      "replace the named barbell reps with alternating dumbbell snatches at a repeatable load",
  },
  {
    matches: /(?:clean and jerks?|power cleans?|power snatches?)/i,
    instruction:
      "replace the named barbell reps with sandbag cleans at a repeatable load",
  },
  {
    matches: /(?:wall walks?|strict HSPU|pike press(?:es)?|handstand hold)/i,
    instruction:
      "replace the inverted-pressing station with strict dumbbell presses at the same work target",
  },
  {
    matches: /(?:wall walks?|strict HSPU|pike press(?:es)?|handstand hold)/i,
    instruction:
      "replace the inverted-pressing station with hand-release push-ups at the same work target",
  },
];

const canUseDOM = typeof document !== "undefined";
const legacyVanillaRoot = canUseDOM
  ? document.querySelector("[data-vanilla-app]")
  : null;
const state = legacyVanillaRoot ? loadState() : null;

const elements = canUseDOM
  ? {
      views: Array.from(document.querySelectorAll(".view")),
      navButtons: Array.from(document.querySelectorAll(".nav-button")),
      dashboardWeek: document.querySelector("#dashboardWeek"),
      programWeek: document.querySelector("#programWeek"),
      logWeek: document.querySelector("#logWeek"),
      logDay: document.querySelector("#logDay"),
      customPlanWeek: document.querySelector("#customPlanWeek"),
      statsGrid: document.querySelector("#statsGrid"),
      nextSession: document.querySelector("#nextSession"),
      programList: document.querySelector("#programList"),
      weekNote: document.querySelector("#weekNote"),
      profileForm: document.querySelector("#profileForm"),
      programmeGeneratorForm: document.querySelector("#programmeGeneratorForm"),
      customPlanForm: document.querySelector("#customPlanForm"),
      movementCategory: document.querySelector("#movementCategory"),
      movementSearch: document.querySelector("#movementSearch"),
      movementLibrary: document.querySelector("#movementLibrary"),
      logForm: document.querySelector("#logForm"),
      prForm: document.querySelector("#prForm"),
      customProgramList: document.querySelector("#customProgramList"),
      recentLogs: document.querySelector("#recentLogs"),
      prGrid: document.querySelector("#prGrid"),
      prMetric: document.querySelector("#prMetric"),
      prHistory: document.querySelector("#prHistory"),
      clearCustomPlans: document.querySelector("#clearCustomPlans"),
      clearLogs: document.querySelector("#clearLogs"),
      resetDemoData: document.querySelector("#resetDemoData"),
      toast: document.querySelector("#toast"),
    }
  : {};

if (legacyVanillaRoot) {
  init();
}

function init() {
  seedPrs();
  migrateStoredGeneratedPlans();
  populateStaticSelects();
  bindEvents();
  setDefaultDates();
  renderAll();
  registerServiceWorker();
}

function loadState() {
  const fallback = {
    profile: cloneDefaultProfile(),
    logs: [],
    customPlans: [],
    prs: {},
    prAttempts: [],
    selectedWeek: 1,
  };

  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      profile: {
        ...fallback.profile,
        ...(parsed.profile || {}),
        maxes: {
          ...fallback.profile.maxes,
          ...((parsed.profile && parsed.profile.maxes) || {}),
        },
        benchmarks: {
          ...fallback.profile.benchmarks,
          ...((parsed.profile && parsed.profile.benchmarks) || {}),
        },
      },
    };
  } catch (error) {
    console.warn("Could not read saved state.", error);
    return fallback;
  }
}

function saveState() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cloneDefaultProfile() {
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
}

function createId() {
  const cryptoSource =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoSource && typeof cryptoSource.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedPrs() {
  PR_METRICS.forEach((metric) => {
    if (state.prs[metric.id]) return;
    const rawValue = valueFromPath(state.profile, metric.seed);
    const value = normalizePrValue(rawValue, metric);
    state.prs[metric.id] = {
      metricId: metric.id,
      value,
      display: formatPrValue(value, metric),
      date: "Baseline",
      notes: "Seeded from initial research numbers.",
    };
  });
  saveState();
}

function syncBaselinePrsFromProfile() {
  PR_METRICS.forEach((metric) => {
    const current = state.prs[metric.id];
    const hasAttempts = state.prAttempts.some(
      (attempt) => attempt.metricId === metric.id,
    );
    if (!current || current.date !== "Baseline" || hasAttempts) return;
    const rawValue = valueFromPath(state.profile, metric.seed);
    const value = normalizePrValue(rawValue, metric);
    state.prs[metric.id] = {
      ...current,
      value,
      display: formatPrValue(value, metric),
    };
  });
}

function migrateStoredGeneratedPlans() {
  const migration = migrateGeneratedProgrammePlans(
    state.customPlans,
    state.profile,
  );
  if (!migration.migrated) return;
  state.customPlans = migration.plans;
  saveState();
}

function populateStaticSelects() {
  const weekOptions = WEEK_META.map(
    (week) => `<option value="${week.week}">Week ${week.week}</option>`,
  ).join("");
  [
    elements.dashboardWeek,
    elements.programWeek,
    elements.logWeek,
    elements.customPlanWeek,
  ].forEach((select) => {
    select.innerHTML = weekOptions;
    select.value = String(state.selectedWeek);
  });

  renderLogSessionOptions();

  elements.prMetric.innerHTML = PR_METRICS.map((metric) => {
    return `<option value="${metric.id}">${metric.name}</option>`;
  }).join("");
}

function renderLogSessionOptions() {
  const mainOptions = getProgramDays()
    .map((day) => {
      return `<option value="${day.id}">${day.weekday} - ${day.shortTitle}</option>`;
    })
    .join("");
  const customOptions = state.customPlans
    .map((plan) => {
      return `<option value="${plan.id}">Custom W${plan.week}: ${escapeHtml(plan.title)}</option>`;
    })
    .join("");

  elements.logDay.innerHTML = `
    <optgroup label="CrossFit Training Programme">
      ${mainOptions}
    </optgroup>
    ${customOptions ? `<optgroup label="My programme">${customOptions}</optgroup>` : ""}
  `;
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.view));
  });

  [elements.dashboardWeek, elements.programWeek, elements.logWeek].forEach(
    (select) => {
      select.addEventListener("change", () => {
        state.selectedWeek = Number(select.value);
        saveState();
        syncWeekSelects();
        renderAll();
      });
    },
  );

  elements.profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.profileForm);
    state.profile.athleteName = String(
      data.get("athleteName") || "Intermediate athlete",
    ).trim();
    state.profile.maxes.backSquat = positiveNumber(
      data.get("backSquatMax"),
      state.profile.maxes.backSquat,
    );
    state.profile.maxes.frontSquat = positiveNumber(
      data.get("frontSquatMax"),
      state.profile.maxes.frontSquat,
    );
    state.profile.maxes.snatch = positiveNumber(
      data.get("snatchMax"),
      state.profile.maxes.snatch,
    );
    state.profile.maxes.cleanJerk = positiveNumber(
      data.get("cleanJerkMax"),
      state.profile.maxes.cleanJerk,
    );
    syncBaselinePrsFromProfile();
    saveState();
    renderAll();
    showToast("Training maxes saved.");
  });

  elements.programmeGeneratorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.programmeGeneratorForm);
    const options = {
      goal: String(data.get("generatorGoal") || "stronger"),
      daysPerWeek: Number(data.get("generatorDays") || 4),
      weakness: String(data.get("generatorWeakness") || "squat"),
      duration: positiveNumber(data.get("generatorDuration"), 60),
    };
    const generatedPlans = buildGeneratedProgramme(
      options,
      state.profile,
      createId,
    );

    if (data.get("replaceGenerated")) {
      state.customPlans = state.customPlans.filter((plan) => !plan.generated);
    }

    state.customPlans = [...generatedPlans, ...state.customPlans];
    state.selectedWeek = 1;
    saveState();
    renderAll();
    showToast(`Generated ${generatedPlans.length} sessions.`);
  });

  elements.customPlanForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.customPlanForm);
    const title = String(data.get("customPlanTitle") || "").trim();
    if (!title) {
      showToast("Add a title for the training session.");
      return;
    }

    const duration = Math.min(
      90,
      Math.max(15, positiveNumber(data.get("customPlanDuration"), 60)),
    );
    const plan = {
      id: createId(),
      week: Number(data.get("customPlanWeek")),
      title,
      focus: String(
        data.get("customPlanFocus") || "Custom training session",
      ).trim(),
      warmup: splitLines(data.get("customPlanWarmup")),
      strength: splitLines(data.get("customPlanStrength")),
      wod: splitLines(data.get("customPlanWod")),
      mobility: splitLines(data.get("customPlanMobility")),
      duration,
      intensity: String(data.get("customPlanIntensity") || "Moderate"),
      createdAt: new Date().toISOString(),
    };

    state.customPlans.unshift(plan);
    saveState();
    elements.customPlanForm.reset();
    document.querySelector("#customPlanDuration").value = "60";
    elements.customPlanWeek.value = String(state.selectedWeek);
    renderAll();
    showToast("Training session saved.");
  });

  elements.movementCategory.addEventListener("change", renderMovementLibrary);
  elements.movementSearch.addEventListener("input", renderMovementLibrary);

  elements.logForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.logForm);
    const day = findTrainingSession(
      String(data.get("logDay")),
      Number(data.get("logWeek")),
    );
    if (!day) {
      showToast("Choose a valid session to log.");
      return;
    }
    const logWeek = day.week || Number(data.get("logWeek"));
    const log = {
      id: createId(),
      date: String(data.get("logDate")),
      week: logWeek,
      dayId: day.id,
      dayTitle: day.shortTitle,
      readiness: String(data.get("readiness")),
      rpe: String(data.get("rpe") || "").trim(),
      strengthResult: String(data.get("strengthResult") || "").trim(),
      wodScore: String(data.get("wodScore") || "").trim(),
      notes: String(data.get("logNotes") || "").trim(),
      mobilityDone: Boolean(data.get("mobilityDone")),
      createdAt: new Date().toISOString(),
    };
    state.logs.unshift(log);
    saveState();
    elements.logForm.reset();
    setDefaultDates();
    renderAll();
    showToast("Workout log saved.");
  });

  elements.prForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.prForm);
    const metric = PR_METRICS.find((item) => item.id === data.get("prMetric"));
    const normalized = normalizePrValue(
      String(data.get("prValue") || ""),
      metric,
    );

    if (!Number.isFinite(normalized)) {
      showToast(
        metric.type === "time"
          ? "Use time like 3:30 or 14:36."
          : "Enter a valid number.",
      );
      return;
    }

    const current = state.prs[metric.id];
    const isPr = !current || isBetterPr(normalized, current.value, metric);
    const attempt = {
      id: createId(),
      metricId: metric.id,
      metricName: metric.name,
      value: normalized,
      display: formatPrValue(normalized, metric),
      date: String(data.get("prDate")),
      notes: String(data.get("prNotes") || "").trim(),
      isPr,
      createdAt: new Date().toISOString(),
    };

    state.prAttempts.unshift(attempt);
    if (isPr) {
      state.prs[metric.id] = {
        metricId: metric.id,
        value: normalized,
        display: attempt.display,
        date: attempt.date,
        notes: attempt.notes,
      };
    }

    saveState();
    elements.prForm.reset();
    setDefaultDates();
    renderAll();
    showToast(isPr ? "New PR saved." : "Attempt saved.");
  });

  elements.clearLogs.addEventListener("click", () => {
    if (!state.logs.length) return;
    const confirmed = window.confirm("Clear all workout logs on this device?");
    if (!confirmed) return;
    state.logs = [];
    saveState();
    renderAll();
    showToast("Workout logs cleared.");
  });

  elements.clearCustomPlans.addEventListener("click", () => {
    if (!state.customPlans.length) return;
    const confirmed = window.confirm(
      "Clear all custom training sessions on this device?",
    );
    if (!confirmed) return;
    state.customPlans = [];
    saveState();
    renderAll();
    showToast("Custom programme cleared.");
  });

  elements.resetDemoData.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Reset profile, custom sessions, logs, and PRs on this device?",
    );
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelector("#logDate").value = today;
  document.querySelector("#prDate").value = today;
  elements.logWeek.value = String(state.selectedWeek);
  elements.customPlanWeek.value = String(state.selectedWeek);
}

function activateView(viewId) {
  elements.views.forEach((view) =>
    view.classList.toggle("is-active", view.id === viewId),
  );
  elements.navButtons.forEach((button) =>
    button.classList.toggle("is-active", button.dataset.view === viewId),
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  syncWeekSelects();
  renderLogSessionOptions();
  renderProfile();
  renderDashboard();
  renderProgramme();
  renderCustomPlans();
  renderMovementLibrary();
  renderLogs();
  renderPrs();
}

function syncWeekSelects() {
  [
    elements.dashboardWeek,
    elements.programWeek,
    elements.logWeek,
    elements.customPlanWeek,
  ].forEach((select) => {
    select.value = String(state.selectedWeek);
  });
}

function renderProfile() {
  document.querySelector("#athleteName").value = state.profile.athleteName;
  document.querySelector("#backSquatMax").value = state.profile.maxes.backSquat;
  document.querySelector("#frontSquatMax").value =
    state.profile.maxes.frontSquat;
  document.querySelector("#snatchMax").value = state.profile.maxes.snatch;
  document.querySelector("#cleanJerkMax").value = state.profile.maxes.cleanJerk;
}

function renderDashboard() {
  const logsThisWeek = state.logs.filter(
    (log) => log.week === state.selectedWeek,
  );
  const mainDayIds = getProgramDays().map((day) => day.id);
  const completedDays = new Set(
    logsThisWeek
      .filter((log) => mainDayIds.includes(log.dayId))
      .map((log) => log.dayId),
  ).size;
  const latestRpe = state.logs.find((log) => log.rpe);
  const latestPr = state.prAttempts.find((attempt) => attempt.isPr);
  const weekPercent = Math.round((completedDays / 4) * 100);

  elements.statsGrid.innerHTML = [
    statCard(`${completedDays}/4`, "Sessions logged"),
    statCard(`${weekPercent}%`, "Week complete"),
    statCard(latestRpe ? latestRpe.rpe : "-", "Latest RPE"),
    statCard(latestPr ? latestPr.metricName : "-", "Latest PR"),
  ].join("");

  const nextDay = getNextDayForToday();
  const session = buildSession(nextDay.id, state.selectedWeek, state.profile);
  elements.nextSession.innerHTML = `
    <section class="panel">
      <div class="session-topline">
        <div>
          <p class="eyebrow">Next up</p>
          <h3>${escapeHtml(session.weekday)} - ${escapeHtml(session.shortTitle)}</h3>
        </div>
        <span class="metric-pill">60 min</span>
      </div>
      <p class="muted-copy">${escapeHtml(session.focus)}</p>
      <div class="completion-bar" aria-label="Week completion"><span style="width:${weekPercent}%"></span></div>
      <div class="quick-actions">
        <button class="primary-button" type="button" data-jump-log="${session.id}">Log this</button>
        <button class="ghost-button" type="button" data-jump-plan="${session.id}">View plan</button>
      </div>
    </section>
  `;

  elements.nextSession
    .querySelector("[data-jump-log]")
    .addEventListener("click", (event) => {
      elements.logDay.value = event.currentTarget.dataset.jumpLog;
      activateView("logView");
    });
  elements.nextSession
    .querySelector("[data-jump-plan]")
    .addEventListener("click", () => {
      activateView("programView");
    });
}

function renderProgramme() {
  const week = WEEK_META.find((item) => item.week === state.selectedWeek);
  elements.weekNote.innerHTML = `
    <p><strong>${escapeHtml(week.title)}.</strong> ${escapeHtml(week.note)}</p>
  `;

  elements.programList.innerHTML = getProgramDays()
    .map((day) => {
      const session = buildSession(day.id, state.selectedWeek, state.profile);
      const logged = state.logs.some(
        (log) => log.week === state.selectedWeek && log.dayId === day.id,
      );
      return `
      <article class="day-card" id="${session.id}">
        <div class="day-card-header">
          <div>
            <p>${escapeHtml(session.weekday)}</p>
            <h3>${escapeHtml(session.shortTitle)}</h3>
          </div>
          <span class="tag">${logged ? "Logged" : "60 min"}</span>
        </div>
        <div class="day-card-body">
          <p class="muted-copy">${escapeHtml(session.focus)}</p>
          ${session.segments.map(renderSegment).join("")}
          <div class="quick-actions">
            <button class="primary-button" type="button" data-log-day="${session.id}">Log session</button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  elements.programList.querySelectorAll("[data-log-day]").forEach((button) => {
    button.addEventListener("click", (event) => {
      elements.logDay.value = event.currentTarget.dataset.logDay;
      elements.logWeek.value = String(state.selectedWeek);
      activateView("logView");
    });
  });
}

function renderCustomPlans() {
  if (!state.customPlans.length) {
    elements.customProgramList.innerHTML = `<div class="empty-state">No custom sessions yet. Build one here, then log it from the Log tab.</div>`;
    return;
  }

  elements.customProgramList.innerHTML = state.customPlans
    .map((plan) => {
      const logged = state.logs.some((log) => log.dayId === plan.id);
      return `
      <article class="day-card custom-card">
        <div class="day-card-header">
          <div>
            <p>Week ${escapeHtml(plan.week)}</p>
            <h3>${escapeHtml(plan.title)}</h3>
          </div>
          <span class="tag">${escapeHtml(plan.duration)} min</span>
        </div>
        <div class="day-card-body">
          <div class="history-meta">
            <span class="metric-pill">${escapeHtml(plan.intensity)}</span>
            ${plan.generated ? `<span class="metric-pill">${escapeHtml(GOAL_LABELS[plan.sourceGoal] || "Generated")}</span>` : ""}
            ${logged ? `<span class="metric-pill">Logged</span>` : ""}
          </div>
          <p class="muted-copy">${escapeHtml(plan.focus || "Custom training session")}</p>
          ${customPlanSegments(plan).map(renderSegment).join("")}
          <div class="quick-actions">
            <button class="primary-button" type="button" data-log-custom="${plan.id}">Log session</button>
            <button class="danger-button" type="button" data-delete-custom="${plan.id}">Delete</button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  elements.customProgramList
    .querySelectorAll("[data-log-custom]")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        const plan = state.customPlans.find(
          (item) => item.id === event.currentTarget.dataset.logCustom,
        );
        if (!plan) return;
        elements.logDay.value = plan.id;
        elements.logWeek.value = String(plan.week);
        activateView("logView");
      });
    });

  elements.customProgramList
    .querySelectorAll("[data-delete-custom]")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        const planId = event.currentTarget.dataset.deleteCustom;
        const plan = state.customPlans.find((item) => item.id === planId);
        if (!plan) return;
        const confirmed = window.confirm(`Delete "${plan.title}"?`);
        if (!confirmed) return;
        state.customPlans = state.customPlans.filter(
          (item) => item.id !== planId,
        );
        saveState();
        renderAll();
        showToast("Custom session deleted.");
      });
    });
}

function renderSegment(segment) {
  return `
    <section class="segment">
      <h4>
        <span>${escapeHtml(segment.title)}</span>
        <span class="metric-pill">${escapeHtml(segment.minutes)} min</span>
      </h4>
      <ul>
        ${segment.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderMovementLibrary() {
  const category = elements.movementCategory.value || "all";
  const query = elements.movementSearch.value || "";
  const movements = filterMovementLibrary(category, query);

  if (!movements.length) {
    elements.movementLibrary.innerHTML = `<div class="empty-state">No movements found. Try a different search or category.</div>`;
    return;
  }

  elements.movementLibrary.innerHTML = movements
    .map(renderMovementCard)
    .join("");
}

function filterMovementLibrary(category = "all", query = "") {
  const normalizedQuery = String(query).trim().toLowerCase();
  return MOVEMENT_LIBRARY.filter((movement) => {
    const matchesCategory =
      category === "all" || movement.category === category;
    const searchable = [
      movement.name,
      movement.category,
      movement.level,
      movement.focus,
      movement.scale,
      ...movement.cues,
      ...movement.progressions,
    ]
      .join(" ")
      .toLowerCase();
    return (
      matchesCategory &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });
}

function renderMovementCard(movement) {
  return `
    <article class="movement-card">
      <div class="movement-card-header">
        <div>
          <p class="eyebrow">${escapeHtml(movement.category)}</p>
          <h3>${escapeHtml(movement.name)}</h3>
        </div>
        <span class="tag">${escapeHtml(movement.level)}</span>
      </div>
      <p class="muted-copy">${escapeHtml(movement.focus)}</p>
      <div class="movement-detail-grid">
        <section>
          <h4>Cues</h4>
          <ul>
            ${movement.cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")}
          </ul>
        </section>
        <section>
          <h4>Progression</h4>
          <ul>
            ${movement.progressions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
          </ul>
        </section>
      </div>
      <p class="movement-scale"><strong>Scale:</strong> ${escapeHtml(movement.scale)}</p>
      <div class="quick-actions">
        <a class="primary-button movement-link" href="${escapeHtml(movement.videoUrl)}" target="_blank" rel="noopener noreferrer">Open video</a>
        <a class="ghost-button movement-link" href="${escapeHtml(movement.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source</a>
      </div>
    </article>
  `;
}

function customPlanSegments(plan) {
  const minutes = plan.segmentMinutes || {};
  return [
    {
      title: "Warm-up",
      minutes: String(minutes.warmup || 8),
      items: plan.warmup || [],
    },
    {
      title: "Strength and skill",
      minutes: String(minutes.strength || 20),
      items: plan.strength || [],
    },
    {
      title: "WOD",
      minutes: String(minutes.wod || 20),
      items: workoutItemsForSession(plan),
    },
    {
      title: "Cooldown and mobility",
      minutes: String(minutes.mobility || 12),
      items: plan.mobility || [],
    },
  ].filter((segment) => segment.items.length);
}

function workoutItemsForSession(session) {
  if (
    session &&
    session.workoutDefinition &&
    hasValidWorkoutDefinition(session.workoutDefinition)
  ) {
    return renderWorkoutItems(session.workoutDefinition);
  }
  if (
    session &&
    (session.origin === "generated" || session.generated) &&
    !session.customized
  ) {
    return [
      "Generated workout unavailable because its structure is invalid. Regenerate this programme before training.",
    ];
  }
  return Array.isArray(session && session.wod) ? session.wod : [];
}

function renderLogs() {
  if (!state.logs.length) {
    elements.recentLogs.innerHTML = `<div class="empty-state">No workout logs yet. Save your first session after training.</div>`;
    return;
  }

  elements.recentLogs.innerHTML = state.logs
    .slice(0, 12)
    .map((log) => {
      return `
      <article class="history-item">
        <h4>${escapeHtml(formatDate(log.date))} - Week ${log.week}, ${escapeHtml(log.dayTitle)}</h4>
        <p>${escapeHtml(log.wodScore || "No WOD score")} ${log.strengthResult ? "- " + escapeHtml(log.strengthResult) : ""}</p>
        ${log.notes ? `<p>${escapeHtml(log.notes)}</p>` : ""}
        <div class="history-meta">
          <span class="metric-pill readiness-${escapeHtml(log.readiness)}">${escapeHtml(READINESS_LABELS[log.readiness] || log.readiness)}</span>
          ${log.rpe ? `<span class="metric-pill">RPE ${escapeHtml(log.rpe)}</span>` : ""}
          ${log.mobilityDone ? `<span class="metric-pill">Mobility done</span>` : ""}
        </div>
      </article>
    `;
    })
    .join("");
}

function renderPrs() {
  elements.prGrid.innerHTML = PR_METRICS.map((metric) => {
    const pr = state.prs[metric.id];
    return `
      <article class="pr-card">
        <p class="pr-label">${escapeHtml(metric.name)}</p>
        <p class="pr-value">${escapeHtml(pr ? pr.display : "-")}</p>
        <p class="stat-label">${escapeHtml(pr ? pr.date : "No PR yet")}</p>
      </article>
    `;
  }).join("");

  if (!state.prAttempts.length) {
    elements.prHistory.innerHTML = `<div class="empty-state">No PR attempts yet. Baselines are loaded, and attempts you log will appear here.</div>`;
    return;
  }

  elements.prHistory.innerHTML = state.prAttempts
    .slice(0, 12)
    .map((attempt) => {
      return `
      <article class="history-item">
        <h4>${attempt.isPr ? "PR" : "Attempt"} - ${escapeHtml(attempt.metricName)} ${escapeHtml(attempt.display)}</h4>
        <p>${escapeHtml(formatDate(attempt.date))}${attempt.notes ? " - " + escapeHtml(attempt.notes) : ""}</p>
      </article>
    `;
    })
    .join("");
}

function statCard(value, label) {
  return `
    <article class="stat-card">
      <p class="stat-label">${escapeHtml(label)}</p>
      <p class="stat-value">${escapeHtml(value)}</p>
    </article>
  `;
}

class WorkoutValidationError extends Error {
  constructor(errors) {
    super(`Invalid workout definition: ${errors.join("; ")}`);
    this.name = "WorkoutValidationError";
    this.errors = errors;
  }
}

function workoutDefinitionErrors(definition) {
  const errors = [];
  if (
    !definition ||
    typeof definition !== "object" ||
    Array.isArray(definition)
  ) {
    return ["definition must be an object"];
  }
  if (definition.schemaVersion !== WORKOUT_DEFINITION_VERSION) {
    errors.push("unsupported workout definition version");
  }
  requireNonemptyString(definition.stimulus, "stimulus", errors);
  requireNonemptyString(definition.score, "score", errors);
  requireNonemptyString(definition.scaling, "scaling guidance", errors);

  const format = definition.format;
  const supportedFormats = new Set([
    "amrap",
    "emom",
    "fixed_rounds",
    "for_time",
    "intervals",
    "repeat_sets",
    "chipper",
    "benchmark",
  ]);
  if (!format || !supportedFormats.has(format.type)) {
    errors.push("format type is invalid");
  } else {
    if (["amrap", "for_time", "chipper", "benchmark"].includes(format.type)) {
      requirePositiveFinite(format.durationSeconds, "format duration", errors);
    }
    if (format.type === "benchmark") {
      requireNonemptyString(format.name, "benchmark name", errors);
    }
    if (format.type === "fixed_rounds") {
      requirePositiveInteger(format.rounds, "fixed round count", errors);
      if (format.durationSeconds != null) {
        requirePositiveFinite(
          format.durationSeconds,
          "fixed-round cap",
          errors,
        );
      }
    }
    if (format.type === "intervals") {
      requirePositiveInteger(format.rounds, "interval round count", errors);
      requirePositiveFinite(
        format.intervalSeconds,
        "interval duration",
        errors,
      );
    }
    if (format.type === "repeat_sets") {
      requirePositiveInteger(format.sets, "set count", errors);
      requirePositiveFinite(format.restSeconds, "set rest", errors);
    }
    if (format.type === "emom") {
      requirePositiveInteger(format.rounds, "EMOM round count", errors);
      requirePositiveFinite(format.intervalSeconds, "EMOM interval", errors);
      if (!Array.isArray(format.stations) || !format.stations.length) {
        errors.push("EMOM requires at least one station");
      } else {
        format.stations.forEach((station, index) => {
          if (!station || !["work", "rest"].includes(station.type)) {
            errors.push(`EMOM station ${index + 1} is invalid`);
          } else if (
            station.type === "work" &&
            (!Array.isArray(station.exercises) || !station.exercises.length)
          ) {
            errors.push(`EMOM station ${index + 1} requires exercises`);
          }
        });
      }
    }
  }

  const mainExercises = workoutMainExercises(definition);
  const afterEachRound = arrayOrEmpty(definition.afterEachRound);
  const buyIn = arrayOrEmpty(definition.buyIn);
  const cashOut = arrayOrEmpty(definition.cashOut);
  const allExercises = [
    ...mainExercises,
    ...afterEachRound,
    ...buyIn,
    ...cashOut,
  ];
  const ids = new Set();
  allExercises.forEach((exercise, index) => {
    if (!exercise || typeof exercise !== "object") {
      errors.push(`exercise ${index + 1} is invalid`);
      return;
    }
    const id = String(exercise.id || "").trim();
    const movement = String(exercise.movement || "").trim();
    if (!id) errors.push(`exercise ${index + 1} requires an id`);
    if (id && ids.has(id)) errors.push(`exercise id ${id} is duplicated`);
    if (id) ids.add(id);
    if (!movement)
      errors.push(`exercise ${id || index + 1} requires a movement`);
    validateExerciseTarget(exercise.target, id || String(index + 1), errors);
  });
  if (!mainExercises.length) errors.push("main workout requires exercises");

  const progression = definition.progression || { type: "none" };
  const progressionTypes = new Set([
    "none",
    "ascending_ladder",
    "descending_ladder",
    "pyramid",
    "build_up",
  ]);
  if (!progressionTypes.has(progression.type)) {
    errors.push("progression type is invalid");
  }

  const appliesTo = Array.isArray(progression.appliesTo)
    ? progression.appliesTo.map(String)
    : [];
  if (progression.type !== "none") {
    if (!appliesTo.length)
      errors.push("progression requires applicable exercises");
    if (new Set(appliesTo).size !== appliesTo.length) {
      errors.push("progression exercise references must be unique");
    }
    requirePositiveFinite(progression.start, "progression start", errors);
  }
  if (["ascending_ladder", "build_up"].includes(progression.type)) {
    requirePositiveFinite(
      progression.increment,
      "progression increment",
      errors,
    );
  }
  if (progression.type === "descending_ladder") {
    requirePositiveFinite(
      progression.decrement,
      "progression decrement",
      errors,
    );
    requirePositiveFinite(progression.end, "progression end", errors);
    if (Number(progression.end) >= Number(progression.start)) {
      errors.push("descending ladder end must be below its start");
    } else if (
      Number.isFinite(Number(progression.decrement)) &&
      (Number(progression.start) - Number(progression.end)) %
        Number(progression.decrement) !==
        0
    ) {
      errors.push("descending ladder must reach its end exactly");
    }
  }
  if (progression.type === "pyramid") {
    requirePositiveFinite(progression.increment, "pyramid increment", errors);
    requirePositiveFinite(progression.decrement, "pyramid decrement", errors);
    requirePositiveFinite(progression.peak, "pyramid peak", errors);
    requirePositiveFinite(progression.end, "pyramid end", errors);
    if (Number(progression.peak) <= Number(progression.start)) {
      errors.push("pyramid peak must exceed its start");
    } else {
      if (
        (Number(progression.peak) - Number(progression.start)) %
          Number(progression.increment) !==
        0
      ) {
        errors.push("pyramid must reach its peak exactly");
      }
      if (
        Number(progression.end) >= Number(progression.peak) ||
        (Number(progression.peak) - Number(progression.end)) %
          Number(progression.decrement) !==
          0
      ) {
        errors.push("pyramid must descend to its end exactly");
      }
    }
  }
  if (progression.type === "build_up") {
    if (progression.rounds == null && progression.end == null) {
      errors.push("build-up requires rounds or an ending value");
    }
    if (progression.rounds != null) {
      requirePositiveInteger(progression.rounds, "build-up rounds", errors);
    }
    if (progression.end != null) {
      requirePositiveFinite(progression.end, "build-up end", errors);
      if (Number(progression.end) <= Number(progression.start)) {
        errors.push("build-up end must exceed its start");
      } else if (
        Number.isFinite(Number(progression.increment)) &&
        (Number(progression.end) - Number(progression.start)) %
          Number(progression.increment) !==
          0
      ) {
        errors.push("build-up must reach its end exactly");
      }
    }
  }

  const mainById = new Map(
    mainExercises.map((exercise) => [exercise.id, exercise]),
  );
  appliesTo.forEach((id) => {
    const exercise = mainById.get(id);
    if (!exercise) errors.push(`progression references unknown exercise ${id}`);
    else if (exercise.target?.type !== "progressive_reps") {
      errors.push(`progression exercise ${id} cannot have a fixed target`);
    }
  });
  mainExercises
    .filter((exercise) => exercise.target?.type === "progressive_reps")
    .forEach((exercise) => {
      if (!appliesTo.includes(exercise.id)) {
        errors.push(`progressive exercise ${exercise.id} is not assigned`);
      }
    });
  if (progression.type === "none" && appliesTo.length) {
    errors.push("fixed workout cannot declare progression exercises");
  }
  if (
    [
      "fixed_rounds",
      "emom",
      "intervals",
      "repeat_sets",
      "chipper",
      "for_time",
    ].includes(format?.type) &&
    progression.type !== "none"
  ) {
    errors.push(`${format.type} workouts cannot contain a progression`);
  }

  [...buyIn, ...cashOut, ...afterEachRound].forEach((exercise) => {
    if (exercise?.target?.type === "progressive_reps") {
      errors.push(
        `fixed phase exercise ${exercise.id || "unknown"} cannot progress`,
      );
    }
  });
  if (afterEachRound.length) {
    const repeats =
      ["amrap", "fixed_rounds", "intervals", "repeat_sets"].includes(
        format?.type,
      ) ||
      (format?.type === "benchmark" && Number(format.rounds) > 0);
    if (!repeats)
      errors.push("after-each-round work requires a repeating format");
  }
  if (format?.type === "chipper" && afterEachRound.length) {
    errors.push("chippers cannot contain after-each-round work");
  }

  return [...new Set(errors)];
}

function validateWorkoutDefinition(definition) {
  const errors = workoutDefinitionErrors(definition);
  if (errors.length) throw new WorkoutValidationError(errors);
  return definition;
}

function requirePositiveFinite(value, label, errors) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    errors.push(`${label} must be positive and finite`);
  }
}

function requirePositiveInteger(value, label, errors) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
    errors.push(`${label} must be a positive integer`);
  }
}

function requireNonemptyString(value, label, errors) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be nonempty`);
  }
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function workoutMainExercises(definition) {
  if (definition?.format?.type === "emom") {
    return arrayOrEmpty(definition.format.stations).flatMap((station) =>
      station && station.type !== "rest" ? arrayOrEmpty(station.exercises) : [],
    );
  }
  return arrayOrEmpty(definition && definition.exercises);
}

function validateExerciseTarget(target, id, errors) {
  const fixedNumericTargets = new Set([
    "reps",
    "distance_m",
    "calories",
    "duration_seconds",
  ]);
  if (!target || typeof target !== "object") {
    errors.push(`exercise ${id} requires a target`);
    return;
  }
  if (target.type === "progressive_reps") return;
  if (!fixedNumericTargets.has(target.type)) {
    errors.push(`exercise ${id} target type is invalid`);
    return;
  }
  requirePositiveFinite(target.value, `exercise ${id} target`, errors);
  if (target.alternate != null) {
    requirePositiveFinite(
      target.alternate,
      `exercise ${id} alternate target`,
      errors,
    );
  }
}

function renderWorkoutItems(definition) {
  validateWorkoutDefinition(definition);
  return [
    renderWorkoutDescription(definition),
    `Stimulus: ${definition.stimulus}`,
    `Score: ${definition.score}. ${definition.scaling}`,
  ];
}

function renderWorkoutDescription(definition) {
  validateWorkoutDefinition(definition);
  const format = definition.format;
  const main = renderExerciseList(workoutMainExercises(definition));
  const progression = definition.progression || { type: "none" };
  let description;

  if (format.type === "amrap") {
    if (progression.type === "none") {
      description = `AMRAP ${formatDurationMinutes(format.durationSeconds)}: ${main}`;
    } else {
      description = `${formatDurationMinutes(format.durationSeconds)} min ${renderProgressionName(progression)}: ${renderProgressionSequence(progression)} ${main}`;
    }
  } else if (format.type === "fixed_rounds") {
    const cap = format.durationSeconds
      ? `, ${formatDurationMinutes(format.durationSeconds)} min cap`
      : "";
    description = `${format.rounds} rounds for time${cap}: ${main}`;
  } else if (format.type === "for_time") {
    description = `For time, ${formatDurationMinutes(format.durationSeconds)} min cap: ${main}`;
  } else if (format.type === "chipper") {
    description = `For time, ${formatDurationMinutes(format.durationSeconds)} min cap: ${main}`;
  } else if (format.type === "intervals") {
    description = `Every ${formatClock(format.intervalSeconds)} x ${format.rounds}: ${main}${format.restRemaining ? "; rest remaining time" : ""}`;
  } else if (format.type === "repeat_sets") {
    description = `${format.sets} sets, rest ${formatClock(format.restSeconds)} between sets: ${main}`;
  } else if (format.type === "emom") {
    const stationText = format.stations
      .map((station, index) =>
        station.type === "rest"
          ? `min ${index + 1} rest`
          : `min ${index + 1} ${renderExerciseList(station.exercises)}`,
      )
      .join(", ");
    const totalSeconds =
      format.rounds * format.intervalSeconds * format.stations.length;
    description = `EMOM ${formatDurationMinutes(totalSeconds)}: ${stationText}`;
  } else {
    const rounds = format.rounds ? `${format.rounds} rounds: ` : "";
    description = `Benchmark ${format.name}, ${formatDurationMinutes(format.durationSeconds)} min cap: ${rounds}${main}`;
  }

  const after = arrayOrEmpty(definition.afterEachRound);
  if (after.length) {
    description += `; after each round complete ${renderExerciseList(after)}`;
  }
  const buyIn = arrayOrEmpty(definition.buyIn);
  if (buyIn.length) {
    description = `Buy-in: ${renderExerciseList(buyIn)}. Then ${description}`;
  }
  const cashOut = arrayOrEmpty(definition.cashOut);
  if (cashOut.length) {
    description += `. Cash-out: ${renderExerciseList(cashOut)}`;
  }
  return description;
}

function renderExerciseList(exercises) {
  const rendered = arrayOrEmpty(exercises).map(renderExercise);
  if (rendered.length <= 1) return rendered[0] || "";
  if (rendered.length === 2) return `${rendered[0]} and ${rendered[1]}`;
  return `${rendered.slice(0, -1).join(", ")}, ${rendered.at(-1)}`;
}

function renderExercise(exercise) {
  const target = exercise.target;
  let prefix = "";
  if (target.type === "reps") prefix = `${trimNumber(target.value)} `;
  if (target.type === "distance_m") prefix = `${trimNumber(target.value)} m `;
  if (target.type === "calories") {
    prefix = `${trimNumber(target.value)}${target.alternate ? `/${trimNumber(target.alternate)}` : ""} cal `;
  }
  if (target.type === "duration_seconds") {
    prefix = `${trimNumber(target.value)} sec `;
  }
  const load = exercise.load?.display ? ` at ${exercise.load.display}` : "";
  return `${prefix}${exercise.movement}${load}`;
}

function renderProgressionName(progression) {
  return {
    ascending_ladder: "ascending ladder",
    descending_ladder: "descending ladder",
    pyramid: "pyramid",
    build_up: "build-up",
  }[progression.type];
}

function renderProgressionSequence(progression) {
  if (progression.type === "ascending_ladder") {
    return `${progression.start}-${progression.start + progression.increment}-${progression.start + progression.increment * 2}-${progression.start + progression.increment * 3}...`;
  }
  if (progression.type === "descending_ladder") {
    return numericSequence(
      progression.start,
      progression.end,
      -progression.decrement,
    ).join("-");
  }
  if (progression.type === "pyramid") {
    const up = numericSequence(
      progression.start,
      progression.peak,
      progression.increment,
    );
    const down = numericSequence(
      progression.peak - progression.decrement,
      progression.end,
      -progression.decrement,
    );
    return [...up, ...down].join("-");
  }
  const end = progression.end
    ? ` to ${trimNumber(progression.end)}`
    : ` for ${progression.rounds} rounds`;
  return `from ${trimNumber(progression.start)} by ${trimNumber(progression.increment)}${end}`;
}

function numericSequence(start, end, step) {
  const values = [];
  for (
    let value = Number(start);
    step > 0 ? value <= Number(end) : value >= Number(end);
    value += Number(step)
  ) {
    values.push(value);
    if (values.length > 100) break;
  }
  return values;
}

function formatDurationMinutes(seconds) {
  return trimNumber(Number(seconds) / 60);
}

function formatClock(seconds) {
  const total = Number(seconds);
  if (total % 60 === 0) return `${total / 60} min`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} min`;
}

function buildGeneratedProgramme(
  options,
  profile,
  idFactory = createId,
  generationSeed,
) {
  const normalized = normalizeGeneratorOptions(options);
  const hasExplicitSeed = Boolean(generationSeed || normalized.generationSeed);
  const seed = normalizeGenerationSeed(
    generationSeed || normalized.generationSeed,
  );
  const sessions = [];
  const generationContext = {
    seed,
    variationEnabled: hasExplicitSeed,
    usedWodSignatures: new Set(),
  };

  for (let week = 1; week <= 8; week += 1) {
    for (let day = 1; day <= normalized.daysPerWeek; day += 1) {
      sessions.push(
        buildGeneratedSession(
          normalized,
          profile,
          week,
          day,
          idFactory,
          generationContext,
        ),
      );
    }
  }

  return sessions;
}

function createGenerationSeed() {
  const cryptoSource =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoSource && typeof cryptoSource.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }
  return `generation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeGenerationSeed(value) {
  const seed = String(value || "").trim();
  return seed || "forge-hour-default-generation";
}

function migratePlanState(inputState) {
  const source = inputState && typeof inputState === "object" ? inputState : {};
  const hasCanonicalPlans = Array.isArray(source.plans);
  const hasLegacyPlans = Array.isArray(source.customPlans);
  const useCanonicalPlans =
    hasCanonicalPlans &&
    !(hasLegacyPlans && source.customPlans.length && !source.plans.length);
  let plans;
  let plansChanged;

  if (useCanonicalPlans) {
    const normalized = normalizeCanonicalPlans(source.plans);
    let refreshed;
    try {
      refreshed = migrateCanonicalGeneratedPlans(
        normalized.plans,
        profileForGeneration(source.profile),
      );
    } catch (error) {
      console.warn(
        "Generated workouts could not be migrated; unsafe workout prose remains hidden.",
        error,
      );
      refreshed = { plans: normalized.plans, migrated: false };
    }
    plans = refreshed.plans;
    plansChanged = normalized.changed || refreshed.migrated;
  } else {
    const profile = profileForGeneration(source.profile);
    let refreshed;
    try {
      refreshed = migrateGeneratedProgrammePlans(
        hasLegacyPlans ? source.customPlans : [],
        profile,
      );
    } catch (error) {
      console.warn(
        "Legacy generated workouts could not be migrated; unsafe workout prose remains hidden.",
        error,
      );
      refreshed = {
        plans: hasLegacyPlans ? source.customPlans : [],
        migrated: false,
      };
    }
    plans = groupLegacySessionsIntoPlans(refreshed.plans);
    plansChanged = hasLegacyPlans || refreshed.migrated;
  }

  const legacySelectedId = source.selectedPlanId;
  const requestedActiveId = useCanonicalPlans
    ? source.activePlanId || legacySelectedId || null
    : null;
  const requestedPlan = plans.find((plan) => plan.id === requestedActiveId);
  const containingPlan = plans.find((plan) =>
    plan.sessions.some((session) => session.id === requestedActiveId),
  );
  const activePlanId = requestedPlan
    ? requestedPlan.id
    : containingPlan
      ? containingPlan.id
      : plans[0]
        ? plans[0].id
        : null;

  const migrated =
    source.planSchemaVersion !== PLAN_SCHEMA_VERSION ||
    !useCanonicalPlans ||
    Object.prototype.hasOwnProperty.call(source, "customPlans") ||
    Object.prototype.hasOwnProperty.call(source, "selectedPlanId") ||
    source.activePlanId !== activePlanId ||
    plansChanged;

  if (!migrated) return { state: source, migrated: false };

  const {
    customPlans: _legacyCustomPlans,
    selectedPlanId: _legacySelectedPlanId,
    ...rest
  } = source;

  return {
    state: {
      ...rest,
      planSchemaVersion: PLAN_SCHEMA_VERSION,
      plans,
      activePlanId,
    },
    migrated: true,
  };
}

function selectActivePlan(state) {
  if (!state || !Array.isArray(state.plans) || !state.activePlanId) return null;
  return state.plans.find((plan) => plan.id === state.activePlanId) || null;
}

function selectPlanWeekSessions(plan, week) {
  if (!plan || !Array.isArray(plan.sessions)) return [];
  const selectedWeek = clamp(Math.round(Number(week) || 1), 1, 8);
  return plan.sessions.filter(
    (session) => Number(session.week) === selectedWeek,
  );
}

function selectActiveWeekSessions(state, week = state && state.selectedWeek) {
  return selectPlanWeekSessions(selectActivePlan(state), week);
}

function normalizeCanonicalPlans(plans) {
  let changed = false;
  const normalizedPlans = plans
    .filter((plan) => plan && typeof plan === "object")
    .map((plan, index) => {
      const normalized = normalizeCanonicalPlan(plan, index);
      if (normalized.changed) changed = true;
      return normalized.plan;
    });

  if (normalizedPlans.length !== plans.length) changed = true;
  return { plans: changed ? normalizedPlans : plans, changed };
}

function normalizeCanonicalPlan(plan, index) {
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const kind =
    plan.kind === "generated" ||
    (plan.kind !== "custom" && sessions.some((session) => session.generated))
      ? "generated"
      : "custom";
  const generationSeed =
    kind === "generated"
      ? normalizeGenerationSeed(
          plan.generationSeed ||
            sessions.find((session) => session && session.generationSeed)
              ?.generationSeed ||
            legacyGenerationSeed(sessions),
        )
      : null;
  let changed = !Array.isArray(plan.sessions);
  const normalizedSessions = sessions
    .filter((session) => session && typeof session === "object")
    .map((session) => {
      const origin =
        session.origin || (kind === "generated" ? "generated" : "manual");
      const customized = Boolean(session.customized);
      const nextGenerationSeed =
        origin === "generated"
          ? normalizeGenerationSeed(session.generationSeed || generationSeed)
          : undefined;
      const hasCanonicalWorkout = hasValidWorkoutDefinition(
        session.workoutDefinition,
      );
      const hasRenderedDuplicate =
        origin === "generated" &&
        !customized &&
        hasCanonicalWorkout &&
        Object.prototype.hasOwnProperty.call(session, "wod");
      if (
        session.origin === origin &&
        Object.prototype.hasOwnProperty.call(session, "customized") &&
        Boolean(session.customized) === customized &&
        !hasRenderedDuplicate &&
        (origin !== "generated" ||
          session.generationSeed === nextGenerationSeed)
      ) {
        return session;
      }
      changed = true;
      const nextSession = { ...session, origin, customized };
      if (nextGenerationSeed) {
        nextSession.generationSeed = nextGenerationSeed;
      }
      if (hasRenderedDuplicate) delete nextSession.wod;
      return nextSession;
    });

  if (normalizedSessions.length !== sessions.length) changed = true;
  const id = String(plan.id || `canonical-plan-${index + 1}`);
  const title = String(
    plan.title ||
      (kind === "generated" ? "Generated programme" : "Custom programme"),
  );
  const generatorOptions =
    kind === "generated"
      ? normalizeGeneratorOptions(
          plan.generatorOptions || generatorOptionsFromSessions(sessions),
        )
      : null;
  const createdAt =
    plan.createdAt || planTimestamp(normalizedSessions, "createdAt", "first");
  const updatedAt =
    plan.updatedAt || planTimestamp(normalizedSessions, "updatedAt", "last");

  if (
    plan.id !== id ||
    plan.title !== title ||
    plan.kind !== kind ||
    !sameGeneratorOptions(plan.generatorOptions, generatorOptions) ||
    plan.generationSeed !== generationSeed ||
    !plan.createdAt ||
    !plan.updatedAt
  ) {
    changed = true;
  }

  if (!changed) return { plan, changed: false };
  return {
    plan: {
      ...plan,
      id,
      title,
      kind,
      generatorOptions,
      generationSeed,
      createdAt,
      updatedAt,
      sessions: normalizedSessions,
    },
    changed: true,
  };
}

function migrateCanonicalGeneratedPlans(plans, profile) {
  let migrated = false;
  const nextPlans = plans.map((plan) => {
    if (plan.kind !== "generated" || !Array.isArray(plan.sessions)) return plan;

    const staleSessions = plan.sessions
      .filter(
        (session) =>
          session &&
          (session.origin === "generated" || session.generated) &&
          !session.customized &&
          (session.wodSchemaVersion !== WOD_SCHEMA_VERSION ||
            !hasValidWorkoutDefinition(session.workoutDefinition)),
      )
      .sort(compareGeneratedSessionSlots);
    if (!staleSessions.length) return plan;

    const options = normalizeGeneratorOptions(
      plan.generatorOptions || generatorOptionsFromSessions(plan.sessions),
    );
    const generationContext = {
      seed: normalizeGenerationSeed(plan.generationSeed),
      variationEnabled: true,
      usedWodSignatures: new Set(
        plan.sessions
          .filter(
            (session) =>
              session &&
              (session.origin === "generated" || session.generated) &&
              !session.customized &&
              session.wodSchemaVersion === WOD_SCHEMA_VERSION &&
              hasValidWorkoutDefinition(session.workoutDefinition),
          )
          .map((session) => structuralWodSignature(session)),
      ),
    };
    const replacements = new Map();

    staleSessions.forEach((session) => {
      const replacement = buildGeneratedSession(
        options,
        profile,
        clamp(parsePlanWeek(session), 1, 8),
        clamp(parsePlanDay(session), 1, 5),
        () => session.id || createId(),
        generationContext,
      );
      replacements.set(
        session,
        preserveGeneratedSessionIdentity(session, replacement),
      );
    });

    migrated = true;
    return {
      ...plan,
      sessions: plan.sessions.map(
        (session) => replacements.get(session) || session,
      ),
    };
  });

  return { plans: migrated ? nextPlans : plans, migrated };
}

function compareGeneratedSessionSlots(left, right) {
  return (
    parsePlanWeek(left) - parsePlanWeek(right) ||
    parsePlanDay(left) - parsePlanDay(right)
  );
}

function preserveGeneratedSessionIdentity(session, replacement) {
  const migrated = {
    ...replacement,
    id: session.id || replacement.id,
    createdAt: session.createdAt || replacement.createdAt,
  };
  if (Object.prototype.hasOwnProperty.call(session, "updatedAt")) {
    migrated.updatedAt = session.updatedAt;
  }
  return migrated;
}

function sameGeneratorOptions(left, right) {
  if (left == null || right == null) return left === right;
  return (
    left.goal === right.goal &&
    left.weakness === right.weakness &&
    (left.barMuscleUpLevel || null) === (right.barMuscleUpLevel || null) &&
    Number(left.daysPerWeek) === Number(right.daysPerWeek) &&
    Number(left.duration) === Number(right.duration) &&
    (left.generationSeed || null) === (right.generationSeed || null)
  );
}

function groupLegacySessionsIntoPlans(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) return [];
  const entries = [];
  let currentGeneratedGroup = null;
  let manualEntry = null;

  sessions.forEach((session, index) => {
    if (!session || typeof session !== "object") return;

    if (!session.generated) {
      if (!manualEntry) {
        manualEntry = { kind: "manual", order: index, sessions: [] };
        entries.push(manualEntry);
      }
      manualEntry.sessions.push(session);
      currentGeneratedGroup = null;
      return;
    }

    const key = legacyGeneratorKey(session);
    const slot = `${parsePlanWeek(session)}:${parsePlanDay(session)}`;
    if (
      !currentGeneratedGroup ||
      currentGeneratedGroup.key !== key ||
      currentGeneratedGroup.slots.has(slot)
    ) {
      currentGeneratedGroup = {
        kind: "generated",
        key,
        order: index,
        sessions: [],
        slots: new Set(),
      };
      entries.push(currentGeneratedGroup);
    }
    currentGeneratedGroup.sessions.push(session);
    currentGeneratedGroup.slots.add(slot);
  });

  return entries
    .sort((left, right) => left.order - right.order)
    .map((entry, index) =>
      entry.kind === "generated"
        ? legacyGeneratedPlan(entry.sessions, index)
        : legacyManualPlan(entry.sessions, index),
    );
}

function legacyGeneratedPlan(sessions, index) {
  const first = sessions[0] || {};
  const goal = GOAL_LABELS[first.sourceGoal] ? first.sourceGoal : "balanced";
  const weakness = WEAKNESS_LABELS[first.sourceWeakness]
    ? first.sourceWeakness
    : "squat";
  const generationSeed = normalizeGenerationSeed(
    first.generationSeed || legacyGenerationSeed(sessions),
  );
  const normalizedSessions = sessions.map((session) => ({
    ...session,
    origin: "generated",
    customized: Boolean(session.customized),
    generationSeed: normalizeGenerationSeed(
      session.generationSeed || generationSeed,
    ),
  }));
  const id = `legacy-generated-plan-${index + 1}-${safeLegacyId(first.id)}`;

  return {
    id,
    title: `Generated: ${GOAL_LABELS[goal]}`,
    kind: "generated",
    generatorOptions: normalizeGeneratorOptions({
      goal,
      weakness,
      barMuscleUpLevel: first.sourceBarMuscleUpLevel,
      daysPerWeek: Math.max(...sessions.map(parsePlanDay), 3),
      duration: Number(first.duration) || 60,
      generationSeed,
    }),
    generationSeed,
    createdAt: planTimestamp(normalizedSessions, "createdAt", "first"),
    updatedAt: planTimestamp(normalizedSessions, "updatedAt", "last"),
    sessions: normalizedSessions,
  };
}

function legacyManualPlan(sessions, index) {
  const first = sessions[0] || {};
  const normalizedSessions = sessions.map((session) => ({
    ...session,
    origin: session.origin || "manual",
    customized: Boolean(session.customized),
  }));
  return {
    id: `legacy-custom-plan-${index + 1}-${safeLegacyId(first.id)}`,
    title: "Custom programme",
    kind: "custom",
    generatorOptions: null,
    generationSeed: null,
    createdAt: planTimestamp(normalizedSessions, "createdAt", "first"),
    updatedAt: planTimestamp(normalizedSessions, "updatedAt", "last"),
    sessions: normalizedSessions,
  };
}

function generatorOptionsFromSessions(sessions) {
  const first = sessions.find((session) => session && session.generated) || {};
  return {
    goal: first.sourceGoal,
    weakness: first.sourceWeakness,
    barMuscleUpLevel: first.sourceBarMuscleUpLevel,
    daysPerWeek: Math.max(...sessions.map(parsePlanDay), 3),
    duration: Number(first.duration) || 60,
    generationSeed: first.generationSeed,
  };
}

function legacyGeneratorKey(session) {
  return [
    session.sourceGoal || "balanced",
    session.sourceWeakness || "squat",
    session.sourceBarMuscleUpLevel || "",
    Number(session.duration) || 60,
  ].join("|");
}

function legacyGenerationSeed(sessions) {
  const signature = sessions
    .map((session) =>
      [
        session && session.id,
        session && session.title,
        session &&
          (session.workoutDefinition
            ? structuralWodSignature(session)
            : session.wod),
      ]
        .flat()
        .join("|"),
    )
    .join("::");
  return `legacy-${stableHash(signature).toString(36)}`;
}

function safeLegacyId(value) {
  const safe = String(value || "session")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return safe || "session";
}

function planTimestamp(sessions, field, position) {
  const timestamps = sessions
    .map((session) => session && (session[field] || session.createdAt))
    .filter(Boolean)
    .sort();
  if (!timestamps.length) return "1970-01-01T00:00:00.000Z";
  return position === "last"
    ? timestamps[timestamps.length - 1]
    : timestamps[0];
}

function profileForGeneration(profile) {
  const fallback = cloneDefaultProfile();
  return {
    ...fallback,
    ...(profile || {}),
    maxes: { ...fallback.maxes, ...((profile && profile.maxes) || {}) },
    benchmarks: {
      ...fallback.benchmarks,
      ...((profile && profile.benchmarks) || {}),
    },
  };
}

function migrateGeneratedProgrammePlans(plans, profile) {
  let migrated = false;
  const nextPlans = (plans || []).map((plan) => {
    if (
      !plan ||
      !plan.generated ||
      plan.customized ||
      (plan.wodSchemaVersion === WOD_SCHEMA_VERSION &&
        hasValidWorkoutDefinition(plan.workoutDefinition))
    )
      return plan;
    migrated = true;
    const goal = GOAL_LABELS[plan.sourceGoal] ? plan.sourceGoal : "balanced";
    const weakness = WEAKNESS_LABELS[plan.sourceWeakness]
      ? plan.sourceWeakness
      : "squat";
    const week = clamp(parsePlanWeek(plan), 1, 8);
    const day = clamp(parsePlanDay(plan), 1, 5);
    const duration = clamp(
      roundToNearest(Number(plan.duration) || 60, 5),
      45,
      60,
    );
    const replacement = buildGeneratedSession(
      normalizeGeneratorOptions({
        goal,
        weakness,
        barMuscleUpLevel: plan.sourceBarMuscleUpLevel,
        daysPerWeek: day,
        duration,
      }),
      profile,
      week,
      day,
      () => plan.id || createId(),
      plan.generationSeed
        ? {
            seed: normalizeGenerationSeed(plan.generationSeed),
            usedWodSignatures: new Set(),
          }
        : undefined,
    );

    return {
      ...replacement,
      id: plan.id || replacement.id,
      createdAt: plan.createdAt || replacement.createdAt,
    };
  });

  return { plans: nextPlans, migrated };
}

function hasValidWorkoutDefinition(definition) {
  return workoutDefinitionErrors(definition).length === 0;
}

function parsePlanWeek(plan) {
  const explicit = Number(plan.week);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const titleMatch = String(plan.title || "").match(/\bW(\d+)\b/i);
  return titleMatch ? Number(titleMatch[1]) : 1;
}

function parsePlanDay(plan) {
  const titleMatch = String(plan.title || "").match(/\bD(\d+)\b/i);
  if (titleMatch) return Number(titleMatch[1]);
  const idMatch = String(plan.id || "").match(/-d(\d+)\b/i);
  return idMatch ? Number(idMatch[1]) : 1;
}

function normalizeGeneratorOptions(options) {
  const source = options || {};
  const goal = GOAL_LABELS[source.goal] ? source.goal : "balanced";
  const weakness =
    goal === "barMuscleUp"
      ? "muscleup"
      : WEAKNESS_LABELS[source.weakness]
        ? source.weakness
        : "squat";
  const daysPerWeek = clamp(Math.round(Number(source.daysPerWeek) || 4), 3, 5);
  const duration = clamp(
    roundToNearest(Number(source.duration) || 60, 5),
    45,
    60,
  );
  const normalized = { goal, weakness, daysPerWeek, duration };
  if (goal === "barMuscleUp") {
    normalized.barMuscleUpLevel = BAR_MUSCLE_UP_LEVELS[source.barMuscleUpLevel]
      ? source.barMuscleUpLevel
      : "highPull";
  }
  if (source.generationSeed) {
    normalized.generationSeed = normalizeGenerationSeed(source.generationSeed);
  }
  return normalized;
}

function buildGeneratedSession(
  options,
  profile,
  week,
  day,
  idFactory,
  generationContext,
) {
  if (options.goal === "mastersRxOpen") {
    return buildMastersRxOpenSession(
      options,
      profile,
      week,
      day,
      idFactory,
      generationContext,
    );
  }
  if (options.goal === "barMuscleUp") {
    return buildBarMuscleUpSession(
      options,
      profile,
      week,
      day,
      idFactory,
      generationContext,
    );
  }

  const phase = getGeneratedWeekPhase(week, options.goal);
  const title = generatedDayTitle(options.goal, day);
  const segmentMinutes = getGeneratedSegmentMinutes(
    options.duration,
    options.goal,
  );

  const workoutDefinition = claimUniqueGeneratedWod(
    (collisionSalt) =>
      generatedWodItems(
        options.goal,
        options.weakness,
        day,
        week,
        profile,
        phase,
        segmentMinutes.wod,
        generationVariation(generationContext, week, day, collisionSalt),
      ),
    generationContext,
  );

  const session = {
    id: idFactory(`generated-${options.goal}-w${week}-d${day}`),
    week,
    title: `W${week} D${day}: ${title}`,
    focus: `${GOAL_LABELS[options.goal]} with ${WEAKNESS_LABELS[options.weakness].toLowerCase()} priority. ${phase.note}`,
    warmup: generatedWarmup(options.goal, options.weakness, day),
    strength: generatedStrengthItems(
      options.goal,
      options.weakness,
      day,
      week,
      profile,
      phase,
    ),
    workoutDefinition,
    mobility: generatedMobility(options.weakness),
    duration: options.duration,
    segmentMinutes,
    intensity: phase.intensity,
    generated: true,
    wodSchemaVersion: WOD_SCHEMA_VERSION,
    sourceGoal: options.goal,
    sourceWeakness: options.weakness,
    createdAt: new Date().toISOString(),
  };
  if (generationContext && generationContext.seed) {
    session.generationSeed = generationContext.seed;
    session.origin = "generated";
    session.customized = false;
  }
  return session;
}

function buildBarMuscleUpSession(
  options,
  profile,
  week,
  day,
  idFactory,
  generationContext,
) {
  const phase = getGeneratedWeekPhase(week, "gymnastics");
  const segmentMinutes = getGeneratedSegmentMinutes(
    options.duration,
    "gymnastics",
  );
  const focused = day <= 3;
  const workoutGoal = focused
    ? "gymnastics"
    : day === 4
      ? "balanced"
      : "endurance";
  const workoutWeakness = focused
    ? "muscleup"
    : day === 4
      ? "olympic"
      : "rowing";
  const workoutDefinition = claimUniqueGeneratedWod((collisionSalt) => {
    const definition = generatedWodItems(
      workoutGoal,
      workoutWeakness,
      day,
      week,
      profile,
      phase,
      segmentMinutes.wod,
      generationVariation(generationContext, week, day, collisionSalt),
      focused ? options.barMuscleUpLevel : undefined,
    );
    return options.barMuscleUpLevel === "singles"
      ? capBarMuscleUpWorkoutReps(definition, 3)
      : definition;
  }, generationContext);
  const titles = [
    "High pull + kip timing",
    "Turnover + straight-bar strength",
    "Fresh attempts + skill transfer",
    "Olympic lifting + lower body",
    "Engine + shoulder recovery",
  ];
  const session = {
    id: idFactory(`generated-bar-muscle-up-w${week}-d${day}`),
    week,
    title: `W${week} D${day}: ${titles[day - 1]}`,
    focus: focused
      ? `Bar muscle-up focus (${BAR_MUSCLE_UP_LEVELS[options.barMuscleUpLevel].toLowerCase()}). ${barMuscleUpPhaseNote(week)}`
      : `Bar muscle-up support day. Build ${day === 4 ? "leg and Olympic-lifting strength" : "engine capacity while restoring the shoulders"}.`,
    warmup: barMuscleUpWarmup(day),
    strength: barMuscleUpStrengthItems(
      options.barMuscleUpLevel,
      week,
      day,
      profile,
      phase,
    ),
    workoutDefinition,
    mobility: barMuscleUpMobility(day),
    duration: options.duration,
    segmentMinutes,
    intensity: phase.intensity,
    generated: true,
    wodSchemaVersion: WOD_SCHEMA_VERSION,
    sourceGoal: options.goal,
    sourceWeakness: "muscleup",
    sourceBarMuscleUpLevel: options.barMuscleUpLevel,
    createdAt: new Date().toISOString(),
  };
  if (generationContext && generationContext.seed) {
    session.generationSeed = generationContext.seed;
    session.origin = "generated";
    session.customized = false;
  }
  return session;
}

function barMuscleUpPhaseNote(week) {
  return {
    1: "Establish strong shapes and repeatable high pulls.",
    2: "Add controlled volume without grinding repetitions.",
    3: "Increase pull height and make the turnover more specific.",
    4: "Deload: halve the volume and finish every drill fresh.",
    5: "Transfer the stronger pull into faster turnovers.",
    6: "Take a few fresh attempts with full rest and no repeated misses.",
    7: "Peak with low-volume, high-quality attempts.",
    8: "Test one clean repetition or the best repeatable progression.",
  }[week];
}

function barMuscleUpWarmup(day) {
  if (day > 3) {
    return [
      "5 min easy bike, row, or jog with nasal breathing",
      "Dynamic hips, ankles, T-spine, and shoulders",
      day === 4
        ? "Empty-bar Olympic-lifting rehearsal"
        : "Scapular control and light band pull-aparts",
      "Core brace and easy movement preparation",
    ];
  }
  return [
    "3-5 min easy machine work",
    "Bar muscle-up focus: wrists, lats, pecs, and thoracic extension",
    "2 rounds: 6 scap pull-ups, 6 hollow rocks, 6 arch rocks",
    day === 1
      ? "Three progressive kip swings and high-pull rehearsals"
      : day === 2
        ? "Low-bar foot-assisted turnover rehearsal"
        : "Two low-effort practice attempts at the planned scale",
  ];
}

function barMuscleUpStrengthItems(level, week, day, profile, phase) {
  if (day === 4) {
    return [
      `Power clean 6x2 at ${percent(phase.oly)} (${kg(profile.maxes.cleanJerk, phase.oly)})`,
      `Front squat ${phase.reps} at ${percent(phase.front)} (${kg(profile.maxes.frontSquat, phase.front)})`,
    ];
  }
  if (day === 5) {
    return [
      "Zone 2 engine: 4x4 min smooth row, bike, or run; 1 min easy between",
      "Shoulder support: 3 sets of 12 face pulls, 10 external rotations, and 30 sec side plank per side",
    ];
  }

  const deload = week === 4;
  const testWeek = week === 8;
  const sets = deload ? 2 : week >= 5 ? 5 : 4;
  const levelWork = {
    highPull: {
      1: `${sets} sets: 2-4 strict chest-to-bar or band-assisted high pulls + 3 explosive hip-to-bar pulls; rest 2:00`,
      2: `${sets} sets: 3 low-bar foot-assisted turnovers + 3 deep straight-bar dips + 1 slow transition negative`,
      3: testWeek
        ? "Test: take up to 5 fully rested bar muscle-up attempts; after two misses, return to clean assisted turnovers"
        : week >= 6
          ? "Fresh skill transfer: 4-6 single attempts with 2:00-3:00 rest; stop after two misses, then complete 3 clean assisted turnovers"
          : `${sets} rounds: 2 high pulls + 2 fast low-bar turnovers + 20 sec hollow/arch tension`,
    },
    assisted: {
      1: `${sets} sets: 3 strict chest-to-bar pulls + 3 hip-to-bar pulls using only the assistance needed; rest 2:00`,
      2: `${sets} sets: 2-4 banded or jumping bar muscle-ups + 3 deep straight-bar dips; reduce assistance only when turnover speed stays sharp`,
      3: testWeek
        ? "Test: take up to 5 fully rested unassisted attempts, then record the lightest assistance that produces three clean reps"
        : week >= 5
          ? "Fresh transfer: 3-5 unassisted single attempts with full rest, then 3x2 clean assisted reps; stop after two misses"
          : `${sets} rounds: 3 assisted full transitions + 1 slow negative + 20 sec hollow hold`,
    },
    singles: {
      1: `${sets} sets: 1-3 unbroken bar muscle-ups or quality singles; rest 2:00 and keep one rep in reserve`,
      2: `${sets} sets: 2 fast low-bar turnovers + 3 deep straight-bar dips + 1 controlled bar muscle-up negative`,
      3: testWeek
        ? "Test: 8 min to accumulate quality bar muscle-ups without misses; record total reps and best unbroken set"
        : week >= 5
          ? "Skill density: every 2:00 for 6 rounds, complete 1-3 bar muscle-ups; stop each set before form changes"
          : `${sets} rounds: 1-2 bar muscle-ups + 3 chest-to-bar pull-ups + 20 sec hollow/arch tension`,
    },
  }[level];
  return [
    `Bar muscle-up focus — ${day === 1 ? "pull and kip" : day === 2 ? "turnover" : "attempts and transfer"}: ${levelWork[day]}`,
    deload
      ? "Deload rule: use roughly half the normal repetitions and finish fresh"
      : "Quality rule: no failed volume; end the drill when timing or shoulder position changes",
  ];
}

function barMuscleUpMobility(day) {
  return [
    day <= 3
      ? "Lats, pecs, triceps, forearms, and gentle shoulder extension"
      : "Easy lats, pecs, hip flexors, and thoracic rotation",
    "2 min nasal breathing to downshift",
    "Log the best successful progression and any misses or discomfort",
  ];
}

function capBarMuscleUpWorkoutReps(definition, maximumReps) {
  const capExercise = (exercise) => {
    if (
      exercise?.movement !== "bar muscle-ups" ||
      exercise.target?.type !== "reps"
    ) {
      return exercise;
    }
    return {
      ...exercise,
      target: {
        ...exercise.target,
        value: Math.min(maximumReps, Number(exercise.target.value) || 1),
      },
    };
  };
  const capExercises = (exercises) => arrayOrEmpty(exercises).map(capExercise);
  return {
    ...definition,
    buyIn: capExercises(definition.buyIn),
    exercises: capExercises(definition.exercises),
    afterEachRound: capExercises(definition.afterEachRound),
    cashOut: capExercises(definition.cashOut),
    format:
      definition.format?.type === "emom"
        ? {
            ...definition.format,
            stations: definition.format.stations.map((station) => ({
              ...station,
              exercises: capExercises(station.exercises),
            })),
          }
        : definition.format,
  };
}

function claimUniqueGeneratedWod(factory, generationContext) {
  const signatures = generationContext && generationContext.usedWodSignatures;
  if (!(signatures instanceof Set)) {
    return validateWorkoutDefinition(factory(0));
  }

  for (let collisionSalt = 0; collisionSalt < 64; collisionSalt += 1) {
    let workoutDefinition;
    try {
      workoutDefinition = validateWorkoutDefinition(factory(collisionSalt));
    } catch (error) {
      if (error instanceof WorkoutValidationError) continue;
      throw error;
    }
    const signature = structuralWodSignature(workoutDefinition);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    return workoutDefinition;
  }

  throw new Error(
    "Could not create a valid, unique workout for this programme.",
  );
}

function structuralWodSignature(wod) {
  const definition = wod && wod.workoutDefinition ? wod.workoutDefinition : wod;
  if (
    definition &&
    typeof definition === "object" &&
    !Array.isArray(definition) &&
    definition.format
  ) {
    const progression = definition.progression || { type: "none" };
    return JSON.stringify({
      format: definition.format.type,
      benchmark: normalizeStructuralText(definition.format.name),
      progression: progression.type,
      progressionTargets: arrayOrEmpty(progression.appliesTo).slice().sort(),
      main: structuralExercises(workoutMainExercises(definition)),
      afterEachRound: structuralExercises(definition.afterEachRound),
      buyIn: structuralExercises(definition.buyIn),
      cashOut: structuralExercises(definition.cashOut),
    });
  }
  const workout = Array.isArray(wod) ? wod[0] : wod;
  return normalizeStructuralText(workout);
}

function structuralExercises(exercises) {
  return arrayOrEmpty(exercises).map((exercise) => ({
    movement: normalizeStructuralText(exercise && exercise.movement),
    target: exercise?.target?.type || "",
    load: normalizeStructuralText(exercise?.load?.display),
  }));
}

function normalizeStructuralText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?(?:\s*(?:-|\/|:)\s*\d+(?:\.\d+)?)*(?:\+|%)?/g, "#")
    .replace(/\s+/g, " ");
}

function generationVariation(generationContext, week, day, collisionSalt) {
  if (
    !generationContext ||
    !generationContext.seed ||
    generationContext.variationEnabled === false
  )
    return null;
  const seed = normalizeGenerationSeed(generationContext.seed);
  return {
    seed,
    week,
    day,
    collisionSalt,
    formatOffset: seededIndex(
      `${seed}|format|day-${day}|collision-${collisionSalt}`,
      6,
    ),
  };
}

function variationOffset(variation, label, length) {
  if (!variation || !variation.seed || length <= 0) return 0;
  return seededIndex(
    [
      variation.seed,
      label,
      variation.week,
      variation.day,
      variation.collisionSalt,
    ].join("|"),
    length,
  );
}

function seededIndex(seed, length) {
  if (!Number.isFinite(length) || length <= 0) return 0;
  return stableHash(seed) % length;
}

function seededPermutation(length, seed) {
  const values = Array.from({ length }, (_value, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = seededIndex(`${seed}|shuffle-${index}`, index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getGeneratedWeekPhase(week, goal) {
  const base = {
    1: {
      note: "Base week: learn paces and keep 2 reps in reserve.",
      intensity: "Moderate",
      load: 0.7,
      oly: 0.65,
      front: 0.75,
      reps: "5x5",
    },
    2: {
      note: "Build week: add a little load or one small set.",
      intensity: "Moderate",
      load: 0.75,
      oly: 0.7,
      front: 0.8,
      reps: "5x4",
    },
    3: {
      note: "Intensity week: heavier work with cleaner breaks.",
      intensity: "Hard",
      load: 0.82,
      oly: 0.75,
      front: 0.85,
      reps: "6x3",
    },
    4: {
      note: "Deload week: reduce volume and leave the gym fresher.",
      intensity: "Deload",
      load: 0.62,
      oly: 0.6,
      front: 0.68,
      reps: "3x5",
    },
    5: {
      note: "Second build: restart heavier than week 1.",
      intensity: "Moderate",
      load: 0.78,
      oly: 0.72,
      front: 0.82,
      reps: "5x3",
    },
    6: {
      note: "Overload week: lower reps, higher focus.",
      intensity: "Hard",
      load: 0.85,
      oly: 0.8,
      front: 0.87,
      reps: "6x2",
    },
    7: {
      note: "Peak week: heavy singles or doubles without grinding.",
      intensity: "Hard",
      load: 0.9,
      oly: 0.85,
      front: 0.9,
      reps: "5x2",
    },
    8: {
      note: "Test week: lower volume and benchmark one priority.",
      intensity: "Test",
      load: 0.7,
      oly: 0.75,
      front: 0.75,
      reps: "3x3",
    },
  }[week];

  if (goal === "endurance")
    return {
      ...base,
      load: Math.max(0.55, base.load - 0.08),
      front: Math.max(0.6, base.front - 0.08),
    };
  if (goal === "stronger")
    return {
      ...base,
      load: Math.min(0.92, base.load + 0.03),
      front: Math.min(0.92, base.front + 0.02),
    };
  if (goal === "mastersRxOpen")
    return {
      ...base,
      load: Math.min(0.9, base.load + 0.01),
      oly: Math.min(0.85, base.oly + 0.02),
    };
  return base;
}

function generatedDayTitle(goal, day) {
  const titles = {
    stronger: [
      "Squat strength",
      "Olympic lift strength",
      "Front squat and pull",
      "Upper strength plus WOD",
      "Weakness strength",
    ],
    endurance: [
      "Aerobic base",
      "Row intervals",
      "Threshold mixed",
      "Longer engine",
      "Zone 2 plus mobility",
    ],
    gymnastics: [
      "Pulling volume",
      "Toes-to-bar and core",
      "Muscle-up transition",
      "Inverted skill plus WOD",
      "Weakness skill",
    ],
    balanced: [
      "Squat plus short WOD",
      "Snatch plus rowing",
      "Clean and jerk plus pull",
      "Gymnastics plus long WOD",
      "Weakness day",
    ],
    mastersRxOpen: [
      "Squat + TTB capacity",
      "Snatch/OHS + machine pace",
      "Clean/front squat + pulling",
      "Muscle-up/HSPU mixed modal",
      "RX weakness top-up",
    ],
  };
  return titles[goal][day - 1] || titles.balanced[day - 1];
}

function getGeneratedSegmentMinutes(duration, goal) {
  const warmup = duration >= 55 ? 8 : 7;
  const mobility = duration >= 55 ? 8 : 6;
  const available = duration - warmup - mobility;
  const strengthRatio =
    { stronger: 0.58, endurance: 0.35, gymnastics: 0.55, balanced: 0.48 }[
      goal
    ] || 0.48;
  const strength = Math.round(available * strengthRatio);
  return {
    warmup,
    strength,
    wod: available - strength,
    mobility,
  };
}

function generatedWarmup(goal, weakness, day) {
  const bias = goal === "endurance" ? "bike, row, or easy run" : "row or bike";
  return [
    `Easy ${bias} with nasal breathing`,
    "Dynamic hips, ankles, T-spine, and shoulders",
    `${WEAKNESS_LABELS[weakness]} prep: ${weaknessPrep(weakness)}`,
    day % 2 === 0
      ? "Empty-bar or banded movement rehearsal"
      : "Core brace and kip rhythm primer",
  ];
}

function generatedStrengthItems(goal, weakness, day, week, profile, phase) {
  const backSquat = `Back squat ${phase.reps} at ${percent(phase.load)} (${kg(profile.maxes.backSquat, phase.load)})`;
  const frontSquat = `Front squat ${phase.reps} at ${percent(phase.front)} (${kg(profile.maxes.frontSquat, phase.front)})`;
  const snatch = `Snatch technique 6x2 at ${percent(phase.oly)} (${kg(profile.maxes.snatch, phase.oly)})`;
  const cleanJerk = `Clean and jerk 8x1 at ${percent(phase.oly)} (${kg(profile.maxes.cleanJerk, phase.oly)})`;
  const gymnastics = gymnasticsSkillBlock(weakness, week);

  const templates = {
    stronger: [
      [backSquat, weaknessAccessory(weakness, week)],
      [
        snatch,
        `Clean pull 4x3 at ${kg(profile.maxes.cleanJerk, phase.oly + 0.2)}`,
      ],
      [cleanJerk, frontSquat],
      ["Strict press or weighted dip 5x5", gymnastics],
      [backSquat, weaknessAccessory(weakness, week)],
    ],
    endurance: [
      [
        `Back squat 4x3 at ${percent(phase.load)} (${kg(profile.maxes.backSquat, phase.load)})`,
        "Then 6 min smooth sled, bike, or step-up flush",
      ],
      [
        `Row skill: 6x250 m at controlled stroke rate`,
        weaknessAccessory(weakness, week),
      ],
      [cleanJerk, "Tempo front rack lunges 3x8 per leg"],
      ["Mixed engine skill: transitions and breathing practice", gymnastics],
      [
        "Zone 2 strength circuit: 3 rounds easy KB deadlift, ring row, carry",
        weaknessAccessory(weakness, week),
      ],
    ],
    gymnastics: [
      [
        `Back squat 4x4 at ${percent(phase.load)} (${kg(profile.maxes.backSquat, phase.load)})`,
        gymnastics,
      ],
      [gymnastics, weaknessAccessory(weakness, week)],
      [snatch, "Strict pull-up or ring row volume 5 submax sets"],
      [
        "Handstand line, hollow/arch, and dip strength density block",
        gymnastics,
      ],
      [gymnastics, weaknessAccessory(weakness, week)],
    ],
    balanced: [
      [backSquat, gymnasticsSkillBlock("t2b", week)],
      [snatch, `Row technique: 5x300 m smooth, rest 1:00`],
      [cleanJerk, frontSquat],
      [
        gymnasticsSkillBlock("muscleup", week),
        weaknessAccessory(weakness, week),
      ],
      [weaknessAccessory(weakness, week), "Easy loaded carry 4x40 m"],
    ],
  };

  return templates[goal][day - 1] || templates.balanced[day - 1];
}

function generatedWodItems(
  goal,
  weakness,
  day,
  week,
  profile,
  phase,
  wodMinutes,
  variation,
  barMuscleUpLevel,
) {
  const movement = generatedWodMovementPool(
    goal,
    weakness,
    day,
    week,
    profile,
    phase,
    variation,
    barMuscleUpLevel,
  );
  const cap = clamp(Math.round(Number(wodMinutes) || 12), 8, 24);
  return buildWodPattern(week, goal, day, cap, movement, variation, phase);
}

function buildWodPattern(week, goal, day, cap, movement, variation, phase) {
  const intervals = Math.max(3, Math.floor(cap / 3));
  const repeatSets = Math.max(3, Math.floor(cap / 4));
  const rounds = cap >= 16 ? 5 : cap >= 13 ? 4 : 3;
  const benchmarkName = generatedBenchmarkName(goal, day);
  const scaling = `Target intensity: ${phase.intensity}; scale reps, distance, or loading before extending the cap.`;

  const patterns = {
    1: createWorkoutDefinition(
      { type: "amrap", durationSeconds: Math.min(cap, 12) * 60 },
      [movement.weight, movement.monoAmrap, movement.gym],
      {
        stimulus:
          "short-to-medium mixed piece; unbroken early rounds, quick transitions",
        score: "total rounds and reps",
        scaling,
      },
    ),
    2: createWorkoutDefinition(
      {
        type: "intervals",
        intervalSeconds: 180,
        rounds: intervals,
        restRemaining: true,
      },
      [movement.monoInterval, movement.weightLowRep, movement.simpleGym],
      {
        stimulus:
          "repeatable intervals; each set should feel fast but controlled",
        score: "slowest interval split",
        scaling,
      },
    ),
    3: createWorkoutDefinition(
      { type: "fixed_rounds", rounds, durationSeconds: cap * 60 },
      [movement.monoInterval, movement.gym, movement.weight],
      {
        stimulus: "medium for-time test; hold one repeatable break plan",
        score: "finish time or completed reps at cap",
        scaling,
      },
    ),
    4: createWorkoutDefinition(
      {
        type: "emom",
        intervalSeconds: 60,
        rounds: Math.max(1, Math.floor(cap / 4)),
        stations: [
          { type: "work", exercises: [movement.weakness] },
          { type: "work", exercises: [movement.easyMono] },
          { type: "work", exercises: [movement.simpleGym] },
          { type: "rest" },
        ],
      },
      [],
      {
        stimulus: "deload skill conditioning; leave fresher than you started",
        score: "quality completed, no failed reps",
        scaling,
      },
    ),
    5: createWorkoutDefinition(
      { type: "amrap", durationSeconds: cap * 60 },
      [
        asProgressiveExercise(movement.weightLowRep),
        asProgressiveExercise(movement.gym),
      ],
      {
        progression: {
          type: "ascending_ladder",
          start: 2,
          increment: 2,
          appliesTo: [movement.weightLowRep.id, movement.gym.id],
        },
        afterEachRound: [movement.shortMono],
        stimulus: "second-wave density piece; manageable reps that accumulate",
        score: "last completed round plus reps",
        scaling,
      },
    ),
    6: createWorkoutDefinition(
      { type: "repeat_sets", sets: repeatSets, restSeconds: 60 },
      [movement.monoInterval, movement.weight, movement.simpleGym],
      {
        stimulus:
          "hard repeat efforts; pacing should not fade more than 10 percent",
        score: "total working time",
        scaling,
      },
    ),
    7: createWorkoutDefinition(
      { type: "chipper", durationSeconds: cap * 60 },
      movement.chipper,
      {
        stimulus:
          "longer mixed chipper; controlled opening pace, strong finish",
        score: "finish time or reps completed",
        scaling,
      },
    ),
    8: createWorkoutDefinition(
      { type: "benchmark", name: benchmarkName, durationSeconds: cap * 60 },
      movement.benchmark,
      {
        stimulus:
          "test week; compare against future cycles without changing standards",
        score: "benchmark result",
        scaling,
      },
    ),
  };

  const variablePatternWeeks = [1, 2, 3, 5, 6, 7];
  const variableIndex = variablePatternWeeks.indexOf(week);
  if (variation && variableIndex >= 0) {
    return patterns[
      variablePatternWeeks[
        (variableIndex + variation.formatOffset) % variablePatternWeeks.length
      ]
    ];
  }
  return patterns[week];
}

function createWorkoutDefinition(format, exercises, options = {}) {
  return {
    schemaVersion: WORKOUT_DEFINITION_VERSION,
    format,
    progression: options.progression || { type: "none" },
    buyIn: options.buyIn || [],
    exercises: exercises || [],
    afterEachRound: options.afterEachRound || [],
    cashOut: options.cashOut || [],
    stimulus:
      options.stimulus || "repeatable work with consistent movement standards",
    score: options.score || "completed work",
    scaling:
      options.scaling ||
      "Scale reps, distance, or loading before changing the intended format.",
  };
}

function asProgressiveExercise(exercise) {
  return { ...exercise, target: { type: "progressive_reps" } };
}

function inferWorkoutTimer(session) {
  if (session?.workoutDefinition) {
    return timerConfigFromWorkoutDefinition(session.workoutDefinition);
  }
  if (!session || !Array.isArray(session.segments)) return null;
  const timedSegment = session.segments.find((segment) =>
    /WOD|Engine/i.test(segment.title || ""),
  );
  const workout =
    timedSegment && Array.isArray(timedSegment.items)
      ? timedSegment.items[0]
      : "";
  return inferTimerFromText(workout);
}

function timerConfigFromWorkoutDefinition(definition) {
  validateWorkoutDefinition(definition);
  const format = definition.format;
  const workout = renderWorkoutDescription(definition);
  if (format.type === "amrap") {
    return timerConfig("amrap", workout, format.durationSeconds, {
      label: `AMRAP ${formatSecondsForLabel(format.durationSeconds)}`,
    });
  }
  if (format.type === "emom") {
    const rounds = format.rounds * format.stations.length;
    return timerConfig("emom", workout, rounds * format.intervalSeconds, {
      rounds,
      intervalSeconds: format.intervalSeconds,
      label: `EMOM ${formatSecondsForLabel(rounds * format.intervalSeconds)}`,
    });
  }
  if (format.type === "intervals") {
    return timerConfig(
      "interval",
      workout,
      format.rounds * format.intervalSeconds,
      {
        rounds: format.rounds,
        intervalSeconds: format.intervalSeconds,
        label: `${format.rounds} intervals of ${formatSeconds(format.intervalSeconds)}`,
      },
    );
  }
  if (
    ["fixed_rounds", "for_time", "chipper", "benchmark"].includes(format.type)
  ) {
    return timerConfig("forTime", workout, format.durationSeconds || null, {
      label: `For time cap ${formatSecondsForLabel(format.durationSeconds)}`,
    });
  }
  if (format.type === "repeat_sets") {
    return timerConfig("rest", workout, format.sets * format.restSeconds, {
      rounds: format.sets,
      intervalSeconds: format.restSeconds,
      label: `${format.sets} rest breaks of ${formatSeconds(format.restSeconds)}`,
    });
  }
  return null;
}

function formatSecondsForLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function inferTimerFromText(value) {
  const workout = String(value || "").trim();
  if (!workout) return null;
  const compact = workout.replace(/\s+/g, " ");
  const lower = compact.toLowerCase();

  if (/tabata/.test(lower)) {
    return timerConfig("tabata", compact, 240, {
      rounds: 8,
      intervalSeconds: 30,
      label: "Tabata 8 x :20/:10",
    });
  }

  const amrap = lower.match(/\bamrap\s+(\d{1,2})\b/);
  if (amrap) {
    const minutes = Number(amrap[1]);
    return timerConfig("amrap", compact, minutes * 60, {
      label: `AMRAP ${minutes}:00`,
    });
  }

  const emom = lower.match(/\bemom\s+(\d{1,2})\b/);
  if (emom) {
    const minutes = Number(emom[1]);
    return timerConfig("emom", compact, minutes * 60, {
      intervalSeconds: 60,
      rounds: minutes,
      label: `EMOM ${minutes}:00`,
    });
  }

  const every = lower.match(
    /\bevery\s+(\d{1,2})(?::(\d{2}))?\s*min\s*x\s*(\d{1,2})\b/,
  );
  if (every) {
    const intervalSeconds = Number(every[1]) * 60 + Number(every[2] || 0);
    const rounds = Number(every[3]);
    return timerConfig("interval", compact, intervalSeconds * rounds, {
      intervalSeconds,
      rounds,
      label: `${rounds} intervals of ${formatSeconds(intervalSeconds)}`,
    });
  }

  const cap = lower.match(/(\d{1,2})\s*min\s*cap/);
  if (/for time|rounds for time|benchmark/.test(lower) && cap) {
    const minutes = Number(cap[1]);
    return timerConfig("forTime", compact, minutes * 60, {
      label: `For time cap ${minutes}:00`,
    });
  }

  const setsRest = lower.match(
    /(\d{1,2})\s+sets?,\s*rest\s+(\d{1,2})(?::(\d{2}))?/,
  );
  if (setsRest) {
    const rounds = Number(setsRest[1]);
    const restSeconds =
      Number(setsRest[2]) * (setsRest[3] ? 60 : 1) + Number(setsRest[3] || 0);
    return timerConfig("rest", compact, rounds * restSeconds, {
      rounds,
      intervalSeconds: restSeconds,
      label: `${rounds} rest breaks of ${formatSeconds(restSeconds)}`,
    });
  }

  const rest = lower.match(/\brest\s+(\d{1,2})(?::(\d{2}))\b/);
  if (rest) {
    const restSeconds = Number(rest[1]) * 60 + Number(rest[2]);
    return timerConfig("rest", compact, restSeconds, {
      intervalSeconds: restSeconds,
      label: `Rest ${formatSeconds(restSeconds)}`,
    });
  }

  return null;
}

function timerConfig(mode, workout, plannedSeconds, options = {}) {
  return {
    mode,
    source: "inferred",
    workout,
    plannedSeconds,
    rounds: options.rounds || null,
    intervalSeconds: options.intervalSeconds || null,
    label: options.label || timerModeLabel(mode),
  };
}

function timerDisplaySeconds(mode, plannedSeconds, elapsedSeconds) {
  if (mode === "forTime") return elapsedSeconds;
  if (Number.isFinite(plannedSeconds))
    return Math.max(0, plannedSeconds - elapsedSeconds);
  return elapsedSeconds;
}

function timerModeLabel(mode) {
  const labels = {
    amrap: "AMRAP",
    emom: "EMOM",
    forTime: "For time",
    interval: "Intervals",
    tabata: "Tabata",
    rest: "Rest",
  };
  return labels[mode] || "Timer";
}

function formatTimerResult(result) {
  if (!result) return "";
  const mode = timerModeLabel(result.mode);
  const elapsed = formatSeconds(Number(result.elapsedSeconds) || 0);
  const splitCount = Array.isArray(result.splits) ? result.splits.length : 0;
  return splitCount
    ? `${mode} ${elapsed}, ${splitCount} splits`
    : `${mode} ${elapsed}`;
}

function generatedWodMovementPool(
  goal,
  weakness,
  day,
  week,
  profile,
  _phase,
  variation,
  barMuscleUpLevel,
) {
  const cleanLoad = kg(
    profile.maxes.cleanJerk,
    goal === "stronger" ? 0.65 : 0.55,
  );
  const lightCleanLoad = kg(
    profile.maxes.cleanJerk,
    goal === "stronger" ? 0.55 : 0.45,
  );
  const snatchLoad = kg(
    profile.maxes.snatch,
    goal === "stronger" ? 0.55 : 0.45,
  );
  const monoOptions =
    goal === "endurance"
      ? ["row", "bike", "run", "ski", "shuttle run"]
      : ["row", "bike", "run", "double unders", "ski"];
  const mono = (() => {
    if (weakness === "rowing" && day === 2) return "row";
    if (["running", "runningBodyweight"].includes(weakness) && day % 2 === 0) {
      return "run";
    }
    return pick(
      monoOptions,
      week +
        day +
        variationOffset(variation, "monostructural", monoOptions.length),
    );
  })();
  const gymOptions = {
    stronger: [
      repsExercise("gymnastics", "toes-to-bar", 8),
      repsExercise("gymnastics", "box jumps", 8),
      repsExercise("gymnastics", "push-ups", 10),
      repsExercise("gymnastics", "chest-to-bar pull-ups", 6),
      repsExercise("gymnastics", "wall balls", 12),
    ],
    endurance: [
      repsExercise("gymnastics", "burpees", 10),
      repsExercise("gymnastics", "wall balls", 14),
      repsExercise("gymnastics", "sit-ups", 12),
      repsExercise("gymnastics", "box step-overs", 10),
      repsExercise("gymnastics", "air squats", 12),
    ],
    gymnastics: [
      repsExercise("gymnastics", "pull-ups", 8),
      repsExercise("gymnastics", "toes-to-bar", 10),
      repsExercise("gymnastics", "bar muscle-up transitions", 4),
      repsExercise("gymnastics", "wall walk", 1),
      durationExercise("gymnastics", "handstand hold", 30),
    ],
    balanced: [
      repsExercise("gymnastics", "pull-ups", 10),
      repsExercise("gymnastics", "wall balls", 12),
      repsExercise("gymnastics", "toes-to-bar", 10),
      repsExercise("gymnastics", "burpees", 8),
      repsExercise("gymnastics", "air squats", 15),
    ],
  };
  const weightOptions = {
    stronger: [
      repsExercise("weighted", "power cleans", 6, cleanLoad),
      repsExercise("weighted", "DB front squats", 8),
      repsExercise(
        "weighted",
        "deadlifts",
        6,
        kg(profile.maxes.cleanJerk, 0.85),
      ),
      repsExercise("weighted", "DB snatches", 8),
      repsExercise("weighted", "push jerks", 6, lightCleanLoad),
    ],
    endurance: [
      repsExercise("weighted", "light KB swings", 12),
      repsExercise("weighted", "DB snatches", 10),
      repsExercise("weighted", "goblet squats", 12),
      repsExercise("weighted", "power cleans", 8, lightCleanLoad),
      repsExercise("weighted", "alternating DB step-ups", 16),
    ],
    gymnastics: [
      repsExercise("weighted", "DB snatches", 8, snatchLoad),
      repsExercise("weighted", "light KB swings", 10),
      repsExercise("weighted", "overhead squats", 8, snatchLoad),
      repsExercise("weighted", "medicine-ball cleans", 10),
      repsExercise("weighted", "DB lunges", 12),
    ],
    balanced: [
      repsExercise("weighted", "power cleans", 8, lightCleanLoad),
      repsExercise("weighted", "overhead squats", 8, snatchLoad),
      repsExercise("weighted", "DB snatches", 10),
      repsExercise("weighted", "KB swings", 12),
      repsExercise("weighted", "clean and jerks", 8, lightCleanLoad),
    ],
  };

  const selectedGymOptions = gymOptions[goal] || gymOptions.balanced;
  const selectedWeightOptions = weightOptions[goal] || weightOptions.balanced;
  const simpleGymOptions = [
    repsExercise("simple-gym", "burpees", 8),
    repsExercise("simple-gym", "sit-ups", 10),
    repsExercise("simple-gym", "push-ups", 10),
    repsExercise("simple-gym", "air squats", 12),
    repsExercise("simple-gym", "ring rows", 8),
  ];
  const gym = pick(
    selectedGymOptions,
    week +
      day +
      variationOffset(variation, "gymnastics", selectedGymOptions.length),
  );
  const weight = pick(
    selectedWeightOptions,
    week +
      day * 2 +
      variationOffset(variation, "weighted", selectedWeightOptions.length),
  );
  const simpleGym = pick(
    simpleGymOptions,
    week +
      day * 3 +
      variationOffset(variation, "simple-gym", simpleGymOptions.length),
  );
  const weaknessMove = weaknessWodMovement(weakness, week, barMuscleUpLevel);

  return {
    mono,
    monoAmrap: monoAmrap(mono, goal),
    monoInterval: monoInterval(mono, goal),
    shortMono: shortMono(mono),
    easyMono: durationExercise("easy-monostructural", `easy ${mono}`, 45),
    gym,
    simpleGym,
    weakness: weaknessMove,
    weight,
    weightLowRep: lowerRepExercise(weight),
    chipper: generatedChipper(goal, weaknessMove, mono, gym, weight),
    benchmark: generatedBenchmark(goal, day, mono, gym, weight, weaknessMove),
  };
}

function monoAmrap(mono, goal) {
  if (["row", "bike", "ski"].includes(mono)) {
    return caloriesExercise(
      "monostructural",
      mono,
      goal === "endurance" ? 14 : 10,
      goal === "endurance" ? 11 : 8,
    );
  }
  if (mono === "run") {
    return distanceExercise(
      "monostructural",
      "run",
      goal === "endurance" ? 200 : 100,
    );
  }
  if (mono === "shuttle run") {
    return repsExercise("monostructural", "shuttle runs", 8);
  }
  return repsExercise(
    "monostructural",
    "double unders",
    goal === "endurance" ? 40 : 30,
  );
}

function generatedChipper(goal, weaknessMove, mono, gym, weight) {
  return [
    withExerciseId(monoInterval(mono, goal), "chipper-opening"),
    repsExercise("chipper-air-squats", "air squats", 40),
    withFixedExerciseTarget(gym, "chipper-gymnastics", 30),
    withFixedExerciseTarget(weight, "chipper-weighted", 20),
    withFixedExerciseTarget(weaknessMove, "chipper-weakness", 10),
    withExerciseId(shortMono(mono), "chipper-closing"),
  ];
}

function generatedBenchmark(goal, day, mono, gym, weight, weaknessMove) {
  const benchmarks = {
    stronger: [
      [
        withFixedExerciseTarget(weight, "benchmark-weight", 3),
        repsExercise("benchmark-gym", "box jumps", 6),
      ],
      [
        withExerciseId(monoInterval(mono, goal), "benchmark-mono"),
        withFixedExerciseTarget(weight, "benchmark-weight", 5),
      ],
      [
        withFixedExerciseTarget(weight, "benchmark-weight", 5),
        withFixedExerciseTarget(gym, "benchmark-gym", 7),
        repsExercise("benchmark-wall-balls", "wall balls", 9),
      ],
      [
        repsExercise("benchmark-push", "strict push-ups", 6),
        repsExercise("benchmark-swing", "KB swings", 8),
        caloriesExercise("benchmark-bike", "bike", 10),
      ],
      [
        withExerciseId(weaknessMove, "benchmark-weakness"),
        withExerciseId(shortMono(mono), "benchmark-mono"),
        distanceExercise("benchmark-carry", "loaded carry", 40),
      ],
    ],
    endurance: [
      [distanceExercise("benchmark-mono", mono, 1000)],
      [withExerciseId(monoInterval(mono, goal), "benchmark-mono")],
      [
        distanceExercise("benchmark-run", "run", 400),
        repsExercise("benchmark-wall-balls", "wall balls", 15),
        repsExercise("benchmark-situps", "sit-ups", 12),
      ],
      [
        distanceExercise("benchmark-opening", mono, 800),
        repsExercise("benchmark-squats", "air squats", 60),
        repsExercise("benchmark-burpees", "burpees", 40),
        distanceExercise("benchmark-closing", mono, 800),
      ],
      [durationExercise("benchmark-zone-two", `zone 2 ${mono}`, 60)],
    ],
    gymnastics: [
      [
        repsExercise("benchmark-pullups", "pull-ups", 5),
        repsExercise("benchmark-pushups", "push-ups", 10),
        repsExercise("benchmark-squats", "air squats", 15),
      ],
      [
        repsExercise("benchmark-t2b", "toes-to-bar", 8),
        repsExercise("benchmark-burpees", "burpees", 8),
        withExerciseId(shortMono(mono), "benchmark-mono"),
      ],
      [
        withExerciseId(weaknessMove, "benchmark-weakness"),
        withExerciseId(shortMono(mono), "benchmark-mono"),
      ],
      [
        repsExercise("benchmark-wallwalk", "wall walks", 2),
        repsExercise("benchmark-situps", "sit-ups", 12),
        distanceExercise("benchmark-run", "run", 200),
      ],
      [
        withExerciseId(weaknessMove, "benchmark-weakness"),
        repsExercise("benchmark-hollow", "hollow rocks", 20),
        durationExercise("benchmark-machine", "easy machine", 45),
      ],
    ],
    balanced: [
      [
        withExerciseId(weight, "benchmark-weight"),
        repsExercise("benchmark-box", "box jump-overs", 10),
        withExerciseId(shortMono(mono), "benchmark-mono"),
      ],
      [
        withExerciseId(monoInterval(mono, goal), "benchmark-mono"),
        repsExercise("benchmark-ohs", "overhead squats", 8),
        repsExercise("benchmark-burpees", "burpees", 10),
      ],
      [
        distanceExercise("benchmark-run", "run", 200),
        repsExercise("benchmark-pullups", "pull-ups", 10),
        repsExercise("benchmark-wallballs", "wall balls", 12),
      ],
      [
        distanceExercise("benchmark-run", "run", 400),
        repsExercise("benchmark-pullups", "pull-ups", 10),
        repsExercise("benchmark-pushups", "push-ups", 15),
        repsExercise("benchmark-squats", "air squats", 20),
      ],
      [
        withExerciseId(weaknessMove, "benchmark-weakness"),
        withExerciseId(shortMono(mono), "benchmark-mono"),
        repsExercise("benchmark-barbell", "light barbell reps", 8),
        repsExercise("benchmark-core", "core reps", 12),
      ],
    ],
  };
  return pick(benchmarks[goal] || benchmarks.balanced, day - 1);
}

function generatedBenchmarkName(goal, day) {
  const names = {
    stronger: [
      "Barbell sprint",
      "Power intervals",
      "Heavy triplet",
      "Upper stamina",
      "Weakness repeat",
    ],
    endurance: [
      "Mono engine",
      "Split control",
      "Threshold triplet",
      "Long chipper",
      "Zone 2 check",
    ],
    gymnastics: [
      "Bodyweight repeat",
      "Midline EMOM",
      "Skill density",
      "Inverted control",
      "Weakness repeat",
    ],
    balanced: [
      "Mixed baseline",
      "Row-barbell repeat",
      "Run-pull triplet",
      "Cindy-style engine",
      "Weakness EMOM",
    ],
    mastersRxOpen: [
      "Wall-ball engine",
      "OHS shuttle repeat",
      "Thruster ladder",
      "Gymnastics chipper",
      "Masters RX retest",
    ],
  };
  return pick(names[goal] || names.balanced, day - 1);
}

function weaknessWodMovement(weakness, week, barMuscleUpLevel) {
  const reps = week >= 5 ? 8 : 6;
  const movements = {
    squat: repsExercise("weakness", "tempo goblet squats", reps),
    olympic: repsExercise("weakness", "hang power clean drills", reps),
    rowing: distanceExercise("weakness", "technique row", 250),
    running: distanceExercise("weakness", "relaxed run", 200),
    runningBodyweight: repsExercise("weakness", "burpees", reps),
    pulling: repsExercise("weakness", "strict pull-ups or ring rows", reps),
    muscleup:
      barMuscleUpLevel === "singles" && week >= 5
        ? repsExercise("weakness", "bar muscle-ups", 2)
        : repsExercise(
            "weakness",
            "bar muscle-up transitions",
            Math.max(3, reps - 3),
          ),
    t2b: repsExercise("weakness", "toes-to-bar or hanging knee raises", reps),
  };
  return movements[weakness];
}

function monoInterval(mono, goal) {
  if (mono === "run") {
    return distanceExercise(
      "monostructural",
      "run",
      goal === "endurance" ? 400 : 200,
    );
  }
  if (mono === "row") {
    return distanceExercise(
      "monostructural",
      "row",
      goal === "endurance" ? 500 : 250,
    );
  }
  if (mono === "bike") {
    return caloriesExercise(
      "monostructural",
      "bike",
      goal === "endurance" ? 18 : 12,
      goal === "endurance" ? 14 : 9,
    );
  }
  if (mono === "ski") {
    return distanceExercise(
      "monostructural",
      "ski",
      goal === "endurance" ? 400 : 250,
    );
  }
  if (mono === "shuttle run")
    return repsExercise("monostructural", "shuttle runs", 10);
  return repsExercise("monostructural", "double unders", 50);
}

function shortMono(mono) {
  if (mono === "run") return distanceExercise("after-round", "run", 100);
  if (mono === "row") return distanceExercise("after-round", "row", 150);
  if (mono === "bike") return caloriesExercise("after-round", "bike", 8, 6);
  if (mono === "ski") return distanceExercise("after-round", "ski", 150);
  if (mono === "shuttle run")
    return repsExercise("after-round", "shuttle runs", 5);
  return repsExercise("after-round", "double unders", 30);
}

function lowerRepExercise(exercise) {
  const replacements = { 12: 8, 10: 7, 8: 6, 6: 5, 16: 10 };
  const value = Number(exercise.target?.value);
  return {
    ...exercise,
    target: {
      ...exercise.target,
      value: replacements[value] || value,
    },
  };
}

function repsExercise(id, movement, value, load) {
  return exerciseDefinition(id, movement, { type: "reps", value }, load);
}

function distanceExercise(id, movement, value) {
  return exerciseDefinition(id, movement, { type: "distance_m", value });
}

function caloriesExercise(id, movement, value, alternate) {
  return exerciseDefinition(id, movement, {
    type: "calories",
    value,
    ...(alternate ? { alternate } : {}),
  });
}

function durationExercise(id, movement, value) {
  return exerciseDefinition(id, movement, { type: "duration_seconds", value });
}

function exerciseDefinition(id, movement, target, load) {
  return {
    id,
    movement,
    target,
    ...(load ? { load: { display: load } } : {}),
  };
}

function withExerciseId(exercise, id) {
  return { ...exercise, id };
}

function withFixedExerciseTarget(exercise, id, reps) {
  if (exercise.target?.type === "reps") {
    return { ...exercise, id, target: { type: "reps", value: reps } };
  }
  return { ...exercise, id };
}

function generatedMobility(weakness) {
  return [
    weaknessMobility(weakness),
    "2 min nasal breathing to downshift",
    "Write one note: what to repeat, scale, or push next time",
  ];
}

function weaknessPrep(weakness) {
  const prep = {
    squat: "tempo air squats and ankle rocks",
    olympic: "PVC high pulls, muscle snatch, and front rack",
    rowing: "pause row drill and stroke-rate control",
    running: "ankle hops, calf raises, and relaxed strides",
    runningBodyweight:
      "ankle hops, relaxed strides, push-ups, and controlled air squats",
    pulling: "scap pull-ups and active hangs",
    muscleup: "false grip or low-bar transition rehearsal",
    t2b: "hollow/arch swings and hanging knee raises",
  };
  return prep[weakness];
}

function weaknessAccessory(weakness, week) {
  const reps = week >= 5 ? "4 sets" : "3 sets";
  const accessories = {
    squat: `${reps}: 8 tempo goblet squats + 8 split squats per leg`,
    olympic: `${reps}: tall clean/snatch pulls + overhead or front rack holds`,
    rowing: `${reps}: 90 sec row at perfect technique, easy rest`,
    running: `${reps}: 200 m relaxed strides or incline treadmill walk`,
    runningBodyweight: `${reps}: 200 m relaxed run + 8 push-ups + 12 air squats`,
    pulling: `${reps}: strict pull-up negatives, ring rows, and active hang`,
    muscleup: `${reps}: low-bar transitions, deep dips, and slow negatives`,
    t2b: `${reps}: kip swings, hanging knee raises, and hollow rocks`,
  };
  return accessories[weakness];
}

function gymnasticsSkillBlock(weakness, week) {
  if (weakness === "muscleup")
    return week >= 6
      ? "Muscle-up practice: 6-10 quality singles or banded transitions, full rest"
      : "Muscle-up base: transition drill, dip strength, slow negative";
  if (weakness === "t2b")
    return week >= 6
      ? "Toes-to-bar EMOM 8: 6-9 reps, never to failure"
      : "Toes-to-bar base: kip swings, knee raises, hollow rocks";
  if (weakness === "pulling")
    return week >= 6
      ? "Pulling density: 8 min submax pull-up or chest-to-bar sets"
      : "Pulling base: strict pulls, ring rows, active hangs";
  if (weakness === "runningBodyweight")
    return week >= 6
      ? "Bodyweight density: 8 min of submax push-up, pull-up, and air-squat sets"
      : "Bodyweight base: strict push-ups, ring rows, air squats, and hollow holds";
  return "Gymnastics skill: hollow/arch control, strict pulling, and midline strength";
}

function weaknessMobility(weakness) {
  const mobility = {
    squat: "Couch stretch, ankle dorsiflexion, and deep squat breathing",
    olympic: "Front rack, lats, pecs, T-spine extension",
    rowing: "Hamstrings, hip flexors, and easy thoracic rotation",
    running: "Calves, hip flexors, and foot/ankle tissue work",
    runningBodyweight:
      "Calves, hip flexors, ankles, pecs, and easy thoracic rotation",
    pulling: "Lats, pecs, forearms, and 60 sec active-passive hang",
    muscleup: "Pecs, lats, triceps, forearms, and gentle shoulder extension",
    t2b: "Lats, hip flexors, hamstrings, and hollow breathing",
  };
  return mobility[weakness];
}

function buildMastersRxOpenSession(
  options,
  profile,
  week,
  day,
  idFactory,
  generationContext,
) {
  const phase = getGeneratedWeekPhase(week, "mastersRxOpen");
  const title = generatedDayTitle("mastersRxOpen", day);
  const segmentMinutes = getGeneratedSegmentMinutes(
    options.duration,
    day === 2 ? "endurance" : day === 4 ? "gymnastics" : "balanced",
  );
  const templates = mastersRxSessionTemplates(profile, week, phase);
  const template = templates[day] || templates[1];
  const isWeaknessDay = day === options.daysPerWeek;
  const selected = isWeaknessDay
    ? {
        ...template,
        warmup: [
          template.warmup[0],
          `${WEAKNESS_LABELS[options.weakness]} prep: ${weaknessPrep(options.weakness)}`,
          ...template.warmup.slice(2),
        ],
        strength: [
          ...template.strength.slice(0, -1),
          weaknessAccessory(options.weakness, week),
        ],
        mobility: [
          weaknessMobility(options.weakness),
          ...template.mobility.slice(1),
        ],
      }
    : template;
  const workoutDefinition = claimUniqueGeneratedWod(
    (collisionSalt) =>
      mastersRxWorkoutDefinition(
        week,
        day,
        profile,
        wallBallVolumeForWeek(week),
        generationVariation(generationContext, week, day, collisionSalt),
      ),
    generationContext,
  );

  const session = {
    id: idFactory(`generated-masters-rx-open-w${week}-d${day}`),
    week,
    title: `W${week} D${day}: ${title}`,
    focus: `Men Masters 35-39 RX prep with ${WEAKNESS_LABELS[options.weakness].toLowerCase()} priority. ${phase.note} Build Open standards without failed skill reps.`,
    warmup: selected.warmup,
    strength: selected.strength,
    workoutDefinition,
    mobility: selected.mobility,
    addOns: mastersRxAddOns(week, day),
    duration: options.duration,
    segmentMinutes,
    intensity: phase.intensity,
    generated: true,
    wodSchemaVersion: WOD_SCHEMA_VERSION,
    sourceGoal: options.goal,
    sourceWeakness: options.weakness,
    createdAt: new Date().toISOString(),
  };
  if (generationContext && generationContext.seed) {
    session.generationSeed = generationContext.seed;
    session.origin = "generated";
    session.customized = false;
  }
  return session;
}

function wallBallVolumeForWeek(week) {
  return {
    1: 80,
    2: 100,
    3: 120,
    4: 70,
    5: 110,
    6: 130,
    7: 150,
    8: 100,
  }[week];
}

function mastersRxSessionTemplates(profile, week, phase) {
  const t2b = { 1: 7, 2: 8, 3: 9, 4: 6, 5: 8, 6: 10, 7: 12, 8: 8 }[week];
  const c2b = { 1: 5, 2: 6, 3: 7, 4: 4, 5: 6, 6: 8, 7: 10, 8: 6 }[week];
  const bmu = {
    1: "transition practice",
    2: "singles or low-bar transitions",
    3: "2-4 quality singles",
    4: "low-volume transitions",
    5: "3-6 singles",
    6: "EMOM 8: 1-2 reps",
    7: "test 8 min quality reps",
    8: "benchmark set or transition max",
  }[week];
  const wallBallVolume = wallBallVolumeForWeek(week);

  return {
    1: {
      warmup: [
        "3 min easy row",
        "Dynamic hips, ankles, T-spine",
        "2 rounds: 10 air squats, 8 kip swings, 6 burpees",
      ],
      strength: [
        `Back squat ${phase.reps} at ${percent(phase.load)} (${kg(profile.maxes.backSquat, phase.load)})`,
        `Toes-to-bar EMOM 8: ${t2b} reps, stop before grip or rhythm breaks`,
      ],
      wod: mastersRxWod(week, 1, profile, wallBallVolume),
      mobility: [
        "Ankles, hip flexors, lats",
        "2 min nasal breathing",
        "Log wall-ball and TTB break plan",
      ],
    },
    2: {
      warmup: [
        "Easy bike or row",
        "Shoulder and overhead squat prep",
        "PVC snatch balance and tall snatch",
      ],
      strength: [
        `Snatch complex 5x(1 hang power + 1 OHS) at ${percent(phase.oly)} (${kg(profile.maxes.snatch, phase.oly)})`,
        `Overhead squat 4x5 building to confident sets near ${kg(profile.maxes.snatch, Math.min(0.75, phase.oly + 0.05))}`,
      ],
      wod: mastersRxWod(week, 2, profile, wallBallVolume),
      mobility: [
        "Front rack, lats, T-spine extension",
        "Easy 3 min flush",
        "Write OHS limiting factor",
      ],
    },
    3: {
      warmup: [
        "400 m easy run",
        "Front rack and jerk footwork",
        "Scap pull-ups and hollow rocks",
      ],
      strength: [
        `Clean and jerk 8x1 at ${percent(phase.oly)} (${kg(profile.maxes.cleanJerk, phase.oly)})`,
        `Front squat ${phase.reps} at ${percent(phase.front)} (${kg(profile.maxes.frontSquat, phase.front)})`,
        `Chest-to-bar density: 6 sets of ${c2b}, rest as needed`,
      ],
      wod: mastersRxWod(week, 3, profile, wallBallVolume),
      mobility: [
        "Wrists, front rack, pecs",
        "Easy breathing reset",
        "Log C2B break strategy",
      ],
    },
    4: {
      warmup: [
        "Easy bike",
        "Wrist, shoulder, and hollow/arch prep",
        "Wall walk line drills",
      ],
      strength: [
        `Muscle-up skill: ${bmu}`,
        `Strict HSPU or deficit pike press 5 submax sets`,
        `Clean pull 4x3 at ${percent(Math.min(1.15, phase.oly + 0.25))} of clean and jerk (${kg(profile.maxes.cleanJerk, Math.min(1.15, phase.oly + 0.25))})`,
      ],
      wod: mastersRxWod(week, 4, profile, wallBallVolume),
      mobility: [
        "Shoulders, pecs, calves, forearms",
        "2 min downshift",
        "Log skill misses and no-rep risks",
      ],
    },
    5: {
      warmup: ["Easy machine", "Weakness prep", "Empty-bar cycling"],
      strength: [
        "Pick weakest RX category: 15 min technique density",
        "Keep every rep competition-standard",
      ],
      wod: mastersRxWod(week, 5, profile, wallBallVolume),
      mobility: [
        "Mobility for weakest category",
        "Easy flush",
        "Set next-week focus",
      ],
    },
  };
}

function mastersRxWorkoutDefinition(
  week,
  day,
  profile,
  wallBallVolume,
  variation,
) {
  const variablePatternWeeks = [1, 2, 3, 5, 6, 7];
  const variableIndex = variablePatternWeeks.indexOf(week);
  let variedDay = day;
  let variedWeek = week;

  if (variation && variableIndex >= 0) {
    const assignments = seededPermutation(
      5 * variablePatternWeeks.length,
      `${variation.seed}|masters-rx-structured`,
    );
    const slot = variableIndex * 5 + (day - 1);
    const assignedPattern = assignments[slot];
    variedDay = Math.floor(assignedPattern / variablePatternWeeks.length) + 1;
    variedWeek =
      variablePatternWeeks[assignedPattern % variablePatternWeeks.length];
  } else if (variation) {
    variedDay =
      seededPermutation(5, `${variation.seed}|masters-rx-fixed-${week}`)[
        day - 1
      ] + 1;
  }

  const pool = mastersRxMovementPool(
    variedDay,
    variedWeek,
    profile,
    wallBallVolume,
  );
  const definition = mastersRxPattern(variedWeek, variedDay, pool);
  return varyStructuredMastersWorkout(definition, variation);
}

function mastersRxMovementPool(day, week, profile, wallBallVolume) {
  const cleanLoad = kg(profile.maxes.cleanJerk, week >= 6 ? 0.6 : 0.52);
  const lightCleanLoad = kg(profile.maxes.cleanJerk, week >= 6 ? 0.55 : 0.5);
  const thrusterLoad =
    week >= 6 ? "43-61 kg / 95-135 lb" : "43-52 kg / 95-115 lb";
  const ohsLoad = "52 kg / 115 lb";
  const wallBallReps = clamp(Math.round(wallBallVolume / 8), 10, 20);
  const pools = {
    1: {
      primary: repsExercise("primary", "wall balls", wallBallReps),
      secondary: repsExercise("secondary", "toes-to-bar", week >= 6 ? 10 : 8),
      tertiary: repsExercise("tertiary", "box jump-overs", 10),
      mono: distanceExercise("monostructural", "run", 200),
    },
    2: {
      primary: repsExercise("primary", "overhead squats", 8, ohsLoad),
      secondary: repsExercise("secondary", "burpees over bar", 8),
      tertiary: repsExercise("tertiary", "power snatches", 6, lightCleanLoad),
      mono: repsExercise("monostructural", "shuttle runs", 8),
    },
    3: {
      primary: repsExercise("primary", "thrusters", 8, thrusterLoad),
      secondary: repsExercise("secondary", "chest-to-bar pull-ups", 8),
      tertiary: repsExercise("tertiary", "bar muscle-ups or transitions", 4),
      mono: distanceExercise("monostructural", "row", 150),
    },
    4: {
      primary: repsExercise("primary", "clean and jerks", 8, cleanLoad),
      secondary: repsExercise("secondary", "bar muscle-ups or transitions", 4),
      tertiary: repsExercise("tertiary", "strict HSPU or pike presses", 8),
      mono: repsExercise("monostructural", "double-unders", 40),
    },
    5: {
      primary: repsExercise("primary", "power cleans", 6, lightCleanLoad),
      secondary: repsExercise("secondary", "burpees over bar", 8),
      tertiary: repsExercise("tertiary", "wall balls", 12),
      mono: repsExercise("monostructural", "double-unders", 30),
    },
  };
  return pools[day] || pools[1];
}

function mastersRxPattern(week, day, pool) {
  const scaling =
    "Scale skill, reps, or load before changing the clock or movement order.";
  const common = {
    scaling,
    stimulus: "Open-style repeatability with competition-standard movement",
  };
  const patterns = {
    1: createWorkoutDefinition(
      { type: "amrap", durationSeconds: 12 * 60 },
      [pool.primary, pool.secondary, pool.tertiary, pool.mono],
      { ...common, score: "rounds and reps" },
    ),
    2: createWorkoutDefinition(
      {
        type: "intervals",
        intervalSeconds: 180,
        rounds: 4,
        restRemaining: true,
      },
      [pool.mono, pool.primary, pool.secondary],
      { ...common, score: "slowest interval split" },
    ),
    3: createWorkoutDefinition(
      { type: "fixed_rounds", rounds: 3, durationSeconds: 14 * 60 },
      [pool.primary, pool.secondary, pool.tertiary],
      { ...common, score: "finish time or reps completed at cap" },
    ),
    4: createWorkoutDefinition(
      {
        type: "emom",
        intervalSeconds: 60,
        rounds: 4,
        stations: [
          { type: "work", exercises: [pool.primary] },
          { type: "work", exercises: [pool.secondary] },
          { type: "work", exercises: [pool.mono] },
          { type: "rest" },
        ],
      },
      [],
      { ...common, score: "quality completed with no failed reps" },
    ),
    5: createWorkoutDefinition(
      { type: "amrap", durationSeconds: 14 * 60 },
      [
        asProgressiveExercise(pool.primary),
        asProgressiveExercise(pool.secondary),
      ],
      {
        ...common,
        progression: {
          type: "ascending_ladder",
          start: day === 1 ? 5 : 3,
          increment: day === 1 ? 5 : 3,
          appliesTo: [pool.primary.id, pool.secondary.id],
        },
        afterEachRound: [withExerciseId(pool.mono, "after-round")],
        score: "last completed round plus reps",
      },
    ),
    6: createWorkoutDefinition(
      { type: "repeat_sets", sets: 5, restSeconds: 60 },
      [pool.mono, pool.primary, pool.secondary],
      { ...common, score: "total working time" },
    ),
    7: createWorkoutDefinition(
      { type: "chipper", durationSeconds: 18 * 60 },
      [
        withFixedExerciseTarget(pool.mono, "chipper-mono", 50),
        withFixedExerciseTarget(pool.primary, "chipper-primary", 30),
        withFixedExerciseTarget(pool.secondary, "chipper-secondary", 20),
        withFixedExerciseTarget(pool.tertiary, "chipper-tertiary", 10),
      ],
      { ...common, score: "finish time or reps completed" },
    ),
    8: createWorkoutDefinition(
      {
        type: "benchmark",
        name: generatedBenchmarkName("mastersRxOpen", day),
        durationSeconds: 15 * 60,
      },
      [pool.mono, pool.primary, pool.secondary, pool.tertiary],
      { ...common, score: "benchmark result" },
    ),
  };
  return patterns[week] || patterns[1];
}

function varyStructuredMastersWorkout(definition, variation) {
  if (!variation) return definition;
  const replacements = [
    {
      matches: /wall balls?/i,
      movements: ["DB thrusters", "sandbag-to-shoulder"],
    },
    {
      matches: /box (?:jump|step)-overs?/i,
      movements: ["lateral burpees over a line", "DB step-overs"],
    },
    {
      matches: /toes-to-bar/i,
      movements: ["chest-to-bar pull-ups", "knee-to-elbow reps"],
    },
    {
      matches: /overhead squats?/i,
      movements: ["front squats", "single-arm DB overhead squats"],
    },
    {
      matches: /shuttle runs?|\brun\b/i,
      movements: [
        {
          movement: "bike",
          target: { type: "calories", value: 10, alternate: 8 },
        },
        { movement: "ski", target: { type: "distance_m", value: 150 } },
      ],
    },
    {
      matches: /burpees?/i,
      movements: ["box jump-overs", "alternating DB snatches"],
    },
    { matches: /chest-to-bar/i, movements: ["toes-to-bar", "strict pull-ups"] },
    { matches: /\brow\b|\bbike\b|\bski\b/i, movements: ["bike", "row"] },
    {
      matches: /thrusters?/i,
      movements: ["DB thrusters", "DB clean and push presses"],
    },
    {
      matches: /bar muscle-ups?/i,
      movements: ["ring muscle-ups", "chest-to-bar pull-ups plus box dips"],
    },
    {
      matches: /double-unders?/i,
      movements: ["crossovers", "fast single-unders"],
    },
    {
      matches: /clean and jerks?|power cleans?|power snatches?/i,
      movements: ["alternating DB snatches", "sandbag cleans"],
    },
    {
      matches: /strict HSPU|pike presses?/i,
      movements: ["strict DB presses", "hand-release push-ups"],
    },
  ];
  const main = workoutMainExercises(definition);
  const candidates = main.flatMap((exercise, exerciseIndex) =>
    replacements
      .filter((replacement) => replacement.matches.test(exercise.movement))
      .map((replacement) => ({ exerciseIndex, replacement })),
  );
  if (!candidates.length) return definition;
  const candidate =
    candidates[
      seededIndex(
        `${variation.seed}|${variation.week}|${variation.day}|${variation.collisionSalt}|movement`,
        candidates.length,
      )
    ];
  const replacement =
    candidate.replacement.movements[
      seededIndex(
        `${variation.seed}|${variation.collisionSalt}|replacement`,
        candidate.replacement.movements.length,
      )
    ];
  let currentIndex = 0;
  return mapMainWorkoutExercises(definition, (exercise) => {
    const next =
      currentIndex === candidate.exerciseIndex
        ? typeof replacement === "string"
          ? { ...exercise, movement: replacement }
          : { ...exercise, ...replacement }
        : exercise;
    currentIndex += 1;
    return next;
  });
}

function mapMainWorkoutExercises(definition, mapper) {
  if (definition.format.type === "emom") {
    return {
      ...definition,
      format: {
        ...definition.format,
        stations: definition.format.stations.map((station) =>
          station.type === "rest"
            ? station
            : { ...station, exercises: station.exercises.map(mapper) },
        ),
      },
    };
  }
  return { ...definition, exercises: definition.exercises.map(mapper) };
}

function mastersRxWod(week, day, profile, wallBallVolume, variation) {
  const cleanLoad = kg(profile.maxes.cleanJerk, week >= 6 ? 0.6 : 0.52);
  const lightCleanLoad = kg(profile.maxes.cleanJerk, week >= 6 ? 0.55 : 0.5);
  const thrusterLoad =
    week >= 6 ? "43-61 kg / 95-135 lb" : "43-52 kg / 95-115 lb";
  const ohsLoad = "52 kg / 115 lb target, scale to unbroken 5s";
  const wallBalls = `${wallBallVolume}+ wall balls total`;
  const patterns = {
    1: {
      1: [
        `AMRAP 12: 20 wall balls, 12 box jump-overs, 8 toes-to-bar. Target ${wallBalls}.`,
        "Stimulus: Open-style leg and midline repeatability.",
        "Score: rounds and reps; scale wall-ball breaks before reducing movement standard.",
      ],
      2: [
        "Every 3 min x 4: 18 wall balls, 10 box jump-overs, 8 toes-to-bar; rest remaining time.",
        "Stimulus: repeatable wall-ball and TTB sets with visible recovery.",
        "Score: slowest interval split; scale to finish each set with at least 30 sec rest.",
      ],
      3: [
        "For time, 14 min cap: 3 rounds of 30 wall balls, 15 toes-to-bar, 12 box jump-overs.",
        "Stimulus: bigger sets under grip fatigue without turning TTB into failed reps.",
        "Score: finish time or reps at cap; keep a planned TTB break pattern.",
      ],
      4: [
        "EMOM 16: min 1 16 wall balls, min 2 8 toes-to-bar, min 3 10 box step-overs, min 4 easy machine.",
        "Stimulus: deload skill conditioning with clean movement standards.",
        "Score: quality completed; no failed gymnastics reps.",
      ],
      5: [
        "13 min ascending ladder: 5-10-15... wall balls and toes-to-bar; after each round complete 8 box jump-overs.",
        "Stimulus: second-wave density for squat stamina and midline rhythm.",
        "Score: last completed round plus reps; scale TTB before losing kip timing.",
      ],
      6: [
        "5 sets, rest 1:00 between sets: 24 wall balls, 12 toes-to-bar, 10 box jump-overs.",
        "Stimulus: hard repeat efforts with wall-ball volume under control.",
        "Score: total working time; no set should fade more than 10 percent.",
      ],
      7: [
        "For time, 15 min cap: 50 wall balls, 40 box jump-overs, 30 toes-to-bar, 20 wall balls, 10 toes-to-bar.",
        "Stimulus: peak-week chipper; controlled opening pace, strong final TTB sets.",
        "Score: finish time or reps at cap; preserve full-depth wall balls.",
      ],
      8: [
        `Benchmark Wall-ball engine, 15 min cap: 3 rounds for time: 400 m run, 21 wall balls, 12 toes-to-bar, 9 power cleans at ${lightCleanLoad}.`,
        "Stimulus: repeat test across engine, squat stamina, grip, and barbell cycling.",
        "Score: finish time; compare to future 8-week cycles.",
      ],
    },
    2: {
      1: [
        `For time, 12 min cap: 10 shuttle runs, 20 overhead squats at ${ohsLoad}, 30 burpees over bar, rest 1:00, then reverse.`,
        "Stimulus: Quarterfinal-style shuttle/OHS/burpee control.",
        "Score: finish time or reps at cap; preserve below-parallel squats and two-foot bar clearance.",
      ],
      2: [
        `Every 3 min x 4: 12 shuttle runs, 12 overhead squats at ${ohsLoad}, 10 burpees over bar; rest remaining time.`,
        "Stimulus: repeatable overhead positions while breathing hard.",
        "Score: slowest interval split; reduce load before overhead squats break.",
      ],
      3: [
        `AMRAP 13: 6 power snatches at ${lightCleanLoad}, 8 overhead squats at ${ohsLoad}, 10 shuttle runs.`,
        "Stimulus: cycling light-to-moderate barbell reps with steady footwork.",
        "Score: rounds and reps; scale to unbroken overhead squat sets.",
      ],
      4: [
        `EMOM 16: min 1 8 overhead squats at ${ohsLoad}, min 2 10 shuttle runs, min 3 8 burpees over bar, min 4 rest.`,
        "Stimulus: deload practice for standards, breathing, and bar path.",
        "Score: quality completed; stop before shoulder position collapses.",
      ],
      5: [
        `14 min ascending ladder: 3-6-9... power snatches and overhead squats at ${lightCleanLoad}; after each round complete 6 shuttle runs.`,
        "Stimulus: second-wave overhead density with short shuttle interruptions.",
        "Score: last completed round plus reps; keep snatches crisp.",
      ],
      6: [
        `5 sets, rest 1:00 between sets: 10 shuttle runs, 10 overhead squats at ${ohsLoad}, 8 burpees over bar.`,
        "Stimulus: hard repeat efforts with competition-standard squats.",
        "Score: total working time; scale to keep every set under control.",
      ],
      7: [
        `For time, 15 min cap: 21-15-9 overhead squats at ${ohsLoad} and burpees over bar; complete 10 shuttle runs after each round.`,
        "Stimulus: peak-week overhead and burpee stamina.",
        "Score: finish time or reps at cap; below-parallel squats count only.",
      ],
      8: [
        `Benchmark OHS shuttle repeat, 12 min cap: 2 rounds of 10 shuttle runs, 15 overhead squats at ${ohsLoad}, 20 burpees over bar.`,
        "Stimulus: retest overhead control under shuttle fatigue.",
        "Score: finish time or reps at cap; compare standards exactly next cycle.",
      ],
    },
    3: {
      1: [
        `12 min ascending ladder: 3-6-9... thrusters at ${thrusterLoad}, chest-to-bar pull-ups; after each round row 150 m.`,
        "Stimulus: 25.2-style pulling and thruster fatigue.",
        "Score: last completed round plus reps; scale to chest-to-bar quality before volume.",
      ],
      2: [
        `Every 3 min x 4: 9 thrusters at ${thrusterLoad}, 9 chest-to-bar pull-ups, row 150 m; rest remaining time.`,
        "Stimulus: fast repeat sets with honest pull-up standards.",
        "Score: slowest interval split; scale to keep transitions sharp.",
      ],
      3: [
        `AMRAP 13: 12 thrusters at ${thrusterLoad}, 12 chest-to-bar pull-ups, 12/9 cal row.`,
        "Stimulus: medium Open-style triplet with grip and breathing pressure.",
        "Score: rounds and reps; break before grip failure.",
      ],
      4: [
        `EMOM 16: min 1 8 thrusters at ${thrusterLoad}, min 2 6 chest-to-bar pull-ups, min 3 12/9 cal row, min 4 rest.`,
        "Stimulus: deload quality volume with repeatable reps.",
        "Score: quality completed; no missed chest-to-bar reps.",
      ],
      5: [
        `For time, 14 min cap: 21-15-9 thrusters at ${thrusterLoad} and chest-to-bar pull-ups; row 150 m after each round.`,
        "Stimulus: second-wave classic couplet with rowing interference.",
        "Score: finish time or reps at cap; choose a repeatable pulling break plan.",
      ],
      6: [
        `5 sets, rest 1:00 between sets: 10 thrusters at ${thrusterLoad}, 8 chest-to-bar pull-ups, 10/8 cal row.`,
        "Stimulus: hard repeat efforts; barbell and pulling should stay unbroken or planned.",
        "Score: total working time; scale load before extending rest.",
      ],
      7: [
        `15 min ascending ladder: 4-8-12... thrusters at ${thrusterLoad} and chest-to-bar pull-ups; after each round complete 4 bar muscle-ups or transitions.`,
        "Stimulus: peak-week pulling under thruster fatigue.",
        "Score: last completed round plus reps; protect movement standards.",
      ],
      8: [
        `Benchmark Thruster ladder, 12 min cap: 15-12-9 thrusters at ${thrusterLoad}, chest-to-bar pull-ups, then max cal row in remaining time.`,
        "Stimulus: retest pulling and thrusters with a measurable engine finish.",
        "Score: finish time plus calories, or reps at cap.",
      ],
    },
    4: {
      1: [
        `18 min chipper: 50 double-unders, 20 burpees, 15 clean and jerks at ${cleanLoad}, 12 bar muscle-ups or transitions, 50 double-unders, 20 wall walks or strict HSPU.`,
        "Stimulus: mixed gymnastics under breathing fatigue.",
        "Score: time or reps; stop skill sets before repeated failed reps.",
      ],
      2: [
        `AMRAP 16: 4 bar muscle-ups or transitions, 8 clean and jerks at ${cleanLoad}, 12 strict HSPU or pike presses, 50 double-unders.`,
        "Stimulus: repeatable high-skill rounds without failed gymnastics reps.",
        "Score: rounds and reps; scale skills before reducing intensity.",
      ],
      3: [
        `Every 4 min x 4: 50 double-unders, 10 clean and jerks at ${cleanLoad}, 6 bar muscle-ups or transitions, 8 strict HSPU or pike presses; rest remaining time.`,
        "Stimulus: high-skill intervals with enough rest to keep standards.",
        "Score: slowest interval split; cap skill attempts before misses stack up.",
      ],
      4: [
        `EMOM 16: min 1 35 double-unders, min 2 6 clean and jerks at ${lightCleanLoad}, min 3 3 bar muscle-ups or transitions, min 4 handstand hold or pike press.`,
        "Stimulus: deload skill exposure while breathing stays controlled.",
        "Score: quality completed; no failed reps.",
      ],
      5: [
        `For time, 16 min cap: 75 double-unders, 21 clean and jerks at ${cleanLoad}, 15 bar muscle-ups or transitions, 15 wall walks or strict HSPU, 75 double-unders.`,
        "Stimulus: second-wave chipper with higher skill density.",
        "Score: finish time or reps at cap; keep gymnastics sets submaximal.",
      ],
      6: [
        `5 sets, rest 1:00 between sets: 40 double-unders, 8 clean and jerks at ${cleanLoad}, 4 bar muscle-ups or transitions, 6 strict HSPU or pike presses.`,
        "Stimulus: hard repeat efforts with clean reps under fatigue.",
        "Score: total working time; scale to keep each set moving.",
      ],
      7: [
        `AMRAP 18: 10 clean and jerks at ${cleanLoad}, 8 bar muscle-ups or transitions, 12 wall walks or strict HSPU, 60 double-unders.`,
        "Stimulus: peak-week mixed modal skill stamina.",
        "Score: rounds and reps; stop before repeated no-reps.",
      ],
      8: [
        `Benchmark Gymnastics chipper, 18 min cap: 50 double-unders, 20 burpees, 15 clean and jerks at ${cleanLoad}, 12 bar muscle-ups or transitions, 50 double-unders, 20 wall walks or strict HSPU.`,
        "Stimulus: retest mixed gymnastics under breathing fatigue.",
        "Score: time or reps; compare exact standards next cycle.",
      ],
    },
    5: {
      1: [
        `AMRAP 12: 10 shuttle runs, 12 wall balls, 8 chest-to-bar pull-ups, 6 power cleans at ${lightCleanLoad}.`,
        "Stimulus: weakness top-up across common Open standards.",
        "Score: rounds and reps; choose one movement to scale before the clock starts.",
      ],
      2: [
        "Every 3 min x 4: 200 m run, 10 toes-to-bar, 8 burpees to target; rest remaining time.",
        "Stimulus: repeatable engine and midline work without redline pacing.",
        "Score: slowest interval split; keep every run repeatable.",
      ],
      3: [
        `For time, 13 min cap: 30 wall balls, 20 chest-to-bar pull-ups, 10 power cleans at ${cleanLoad}, 20 chest-to-bar pull-ups, 30 wall balls.`,
        "Stimulus: grip and squat stamina with a barbell pinch point.",
        "Score: finish time or reps at cap; scale pulling volume to stay moving.",
      ],
      4: [
        "EMOM 16: min 1 easy machine, min 2 8 toes-to-bar, min 3 12 wall balls, min 4 mobility or rest.",
        "Stimulus: deload weakness practice with repeatable standards.",
        "Score: quality completed; leave fresher than you started.",
      ],
      5: [
        `14 min ascending ladder: 3-6-9... power cleans at ${lightCleanLoad} and burpees over bar; after each round complete 20 double-unders.`,
        "Stimulus: second-wave barbell cycling and breathing density.",
        "Score: last completed round plus reps; stay smooth on the barbell.",
      ],
      6: [
        "5 sets, rest 1:00 between sets: 12/9 cal bike, 10 toes-to-bar, 12 wall balls.",
        "Stimulus: hard repeat efforts for the athlete's weakest RX category.",
        "Score: total working time; scale reps to avoid failed TTB.",
      ],
      7: [
        `For time, 15 min cap: 400 m run, 30 wall balls, 20 toes-to-bar, 10 power cleans at ${cleanLoad}, 20 toes-to-bar, 30 wall balls.`,
        "Stimulus: peak-week weakness chipper with measured barbell fatigue.",
        "Score: finish time or reps at cap; hold one planned break strategy.",
      ],
      8: [
        `Benchmark Masters RX retest, 15 min cap: 3 rounds for time: 400 m run, 21 wall balls, 12 toes-to-bar, 9 power cleans at ${lightCleanLoad}.`,
        "Stimulus: repeat test across engine, squat stamina, grip, and barbell cycling.",
        "Score: finish time; compare to future 8-week cycles.",
      ],
    },
  };
  const variablePatternWeeks = [1, 2, 3, 5, 6, 7];
  const variableIndex = variablePatternWeeks.indexOf(week);
  let variedDay = day;
  let variedWeek = week;

  if (variation && variableIndex >= 0) {
    const assignments = seededPermutation(
      5 * variablePatternWeeks.length,
      `${variation.seed}|masters-rx-variable`,
    );
    const slot = variableIndex * 5 + (day - 1);
    const assignedPattern = assignments[slot];
    variedDay = Math.floor(assignedPattern / variablePatternWeeks.length) + 1;
    variedWeek =
      variablePatternWeeks[assignedPattern % variablePatternWeeks.length];
  } else if (variation) {
    const assignments = seededPermutation(
      5,
      `${variation.seed}|masters-rx-fixed-week-${week}`,
    );
    variedDay = assignments[day - 1] + 1;
  }

  const dayPatterns = patterns[variedDay] || patterns[1];
  return varyMastersRxWodStructure(
    dayPatterns[variedWeek] || dayPatterns[1],
    variation,
  );
}

function varyMastersRxWodStructure(wod, variation) {
  if (!variation || !Array.isArray(wod) || !wod.length) return wod;

  const movementVariations = MASTERS_RX_MOVEMENT_VARIATIONS.filter(
    (candidate) => candidate.matches.test(wod[0]),
  );
  if (!movementVariations.length) return wod;

  const structuralSeed = [
    "masters-rx-movement-variation",
    structuralWodSignature(wod),
    variation.seed,
    variation.collisionSalt,
  ].join("|");
  const movementVariation =
    movementVariations[seededIndex(structuralSeed, movementVariations.length)];

  return [
    `${wod[0]} Movement variation for this cycle: ${movementVariation.instruction}. Keep the listed clock and score method.`,
    ...wod.slice(1),
  ];
}

function mastersRxAddOns(week, day) {
  const engine = [
    "Engine add-on: 20 min Zone 2 row/bike/run, conversational pace.",
    "Engine add-on: 6x2:00 machine hard, 2:00 easy; hold repeatable output.",
    "Engine add-on: 10x100 m relaxed run strides or 8x30 sec bike sprint, full recovery.",
    "Engine add-on: 30 min easy Zone 2 if readiness is green.",
  ];
  const skill = [
    "Skill add-on: 8 min double-under practice, stop before calf fatigue.",
    "Skill add-on: EMOM 10 alternating strict HSPU/pike press and hollow hold.",
    "Skill add-on: 10 min bar muscle-up transition or low-ring turnover practice.",
    "Skill add-on: 6 sets submax TTB or C2B, perfect rhythm only.",
  ];
  if (week === 4 || week === 8) {
    return [
      "Add-on optional: skip if readiness is amber/red; otherwise 15-20 min easy Zone 2 only.",
    ];
  }
  return [pick(engine, week + day), pick(skill, week * 2 + day)];
}

function buildRxReadiness(profile, logs = []) {
  const groups = [
    { id: "strength", label: "Strength", targets: MASTERS_RX_TARGETS.strength },
    {
      id: "olympic",
      label: "Olympic lifting",
      targets: MASTERS_RX_TARGETS.olympic,
    },
    { id: "engine", label: "Engine", targets: MASTERS_RX_TARGETS.engine },
    {
      id: "gymnastics",
      label: "Gymnastics",
      targets: MASTERS_RX_TARGETS.gymnastics,
    },
  ];

  const categories = groups.map((group) => {
    const items = Object.entries(group.targets).map(([id, target]) =>
      readinessItem(id, target, profile),
    );
    const tested = items.filter((item) => item.status !== "missing");
    const averageScore = tested.length
      ? tested.reduce((sum, item) => sum + item.score, 0) / tested.length
      : 0;
    const coverage = items.length ? tested.length / items.length : 1;
    const score = tested.length
      ? clamp(Math.round(averageScore * (0.85 + coverage * 0.15)), 0, 100)
      : 0;
    return {
      id: group.id,
      label: group.label,
      score,
      missing: items.length - tested.length,
      summary: readinessCategorySummary(items),
      items,
    };
  });

  const missingTests = categories.flatMap((category) =>
    category.items
      .filter((item) => item.status === "missing")
      .map((item) => ({
        ...item,
        categoryId: category.id,
        categoryLabel: category.label,
      })),
  );
  const openSkillsScore = Math.round(
    (categoryScore(categories, "engine") +
      categoryScore(categories, "gymnastics") +
      categoryScore(categories, "olympic")) /
      3,
  );
  const consistencyScore = consistencyReadinessScore(logs);
  const recoveryScore = recoveryReadinessScore(profile, logs);
  const fullCategories = [
    ...categories,
    {
      id: "openSkills",
      label: "Open skills",
      score: openSkillsScore,
      missing: 0,
      summary: "Blends Olympic lifting, engine, and gymnastics.",
      items: [],
    },
    {
      id: "consistency",
      label: "Consistency",
      score: consistencyScore,
      missing: 0,
      summary: consistencyReadinessSummary(logs),
      items: [],
    },
    {
      id: "recovery",
      label: "Recovery",
      score: recoveryScore,
      missing: 0,
      summary: recoveryReadinessSummary(profile, logs),
      items: [],
    },
  ];
  const rxLevel = clamp(
    Math.round(
      fullCategories.reduce((sum, category) => sum + category.score, 0) /
        fullCategories.length,
    ),
    0,
    100,
  );
  const actionableWeakest = [...fullCategories]
    .filter((category) => category.id !== "recovery")
    .sort((a, b) => a.score - b.score);
  const weakest = actionableWeakest.slice(0, 2);
  const recovery = fullCategories.find(
    (category) => category.id === "recovery",
  );
  if (recovery && weakest.length && recovery.score <= weakest[0].score - 10) {
    weakest.splice(1, 1, recovery);
  }

  return {
    division: DIVISION_LABELS[profile.division] || DIVISION_LABELS.men35to39,
    rxLevel,
    categories: fullCategories,
    missingTests,
    weakest,
    recommendation: readinessRecommendation(weakest, missingTests),
  };
}

function readinessItem(id, target, profile) {
  const metric = PR_METRICS.find((item) => item.id === id) || {
    type: target.unit === "time" ? "time" : "number",
  };
  const rawValue = valueFromPath(profile, target.source);
  const value = normalizePrValue(rawValue, metric);
  const targetDisplay = formatPrValue(target.target, metric);
  if (!Number.isFinite(value) || value <= 0) {
    return {
      id,
      label: target.label,
      target: target.target,
      targetDisplay,
      display: "Test needed",
      score: 0,
      status: "missing",
    };
  }
  const direction = target.direction || "higher";
  const ratio =
    direction === "lower" ? target.target / value : value / target.target;
  const score = clamp(Math.round(ratio * 100), 0, 100);
  return {
    id,
    label: target.label,
    target: target.target,
    targetDisplay,
    display: formatPrValue(value, metric),
    score,
    status: score >= 100 ? "ready" : "building",
  };
}

function readinessCategorySummary(items) {
  const missing = items.filter((item) => item.status === "missing");
  const weakestTested = items
    .filter((item) => item.status !== "missing")
    .sort((a, b) => a.score - b.score)[0];

  if (weakestTested && missing.length) {
    return `${weakestTested.label}: ${weakestTested.display} vs ${weakestTested.targetDisplay}. ${missing[0].label} test needed.`;
  }
  if (weakestTested) {
    return `${weakestTested.label}: ${weakestTested.display} vs ${weakestTested.targetDisplay}.`;
  }
  if (missing.length) {
    return `${missing[0].label} test needed.`;
  }
  return "";
}

function categoryScore(categories, id) {
  const category = categories.find((item) => item.id === id);
  return category ? category.score : 0;
}

function consistencyReadinessScore(logs = []) {
  const recentLogs = recentTrainingLogs(logs);
  return clamp(Math.round((recentLogs.length / 12) * 100), 0, 100);
}

function consistencyReadinessSummary(logs = []) {
  const recentLogs = recentTrainingLogs(logs);
  return `${recentLogs.length}/12 sessions logged in the last 28 days.`;
}

function recoveryReadinessScore(profile, logs = []) {
  const age = Number(profile.age) || 36;
  const baseline = age >= 35 ? 85 : 90;
  const recentLogs = recentTrainingLogs(logs);
  if (!recentLogs.length) return baseline;

  const readinessAdjustment = average(
    recentLogs.map((log) => {
      if (log.readiness === "green") return 4;
      if (log.readiness === "red") return -8;
      return 0;
    }),
  );
  const rpeValues = recentLogs
    .map((log) => Number(log.rpe))
    .filter(Number.isFinite);
  const averageRpe = rpeValues.length ? average(rpeValues) : 7.5;
  const rpeAdjustment = averageRpe >= 8.5 ? -5 : averageRpe <= 7 ? 3 : 0;
  const mobilityRate =
    recentLogs.filter((log) => log.mobilityDone).length / recentLogs.length;
  const mobilityAdjustment =
    mobilityRate >= 0.75 ? 4 : mobilityRate <= 0.25 ? -4 : 0;

  return clamp(
    Math.round(
      baseline + readinessAdjustment + rpeAdjustment + mobilityAdjustment,
    ),
    0,
    100,
  );
}

function recoveryReadinessSummary(profile, logs = []) {
  const age = Number(profile.age) || 36;
  const recentLogs = recentTrainingLogs(logs);
  if (!recentLogs.length)
    return `Age ${age} baseline; log readiness, RPE, and mobility to refine.`;

  const rpeValues = recentLogs
    .map((log) => Number(log.rpe))
    .filter(Number.isFinite);
  const averageRpe = rpeValues.length ? average(rpeValues) : 0;
  const mobilityCount = recentLogs.filter((log) => log.mobilityDone).length;
  const rpeText = averageRpe
    ? `Average RPE ${trimNumber(averageRpe)}.`
    : "No RPE trend yet.";
  return `${rpeText} Mobility ${mobilityCount}/${recentLogs.length} recent logs.`;
}

function recentTrainingLogs(logs = []) {
  const now = Date.now();
  const windowMs = 28 * 24 * 60 * 60 * 1000;
  return logs.filter((log) => {
    const dateTimestamp = Date.parse(log.date || "");
    const createdAtTimestamp = Date.parse(log.createdAt || "");
    const timestamp = Number.isFinite(dateTimestamp)
      ? dateTimestamp
      : createdAtTimestamp;
    return (
      Number.isFinite(timestamp) &&
      timestamp <= now &&
      now - timestamp <= windowMs
    );
  });
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readinessRecommendation(weakest, missingTests = []) {
  if (missingTests.length && !weakest.length) {
    return `Log ${missingTests
      .slice(0, 2)
      .map((item) => item.label.toLowerCase())
      .join(" and ")} to reveal your next RX focus.`;
  }
  if (!weakest.length)
    return "Log assessment tests to reveal your next RX focus.";
  const focus = weakest.map((item) => item.label.toLowerCase()).join(" and ");
  const testing = missingTests.length
    ? ` Test ${missingTests
        .slice(0, 2)
        .map((item) => item.label.toLowerCase())
        .join(" and ")} next.`
    : "";
  return `Prioritize ${focus} in the next generated cycle.${testing}`;
}

function getProgramDays() {
  return [
    {
      id: "day1",
      weekday: "Monday",
      shortTitle: "Back squat + T2B",
      focus:
        "Squat strength, submaximal gymnastics, and a short mixed row metcon.",
    },
    {
      id: "day2",
      weekday: "Tuesday",
      shortTitle: "Snatch + row intervals",
      focus: "Olympic lifting technique before high-output rowing intervals.",
    },
    {
      id: "day3",
      weekday: "Thursday",
      shortTitle: "Clean and jerk + front squat",
      focus:
        "Clean and jerk practice, front squat strength, and run-pull conditioning.",
    },
    {
      id: "day4",
      weekday: "Saturday",
      shortTitle: "Muscle-up skill + long metcon",
      focus:
        "Upper-body skill progression, heavy pulls, and steady work capacity.",
    },
  ];
}

function findTrainingSession(sessionId, weekNumber) {
  const mainDay = getProgramDays().find((day) => day.id === sessionId);
  if (mainDay) {
    return buildSession(mainDay.id, weekNumber, state.profile);
  }

  const customPlan = state.customPlans.find((plan) => plan.id === sessionId);
  if (!customPlan) return null;
  return {
    id: customPlan.id,
    week: customPlan.week,
    weekday: `Week ${customPlan.week}`,
    shortTitle: customPlan.title,
    focus: customPlan.focus,
    segments: customPlanSegments(customPlan),
  };
}

function buildSession(dayId, weekNumber, profile) {
  const base = getProgramDays().find((day) => day.id === dayId);
  const builders = {
    day1: buildDayOne,
    day2: buildDayTwo,
    day3: buildDayThree,
    day4: buildDayFour,
  };
  return {
    ...base,
    segments: builders[dayId](weekNumber, profile),
  };
}

function buildProgramWod(dayId, week, profile, wodMinutes) {
  const config = {
    day1: { goal: "balanced", weakness: "t2b", generatedDay: 1 },
    day2: { goal: "endurance", weakness: "rowing", generatedDay: 2 },
    day3: { goal: "balanced", weakness: "pulling", generatedDay: 3 },
    day4: { goal: "gymnastics", weakness: "muscleup", generatedDay: 4 },
  }[dayId];
  const phase = getGeneratedWeekPhase(week, config.goal);
  return renderWorkoutItems(
    generatedWodItems(
      config.goal,
      config.weakness,
      config.generatedDay,
      week,
      profile,
      phase,
      Number(wodMinutes),
    ),
  );
}

function buildDayOne(week, profile) {
  const squat = {
    1: ["5x4", 0.75],
    2: ["5x4", 0.8],
    3: ["6x3", 0.85],
    4: ["3x4", 0.65],
    5: ["5x3", 0.825],
    6: ["6x2", 0.875],
    7: ["5x2", 0.9],
    8: ["Build to heavy 3, then 2x3", 0.85],
  }[week];
  const t2b = { 1: 6, 2: 7, 3: 8, 4: 5, 5: 7, 6: 8, 7: 9, 8: 5 }[week];
  const wodMinutes = week === 4 ? "10" : "12";
  const wod = buildProgramWod("day1", week, profile, wodMinutes);
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: [
        "3 min easy row",
        "Dynamic hips and ankles",
        "2x10 air squats",
        "2x10 kip swings",
      ],
    },
    {
      title: "Strength and skill",
      minutes: "28",
      items: [
        `Back squat ${squat[0]} at ${percent(squat[1])} (${kg(profile.maxes.backSquat, squat[1])}), rest 2:00`,
        `EMOM 8: ${t2b} toes-to-bar each minute (${t2b * 8} total), stop 1-2 reps before failure`,
      ],
    },
    {
      title: "WOD",
      minutes: wodMinutes,
      items: wod,
    },
    {
      title: "Accessory and mobility",
      minutes: "12",
      items: [
        "3 rounds: 10 DB single-leg RDL per leg + 20-30 sec hollow hold",
        "Ankle dorsiflexion, hip flexor stretch, and 60 sec hang",
      ],
    },
  ];
}

function buildDayTwo(week, profile) {
  const complexPct = {
    1: 0.65,
    2: 0.7,
    3: 0.75,
    4: 0.6,
    5: 0.7,
    6: 0.75,
    7: 0.7,
    8: 0.6,
  }[week];
  const singlePct = {
    1: 0.8,
    2: 0.825,
    3: 0.85,
    4: 0.75,
    5: 0.825,
    6: 0.875,
    7: 0.9,
    8: 0.8,
  }[week];
  const engine = buildProgramWod("day2", week, profile, 15);
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: [
        "Light cardio",
        "Shoulder and T-spine prep",
        "PVC and empty-bar snatch drills",
      ],
    },
    {
      title: "Snatch work",
      minutes: "20",
      items: [
        `Snatch complex 5x(1 hang power + 1 power + 1 OHS) at ${percent(complexPct)} (${kg(profile.maxes.snatch, complexPct)})`,
        `Then 5-6 smooth singles up to ${percent(singlePct)} (${kg(profile.maxes.snatch, singlePct)})`,
      ],
    },
    {
      title: "Engine WOD",
      minutes: "15",
      items: engine,
    },
    {
      title: "Accessory and mobility",
      minutes: "17",
      items: [
        "3x12 banded face pulls",
        "3x10-12 external rotations",
        "Lat, pec, and thoracic extension work",
      ],
    },
  ];
}

function buildDayThree(week, profile) {
  const cjPct = {
    1: 0.7,
    2: 0.75,
    3: 0.825,
    4: 0.65,
    5: 0.75,
    6: 0.8,
    7: 0.85,
    8: 0.8,
  }[week];
  const fs = {
    1: ["E2MOM x 6: 3 reps", 0.8],
    2: ["E2MOM x 6: 3 reps", 0.825],
    3: ["5x2", 0.875],
    4: ["3x3", 0.7],
    5: ["5x3", 0.825],
    6: ["6x2", 0.85],
    7: ["5x2", 0.9],
    8: ["3x2", 0.75],
  }[week];
  const cjFormat = {
    1: "EMOM 10: 1 rep",
    2: "EMOM 10: 1 rep",
    3: "8x1 E2:00",
    4: "EMOM 8: 1 rep",
    5: "EMOM 10: 1 rep",
    6: "8x1 E2:00",
    7: "6x1 E2:00",
    8: "Build to a crisp single",
  }[week];
  const wodMinutes = week === 4 ? "10" : "12";
  const wod = buildProgramWod("day3", week, profile, wodMinutes);
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: [
        "400 m easy jog",
        "Dynamic prep",
        "Front rack and jerk footwork drills",
      ],
    },
    {
      title: "Clean and jerk + squat",
      minutes: "24",
      items: [
        `Clean and jerk ${cjFormat} at ${percent(cjPct)} (${kg(profile.maxes.cleanJerk, cjPct)})`,
        `Front squat ${fs[0]} at ${percent(fs[1])} (${kg(profile.maxes.frontSquat, fs[1])})`,
      ],
    },
    {
      title: "WOD",
      minutes: wodMinutes,
      items: wod,
    },
    {
      title: "Accessory and mobility",
      minutes: "16",
      items: [
        "3x8-10 dips",
        "3x10 band pull-aparts",
        "Front rack, wrist, and lat mobility",
      ],
    },
  ];
}

function buildDayFour(week, profile) {
  const pull = {
    1: ["4x3", 1.05],
    2: ["4x3", 1.1],
    3: ["5x2", 1.15],
    4: ["3x3", 0.95],
    5: ["4x3", 1.1],
    6: ["5x2", 1.15],
    7: ["5x2", 1.2],
    8: ["3x2", 1],
  }[week];
  const muscleUp = {
    1: "3 rounds: 5 scap pull-ups, 3-5 strict chest-to-bar or band assist, 5 jumping bar MU transitions, 3 slow negatives",
    2: "Same structure with slightly less assistance and cleaner transitions",
    3: "Try 3-6 early singles only if positions are sharp, then return to controlled negatives",
    4: "Deload drills only: transitions, hollow-arch rhythm, and easy pulling",
    5: "4 rounds: 4 strict chest-to-bar, 4 low-bar transitions, 2 slow negatives, keep one rep in reserve",
    6: "Practice 4-8 singles with full rest if you have the skill, otherwise banded transitions plus deep dips",
    7: "Test controlled singles early, then finish with low-volume transition and dip strength",
    8: "Benchmark: max quality bar muscle-ups in 8 min, or max clean transition reps without misses",
  }[week];
  const wodMinutes = week === 5 || week === 8 ? "20" : week === 4 ? "15" : "18";
  const wod = buildProgramWod("day4", week, profile, wodMinutes);
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: ["Easy bike or row", "Scap activation", "Wrist and elbow prep"],
    },
    {
      title: "Gymnastics + pull",
      minutes: "23",
      items: [
        `Muscle-up skill: ${muscleUp}`,
        `Clean pull ${pull[0]} at ${percent(pull[1])} of clean and jerk (${kg(profile.maxes.cleanJerk, pull[1])})`,
      ],
    },
    {
      title: "WOD",
      minutes: wodMinutes,
      items: wod,
    },
    {
      title: "Accessory and mobility",
      minutes: week === 4 ? "14" : week === 5 || week === 8 ? "9" : "11",
      items: [
        "2 sets max hollow rocks + 2 sets max arch rocks",
        "Shoulder, pec, calves, and 60 sec hang",
      ],
    },
  ];
}

function getNextDayForToday() {
  const day = new Date().getDay();
  if (day <= 1) return getProgramDays()[0];
  if (day === 2 || day === 3) return getProgramDays()[1];
  if (day === 4 || day === 5) return getProgramDays()[2];
  return getProgramDays()[3];
}

function kg(max, pct) {
  return `${roundToNearest(max * pct, 2.5)} kg`;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pick(items, index) {
  return items[((index % items.length) + items.length) % items.length];
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function valueFromPath(source, path) {
  return path
    .split(".")
    .reduce((current, key) => current && current[key], source);
}

function splitLines(value) {
  return String(value || "")
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePrValue(rawValue, metric) {
  if (metric.type === "time") return parseTimeToSeconds(rawValue);
  const number = Number(String(rawValue).replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function parseTimeToSeconds(value) {
  if (typeof value === "number") return value;
  const raw = String(value).trim();
  if (!raw) return NaN;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

function formatPrValue(value, metric) {
  if (!Number.isFinite(value)) return "-";
  if (metric.type === "time") return formatSeconds(value);
  return `${trimNumber(value)} ${metric.unit}`;
}

function formatSeconds(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`;
  return `${minutes}:${pad(rest)}`;
}

function trimNumber(value) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(1)));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isBetterPr(nextValue, currentValue, metric) {
  if (!Number.isFinite(currentValue)) return true;
  return metric.direction === "lower"
    ? nextValue < currentValue
    : nextValue > currentValue;
}

function formatDate(value) {
  if (!value || value === "Baseline") return value || "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return;

  const register = () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.info("Service worker registration skipped.", error);
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

const FORGE_HOUR_API = {
  BAR_MUSCLE_UP_LEVELS,
  DEFAULT_PROFILE,
  DIVISION_LABELS,
  GOAL_LABELS,
  MASTERS_RX_TARGETS,
  MOVEMENT_LIBRARY,
  PLAN_SCHEMA_VERSION,
  PR_METRICS,
  READINESS_LABELS,
  WEEK_META,
  WEAKNESS_LABELS,
  WOD_SCHEMA_VERSION,
  WORKOUT_DEFINITION_VERSION,
  buildGeneratedProgramme,
  buildRxReadiness,
  buildSession,
  clamp,
  cloneDefaultProfile,
  claimUniqueGeneratedWod,
  createGenerationSeed,
  createId,
  customPlanSegments,
  filterMovementLibrary,
  formatDate,
  formatPrValue,
  formatTimerResult,
  timerDisplaySeconds,
  getNextDayForToday,
  getProgramDays,
  inferTimerFromText,
  inferWorkoutTimer,
  isBetterPr,
  kg,
  migratePlanState,
  migrateGeneratedProgrammePlans,
  renderWorkoutDescription,
  renderWorkoutItems,
  normalizePrValue,
  parseTimeToSeconds,
  percent,
  positiveNumber,
  registerServiceWorker,
  roundToNearest,
  selectActivePlan,
  selectActiveWeekSessions,
  selectPlanWeekSessions,
  splitLines,
  structuralWodSignature,
  trimNumber,
  valueFromPath,
  validateWorkoutDefinition,
  workoutDefinitionErrors,
  workoutItemsForSession,
};

if (typeof globalThis !== "undefined") {
  globalThis.ForgeHour = FORGE_HOUR_API;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = FORGE_HOUR_API;
}
