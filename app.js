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
  balanced: "All-round CrossFit",
  mastersRxOpen: "Masters 35-39 RX / Open Prep",
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

const WOD_SCHEMA_VERSION = 4;

const canUseDOM = typeof document !== "undefined";
const state = loadState();

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

if (canUseDOM && document.querySelector("[data-vanilla-app]")) {
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
    { title: "WOD", minutes: String(minutes.wod || 20), items: plan.wod || [] },
    {
      title: "Cooldown and mobility",
      minutes: String(minutes.mobility || 12),
      items: plan.mobility || [],
    },
  ].filter((segment) => segment.items.length);
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

function buildGeneratedProgramme(options, profile, idFactory = createId) {
  const normalized = normalizeGeneratorOptions(options);
  const plans = [];

  for (let week = 1; week <= 8; week += 1) {
    for (let day = 1; day <= normalized.daysPerWeek; day += 1) {
      plans.push(
        buildGeneratedSession(normalized, profile, week, day, idFactory),
      );
    }
  }

  return plans;
}

function migrateGeneratedProgrammePlans(plans, profile) {
  let migrated = false;
  const nextPlans = (plans || []).map((plan) => {
    if (
      !plan ||
      !plan.generated ||
      plan.wodSchemaVersion === WOD_SCHEMA_VERSION
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
      { goal, weakness, daysPerWeek: day, duration },
      profile,
      week,
      day,
      () => plan.id || createId(),
    );

    return {
      ...replacement,
      id: plan.id || replacement.id,
      createdAt: plan.createdAt || replacement.createdAt,
    };
  });

  return { plans: nextPlans, migrated };
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
  const goal = GOAL_LABELS[options.goal] ? options.goal : "balanced";
  const weakness = WEAKNESS_LABELS[options.weakness]
    ? options.weakness
    : "squat";
  const daysPerWeek = clamp(Math.round(Number(options.daysPerWeek) || 4), 3, 5);
  const duration = clamp(
    roundToNearest(Number(options.duration) || 60, 5),
    45,
    60,
  );
  return { goal, weakness, daysPerWeek, duration };
}

function buildGeneratedSession(options, profile, week, day, idFactory) {
  if (options.goal === "mastersRxOpen") {
    return buildMastersRxOpenSession(options, profile, week, day, idFactory);
  }

  const phase = getGeneratedWeekPhase(week, options.goal);
  const title = generatedDayTitle(options.goal, day);
  const segmentMinutes = getGeneratedSegmentMinutes(
    options.duration,
    options.goal,
  );

  return {
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
    wod: generatedWodItems(
      options.goal,
      options.weakness,
      day,
      week,
      profile,
      phase,
      segmentMinutes.wod,
    ),
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
) {
  const movement = generatedWodMovementPool(
    goal,
    weakness,
    day,
    week,
    profile,
    phase,
  );
  const cap = clamp(Math.round(Number(wodMinutes) || 12), 8, 24);
  const pattern = buildWodPattern(week, goal, day, cap, movement);

  return [
    pattern.workout,
    `Stimulus: ${pattern.stimulus}`,
    `Score: ${pattern.score}. Target intensity: ${phase.intensity}; scale reps, distance, or loading before extending the cap.`,
  ];
}

function buildWodPattern(week, goal, day, cap, movement) {
  const intervals = Math.max(3, Math.floor(cap / 3));
  const repeatSets = Math.max(3, Math.floor(cap / 4));
  const rounds = cap >= 16 ? 5 : cap >= 13 ? 4 : 3;
  const benchmarkName = generatedBenchmarkName(goal, day);

  const patterns = {
    1: {
      workout: `AMRAP ${Math.min(cap, 12)}: ${movement.weight}, ${movement.monoAmrap}, ${movement.gym}`,
      stimulus:
        "short-to-medium mixed piece; unbroken early rounds, quick transitions",
      score: "total rounds and reps",
    },
    2: {
      workout: `Every 3 min x ${intervals}: ${movement.monoInterval}, ${movement.weightLowRep}, ${movement.simpleGym}; rest remaining time`,
      stimulus:
        "repeatable intervals; each set should feel fast but controlled",
      score: "slowest interval split",
    },
    3: {
      workout: `${rounds} rounds for time, ${cap} min cap: ${movement.monoInterval}, ${movement.gym}, ${movement.weight}`,
      stimulus: "medium for-time test; hold one repeatable break plan",
      score: "finish time or completed reps at cap",
    },
    4: {
      workout: `EMOM ${cap}: min 1 ${movement.weakness}, min 2 easy ${movement.mono}, min 3 ${movement.simpleGym}, min 4 rest or mobility`,
      stimulus: "deload skill conditioning; leave fresher than you started",
      score: "quality completed, no failed reps",
    },
    5: {
      workout: `${cap} min ascending ladder: 2-4-6-8... ${movement.weightLowRep} and ${movement.gym}; after each round complete ${movement.shortMono}`,
      stimulus: "second-wave density piece; manageable reps that accumulate",
      score: "last completed round plus reps",
    },
    6: {
      workout: `${repeatSets} sets, rest 1:00 between sets: ${movement.monoInterval}, ${movement.weight}, ${movement.simpleGym}`,
      stimulus:
        "hard repeat efforts; pacing should not fade more than 10 percent",
      score: "total working time",
    },
    7: {
      workout: `For time, ${cap} min cap: ${movement.chipper}`,
      stimulus: "longer mixed chipper; controlled opening pace, strong finish",
      score: "finish time or reps completed",
    },
    8: {
      workout: `Benchmark ${benchmarkName}, ${cap} min cap: ${movement.benchmark}`,
      stimulus:
        "test week; compare against future cycles without changing standards",
      score: "benchmark result",
    },
  };

  return patterns[week];
}

function inferWorkoutTimer(session) {
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

function generatedWodMovementPool(goal, weakness, day, week, profile) {
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
  const mono = pick(monoOptions, week + day);
  const gymOptions = {
    stronger: [
      "8 toes-to-bar",
      "8 box jumps",
      "10 push-ups",
      "6 chest-to-bar",
      "12 wall balls",
    ],
    endurance: [
      "10 burpees",
      "14 wall balls",
      "12 sit-ups",
      "10 box step-overs",
      "12 air squats",
    ],
    gymnastics: [
      "8 pull-ups",
      "10 toes-to-bar",
      "4 bar muscle-up transitions",
      "1 wall walk",
      "30 sec handstand hold",
    ],
    balanced: [
      "10 pull-ups",
      "12 wall balls",
      "10 toes-to-bar",
      "8 burpees",
      "15 air squats",
    ],
  };
  const weightOptions = {
    stronger: [
      `6 power cleans at ${cleanLoad}`,
      `8 DB front squats`,
      `6 deadlifts at ${kg(profile.maxes.cleanJerk, 0.85)}`,
      `8 DB snatches`,
      `6 push jerks at ${lightCleanLoad}`,
    ],
    endurance: [
      `12 light KB swings`,
      `10 DB snatches`,
      `12 goblet squats`,
      `8 power cleans at ${lightCleanLoad}`,
      `16 alternating DB step-ups`,
    ],
    gymnastics: [
      `8 DB snatches at ${snatchLoad}`,
      `10 light KB swings`,
      `8 overhead squats at ${snatchLoad}`,
      `10 medicine-ball cleans`,
      `12 DB lunges`,
    ],
    balanced: [
      `8 power cleans at ${lightCleanLoad}`,
      `8 overhead squats at ${snatchLoad}`,
      `10 DB snatches`,
      `12 KB swings`,
      `8 clean and jerks at ${lightCleanLoad}`,
    ],
  };

  const gym = pick(gymOptions[goal] || gymOptions.balanced, week + day);
  const weight = pick(
    weightOptions[goal] || weightOptions.balanced,
    week + day * 2,
  );
  const simpleGym = pick(
    ["8 burpees", "10 sit-ups", "10 push-ups", "12 air squats", "8 ring rows"],
    week + day * 3,
  );
  const weaknessMove = weaknessWodMovement(weakness, week);

  return {
    mono,
    monoAmrap: monoAmrap(mono, goal),
    monoInterval: monoInterval(mono, goal),
    shortMono: shortMono(mono),
    gym,
    simpleGym,
    weakness: weaknessMove,
    weight,
    weightLowRep: lowerRepMovement(weight),
    chipper: generatedChipper(goal, weaknessMove, mono, gym, weight),
    benchmark: generatedBenchmark(goal, day, mono, gym, weight, weaknessMove),
  };
}

function monoAmrap(mono, goal) {
  const calories = goal === "endurance" ? "14/11 cal" : "10/8 cal";
  if (["row", "bike", "ski"].includes(mono)) return `${calories} ${mono}`;
  if (mono === "run") return goal === "endurance" ? "200 m run" : "100 m run";
  if (mono === "shuttle run") return "8 shuttle runs";
  return goal === "endurance" ? "40 double unders" : "30 double unders";
}

function generatedChipper(goal, weaknessMove, mono, gym, weight) {
  const opening = monoInterval(mono, goal);
  const closer = shortMono(mono);
  return `${opening}, 40 air squats, 30 ${gym.replace(/^\d+\s*/, "")}, 20 ${weight.replace(/^\d+\s*/, "")}, 10 ${weaknessMove.replace(/^\d+\s*/, "")}, ${closer}`;
}

function generatedBenchmark(goal, day, mono, gym, weight, weaknessMove) {
  const benchmarks = {
    stronger: [
      `10 rounds: 3 ${weight.replace(/^\d+\s*/, "")}, 6 box jumps`,
      `5 rounds: ${monoInterval(mono, goal)}, 5 ${weight.replace(/^\d+\s*/, "")}`,
      `AMRAP: 5 ${weight.replace(/^\d+\s*/, "")}, 7 ${gym.replace(/^\d+\s*/, "")}, 9 wall balls`,
      `Max rounds quality: 6 strict push-ups, 8 KB swings, 10 cal bike`,
      `EMOM test: ${weaknessMove}, ${shortMono(mono)}, loaded carry`,
    ],
    endurance: [
      `max sustainable meters on ${mono}`,
      `5x${monoInterval(mono, goal)}, rest 1:00`,
      `AMRAP: 400 m run, 15 wall balls, 12 sit-ups`,
      `for time: 800 m ${mono}, 60 air squats, 40 burpees, 800 m ${mono}`,
      `zone 2 distance check, same machine for full cap`,
    ],
    gymnastics: [
      `AMRAP: 5 pull-ups, 10 push-ups, 15 air squats`,
      `EMOM rotation: toes-to-bar, burpees, ${shortMono(mono)}`,
      `max quality ${weaknessMove} with easy ${shortMono(mono)} after each set`,
      `AMRAP: wall walk or hold, 12 sit-ups, 200 m run`,
      `skill density: ${weaknessMove}, hollow rocks, easy machine`,
    ],
    balanced: [
      `AMRAP: ${weight}, 10 box jump overs, ${shortMono(mono)}`,
      `5 rounds: ${monoInterval(mono, goal)}, 8 overhead squats, 10 burpees`,
      `AMRAP: 200 m run, 10 pull-ups, 12 wall balls`,
      `AMRAP: 400 m run, 10 pull-ups, 15 push-ups, 20 air squats`,
      `EMOM rotation: ${weaknessMove}, ${shortMono(mono)}, light barbell, core`,
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

function weaknessWodMovement(weakness, week) {
  const reps = week >= 5 ? "8" : "6";
  const movements = {
    squat: `${reps} tempo goblet squats`,
    olympic: `${reps} hang power clean drills`,
    rowing: "250 m technique row",
    running: "200 m relaxed run",
    pulling: `${reps} strict pull-ups or ring rows`,
    muscleup: `${Math.max(3, Number(reps) - 3)} bar muscle-up transitions`,
    t2b: `${reps} toes-to-bar or hanging knee raises`,
  };
  return movements[weakness];
}

function monoInterval(mono, goal) {
  if (mono === "run") return goal === "endurance" ? "400 m run" : "200 m run";
  if (mono === "row") return goal === "endurance" ? "500 m row" : "250 m row";
  if (mono === "bike")
    return goal === "endurance" ? "18/14 cal bike" : "12/9 cal bike";
  if (mono === "ski") return goal === "endurance" ? "400 m ski" : "250 m ski";
  if (mono === "shuttle run") return "10 shuttle runs";
  return "50 double unders";
}

function shortMono(mono) {
  if (mono === "run") return "100 m run";
  if (mono === "row") return "150 m row";
  if (mono === "bike") return "8/6 cal bike";
  if (mono === "ski") return "150 m ski";
  if (mono === "shuttle run") return "5 shuttle runs";
  return "30 double unders";
}

function lowerRepMovement(movement) {
  return movement
    .replace(/^12\s/, "8 ")
    .replace(/^10\s/, "7 ")
    .replace(/^8\s/, "6 ")
    .replace(/^6\s/, "5 ")
    .replace(/^16\s/, "10 ");
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
  return "Gymnastics skill: hollow/arch control, strict pulling, and midline strength";
}

function weaknessMobility(weakness) {
  const mobility = {
    squat: "Couch stretch, ankle dorsiflexion, and deep squat breathing",
    olympic: "Front rack, lats, pecs, T-spine extension",
    rowing: "Hamstrings, hip flexors, and easy thoracic rotation",
    running: "Calves, hip flexors, and foot/ankle tissue work",
    pulling: "Lats, pecs, forearms, and 60 sec active-passive hang",
    muscleup: "Pecs, lats, triceps, forearms, and gentle shoulder extension",
    t2b: "Lats, hip flexors, hamstrings, and hollow breathing",
  };
  return mobility[weakness];
}

function buildMastersRxOpenSession(options, profile, week, day, idFactory) {
  const phase = getGeneratedWeekPhase(week, "mastersRxOpen");
  const title = generatedDayTitle("mastersRxOpen", day);
  const segmentMinutes = getGeneratedSegmentMinutes(
    options.duration,
    day === 2 ? "endurance" : day === 4 ? "gymnastics" : "balanced",
  );
  const templates = mastersRxSessionTemplates(profile, week, phase);
  const selected = templates[day] || templates[1];

  return {
    id: idFactory(`generated-masters-rx-open-w${week}-d${day}`),
    week,
    title: `W${week} D${day}: ${title}`,
    focus: `Men Masters 35-39 RX prep. ${phase.note} Build Open standards without failed skill reps.`,
    warmup: selected.warmup,
    strength: selected.strength,
    wod: selected.wod,
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
  const wallBallVolume = {
    1: 80,
    2: 100,
    3: 120,
    4: 70,
    5: 110,
    6: 130,
    7: 150,
    8: 100,
  }[week];

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

function mastersRxWod(week, day, profile, wallBallVolume) {
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
  const dayPatterns = patterns[day] || patterns[1];
  return dayPatterns[week] || dayPatterns[1];
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
  return generatedWodItems(
    config.goal,
    config.weakness,
    config.generatedDay,
    week,
    profile,
    phase,
    Number(wodMinutes),
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
  DEFAULT_PROFILE,
  DIVISION_LABELS,
  GOAL_LABELS,
  MASTERS_RX_TARGETS,
  MOVEMENT_LIBRARY,
  PR_METRICS,
  READINESS_LABELS,
  WEEK_META,
  WEAKNESS_LABELS,
  buildGeneratedProgramme,
  buildRxReadiness,
  buildSession,
  clamp,
  cloneDefaultProfile,
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
  migrateGeneratedProgrammePlans,
  normalizePrValue,
  parseTimeToSeconds,
  percent,
  positiveNumber,
  registerServiceWorker,
  roundToNearest,
  splitLines,
  trimNumber,
  valueFromPath,
};

if (typeof globalThis !== "undefined") {
  globalThis.ForgeHour = FORGE_HOUR_API;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = FORGE_HOUR_API;
}
