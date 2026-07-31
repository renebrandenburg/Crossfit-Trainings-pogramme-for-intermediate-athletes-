"use strict";

(function initializeMovementCatalog(globalScope) {
  function crossFitVideoSearch(query) {
    return `https://www.youtube.com/@CrossFit/search?query=${encodeURIComponent(query)}`;
  }

  const CROSSFIT_MOVEMENT_SOURCE =
    "https://www.crossfit.com/essentials/movements";

  const LEARN_MOVEMENTS = [
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
      focus:
        "Transfer leg drive into the bar while keeping the torso vertical.",
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
      focus:
        "Drive the bar up, then receive it with locked arms and bent knees.",
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
      focus:
        "Move the bar from floor to overhead in one fast, balanced motion.",
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
      focus:
        "Receive the snatch above parallel with speed and stable shoulders.",
      cues: [
        "Keep the bar close.",
        "Finish tall.",
        "Punch up as the feet move.",
      ],
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

  const TECHNICAL_DRILL_IDS = new Set([
    "bar-muscle-up-transition",
    "hang-power-clean-drill",
    "technique-row",
  ]);
  const NON_CONDITIONING_MOVEMENT_IDS = new Set([
    ...TECHNICAL_DRILL_IDS,
    "tall-clean-pulls",
    "front-rack-hold",
    "tall-snatch-pulls",
    "overhead-hold",
    "clean-pulls",
    "snatch-pulls",
  ]);
  const CLEAN_FAMILY_IDS = new Set([
    "clean",
    "power-clean",
    "power-cleans",
    "hang-clean",
    "hang-power-cleans",
    "clean-and-jerk",
    "clean-and-jerks",
    "dumbbell-clean-and-push-presses",
    "medicine-ball-cleans",
    "sandbag-cleans",
    "tall-clean-pulls",
    "clean-pulls",
    "front-rack-hold",
    "front-squats",
    "hang-power-clean-drill",
  ]);
  const SNATCH_FAMILY_IDS = new Set([
    "snatch",
    "power-snatch",
    "power-snatches",
    "hang-snatch",
    "hang-power-snatches",
    "dumbbell-snatches",
    "alternating-dumbbell-snatches",
    "overhead-squats",
    "single-arm-dumbbell-overhead-squats",
    "tall-snatch-pulls",
    "snatch-pulls",
    "overhead-hold",
  ]);
  const OLYMPIC_VARIATION_TYPES = Object.freeze({
    clean: "full_lift",
    "clean-and-jerk": "complex",
    "clean-and-jerks": "complex",
    "power-clean": "power",
    "power-cleans": "power",
    "hang-clean": "hang",
    "hang-power-cleans": "hang",
    "dumbbell-clean-and-push-presses": "complex",
    "medicine-ball-cleans": "power",
    "sandbag-cleans": "power",
    "tall-clean-pulls": "pull",
    "clean-pulls": "pull",
    "front-rack-hold": "position",
    "front-squats": "position",
    "hang-power-clean-drill": "technique",
    snatch: "full_lift",
    "power-snatch": "power",
    "power-snatches": "power",
    "hang-snatch": "hang",
    "hang-power-snatches": "hang",
    "dumbbell-snatches": "power",
    "alternating-dumbbell-snatches": "power",
    "tall-snatch-pulls": "pull",
    "snatch-pulls": "pull",
    "overhead-squats": "position",
    "single-arm-dumbbell-overhead-squats": "position",
    "overhead-hold": "position",
  });

  const GENERATED_MOVEMENT_SPECS = [
    ["air-squats", "air squats", "bodyweight"],
    [
      "alternating-dumbbell-snatches",
      "alternating DB snatches",
      "weightlifting",
    ],
    ["alternating-dumbbell-step-ups", "alternating DB step-ups", "mixed"],
    ["bar-muscle-ups", "bar muscle-ups", "gymnastics"],
    ["bike", "bike", "monostructural"],
    ["box-jump-overs", "box jump-overs", "gymnastics"],
    ["box-jumps", "box jumps", "gymnastics"],
    ["box-step-overs", "box step-overs", "gymnastics"],
    ["burpees", "burpees", "bodyweight"],
    ["burpees-over-bar", "burpees over bar", "bodyweight"],
    ["chest-to-bar-pull-ups", "chest-to-bar pull-ups", "gymnastics"],
    ["clean-and-jerks", "clean and jerks", "weightlifting"],
    ["crossovers", "crossovers", "gymnastics"],
    ["deadlifts", "deadlifts", "weightlifting"],
    ["double-unders", "double unders", "gymnastics"],
    [
      "dumbbell-clean-and-push-presses",
      "DB clean and push presses",
      "weightlifting",
    ],
    ["dumbbell-front-squats", "DB front squats", "weightlifting"],
    ["dumbbell-lunges", "DB lunges", "weightlifting"],
    ["dumbbell-snatches", "DB snatches", "weightlifting"],
    ["dumbbell-step-overs", "DB step-overs", "mixed"],
    ["dumbbell-thrusters", "DB thrusters", "weightlifting"],
    ["easy-bike", "easy bike", "monostructural"],
    ["easy-double-unders", "easy double unders", "gymnastics"],
    ["easy-row", "easy row", "monostructural"],
    ["easy-run", "easy run", "monostructural"],
    ["easy-shuttle-run", "easy shuttle run", "monostructural"],
    ["easy-ski", "easy ski", "monostructural"],
    ["fast-single-unders", "fast single-unders", "gymnastics"],
    ["front-squats", "front squats", "weightlifting"],
    ["goblet-squats", "goblet squats", "weightlifting"],
    ["hand-release-push-ups", "hand-release push-ups", "bodyweight"],
    ["handstand-hold", "handstand hold", "gymnastics"],
    ["hang-power-cleans", "hang power cleans", "weightlifting"],
    ["hang-power-snatches", "hang power snatches", "weightlifting"],
    ["kettlebell-swings", "KB swings", "weightlifting"],
    ["knee-to-elbow-reps", "knee-to-elbow reps", "gymnastics"],
    [
      "lateral-burpees-over-a-line",
      "lateral burpees over a line",
      "bodyweight",
    ],
    ["light-kettlebell-swings", "light KB swings", "weightlifting"],
    ["medicine-ball-cleans", "medicine-ball cleans", "weightlifting"],
    ["overhead-squats", "overhead squats", "weightlifting"],
    ["power-cleans", "power cleans", "weightlifting"],
    ["power-snatches", "power snatches", "weightlifting"],
    ["pull-ups", "pull-ups", "gymnastics"],
    ["push-jerks", "push jerks", "weightlifting"],
    ["push-ups", "push-ups", "bodyweight"],
    ["ring-muscle-ups", "ring muscle-ups", "gymnastics"],
    ["ring-rows", "ring rows", "gymnastics"],
    ["row", "row", "monostructural"],
    ["run", "run", "monostructural"],
    ["sandbag-cleans", "sandbag cleans", "weightlifting"],
    ["sandbag-to-shoulder", "sandbag-to-shoulder", "weightlifting"],
    ["shuttle-run", "shuttle run", "monostructural"],
    ["shuttle-runs", "shuttle runs", "monostructural"],
    [
      "single-arm-dumbbell-overhead-squats",
      "single-arm DB overhead squats",
      "weightlifting",
    ],
    ["sit-ups", "sit-ups", "bodyweight"],
    ["ski", "ski", "monostructural"],
    ["strict-dumbbell-presses", "strict DB presses", "weightlifting"],
    ["strict-hspu", "strict HSPU", "gymnastics"],
    ["strict-pull-ups", "strict pull-ups", "gymnastics"],
    ["strict-push-ups", "strict push-ups", "bodyweight"],
    ["tempo-goblet-squats", "tempo goblet squats", "weightlifting"],
    ["thrusters", "thrusters", "weightlifting"],
    ["toes-to-bar", "toes-to-bar", "gymnastics"],
    ["wall-balls", "wall balls", "mixed"],
    ["wall-walk", "wall walk", "gymnastics"],
    ["wall-walks", "wall walks", "gymnastics"],
    ["bar-muscle-up-transition", "bar muscle-up transition", "gymnastics"],
    ["hang-power-clean-drill", "hang power clean drill", "weightlifting"],
    ["technique-row", "technique row", "monostructural"],
    ["tall-clean-pulls", "tall clean pulls", "weightlifting"],
    ["front-rack-hold", "front-rack hold", "weightlifting"],
    ["tall-snatch-pulls", "tall snatch pulls", "weightlifting"],
    ["overhead-hold", "overhead hold", "weightlifting"],
    ["clean-pulls", "clean pulls", "weightlifting"],
    ["snatch-pulls", "snatch pulls", "weightlifting"],
    ["hang-clean", "hang clean", "weightlifting"],
    ["hang-snatch", "hang snatch", "weightlifting"],
    ["alternating-reverse-lunges", "alternating reverse lunges", "bodyweight"],
    ["walking-lunges", "walking lunges", "bodyweight"],
    ["loaded-carry", "loaded carry", "mixed"],
    ["hollow-rocks", "hollow rocks", "bodyweight"],
    ["light-barbell-reps", "light barbell reps", "weightlifting"],
    ["core-reps", "core reps", "bodyweight"],
    ["easy-machine", "easy machine", "monostructural"],
    ["zone-2-row", "zone 2 row", "monostructural"],
    ["zone-2-bike", "zone 2 bike", "monostructural"],
    ["zone-2-run", "zone 2 run", "monostructural"],
    ["zone-2-ski", "zone 2 ski", "monostructural"],
    ["zone-2-shuttle-run", "zone 2 shuttle run", "monostructural"],
    ["zone-2-double-unders", "zone 2 double unders", "gymnastics"],
    ["bike-erg", "bike erg", "monostructural"],
    ["kettlebell-front-squats", "kettlebell front squats", "weightlifting"],
    ["kettlebell-snatches", "kettlebell snatches", "weightlifting"],
    ["kettlebell-lunges", "kettlebell lunges", "weightlifting"],
    ["kettlebell-step-overs", "kettlebell step-overs", "mixed"],
    ["kettlebell-thrusters", "kettlebell thrusters", "weightlifting"],
    [
      "kettlebell-clean-and-push-presses",
      "kettlebell clean and push presses",
      "weightlifting",
    ],
    ["dumbbell-swings", "dumbbell swings", "weightlifting"],
    ["light-dumbbell-swings", "light dumbbell swings", "weightlifting"],
    ["easy-bike-erg", "easy bike erg", "monostructural"],
    ["zone-2-bike-erg", "zone 2 bike erg", "monostructural"],
    ["ring-runs", "ring runs", "gymnastics"],
    ["ring-bike-erg", "ring bike erg", "gymnastics"],
    [
      "alternating-kettlebell-step-ups",
      "alternating kettlebell step-ups",
      "mixed",
    ],
    [
      "alternating-kettlebell-snatches",
      "alternating kettlebell snatches",
      "weightlifting",
    ],
    [
      "single-arm-kettlebell-overhead-squats",
      "single-arm kettlebell overhead squats",
      "weightlifting",
    ],
  ];

  const ORDERED_MOVEMENT_POOLS = Object.freeze({
    monostructural: Object.freeze({
      stronger: ["row", "bike", "run", "double-unders", "ski"],
      endurance: ["row", "bike", "run", "ski", "shuttle-run"],
      gymnastics: ["row", "bike", "run", "double-unders", "ski"],
      balanced: ["row", "bike", "run", "double-unders", "ski"],
    }),
    gymnastics: Object.freeze({
      stronger: [
        "toes-to-bar",
        "box-jumps",
        "push-ups",
        "chest-to-bar-pull-ups",
        "wall-balls",
      ],
      endurance: [
        "burpees",
        "wall-balls",
        "sit-ups",
        "box-step-overs",
        "air-squats",
      ],
      gymnastics: [
        "pull-ups",
        "toes-to-bar",
        "chest-to-bar-pull-ups",
        "wall-walk",
        "handstand-hold",
      ],
      balanced: [
        "pull-ups",
        "wall-balls",
        "toes-to-bar",
        "burpees",
        "air-squats",
      ],
    }),
    weighted: Object.freeze({
      stronger: [
        "power-cleans",
        "dumbbell-front-squats",
        "deadlifts",
        "dumbbell-snatches",
        "push-jerks",
      ],
      endurance: [
        "light-kettlebell-swings",
        "dumbbell-snatches",
        "goblet-squats",
        "power-cleans",
        "alternating-dumbbell-step-ups",
      ],
      gymnastics: [
        "dumbbell-snatches",
        "light-kettlebell-swings",
        "overhead-squats",
        "medicine-ball-cleans",
        "dumbbell-lunges",
      ],
      balanced: [
        "power-cleans",
        "overhead-squats",
        "dumbbell-snatches",
        "kettlebell-swings",
        "clean-and-jerks",
      ],
    }),
    simpleGymnastics: Object.freeze({
      default: ["burpees", "sit-ups", "push-ups", "air-squats", "ring-rows"],
    }),
  });

  const MASTERS_MOVEMENT_VARIATIONS = Object.freeze([
    Object.freeze({
      sourceIds: ["wall-balls"],
      replacementIds: ["dumbbell-thrusters", "sandbag-to-shoulder"],
    }),
    Object.freeze({
      sourceIds: ["box-jump-overs", "box-step-overs"],
      replacementIds: ["lateral-burpees-over-a-line", "dumbbell-step-overs"],
    }),
    Object.freeze({
      sourceIds: ["toes-to-bar"],
      replacementIds: ["chest-to-bar-pull-ups", "knee-to-elbow-reps"],
    }),
    Object.freeze({
      sourceIds: ["overhead-squats"],
      replacementIds: ["front-squats", "single-arm-dumbbell-overhead-squats"],
    }),
    Object.freeze({
      sourceIds: ["shuttle-runs", "run"],
      replacementIds: ["bike", "ski"],
    }),
    Object.freeze({
      sourceIds: ["burpees", "burpees-over-bar"],
      replacementIds: ["box-jump-overs", "alternating-dumbbell-snatches"],
    }),
    Object.freeze({
      sourceIds: ["chest-to-bar-pull-ups"],
      replacementIds: ["toes-to-bar", "strict-pull-ups"],
    }),
    Object.freeze({
      sourceIds: ["row", "bike", "ski"],
      replacementIds: ["bike", "row"],
    }),
    Object.freeze({
      sourceIds: ["thrusters"],
      replacementIds: ["dumbbell-thrusters", "dumbbell-clean-and-push-presses"],
    }),
    Object.freeze({
      sourceIds: ["bar-muscle-ups"],
      replacementIds: ["ring-muscle-ups", "chest-to-bar-pull-ups"],
    }),
    Object.freeze({
      sourceIds: ["double-unders"],
      replacementIds: ["crossovers", "fast-single-unders"],
    }),
    Object.freeze({
      sourceIds: ["clean-and-jerks", "power-cleans", "power-snatches"],
      replacementIds: ["alternating-dumbbell-snatches", "sandbag-cleans"],
    }),
    Object.freeze({
      sourceIds: ["strict-hspu"],
      replacementIds: ["strict-dumbbell-presses", "hand-release-push-ups"],
    }),
  ]);

  const WEAKNESS_MOVEMENT_IDS = Object.freeze({
    squat: "tempo-goblet-squats",
    olympic: Object.freeze({
      clean: "hang-power-cleans",
      snatch: "hang-power-snatches",
    }),
    rowing: "row",
    running: "run",
    runningBodyweight: "burpees",
    pulling: "strict-pull-ups",
    muscleup: Object.freeze({
      advanced: "bar-muscle-ups",
      fallback: "chest-to-bar-pull-ups",
    }),
    t2b: "toes-to-bar",
  });

  function slugMovementId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\bdb\b/g, "dumbbell")
      .replace(/\bkb\b/g, "kettlebell")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function equipmentForMovement(id) {
    if (/ring/.test(id)) return ["rings"];
    if (/row/.test(id)) return ["rower"];
    if (/bike/.test(id)) return ["bike"];
    if (/ski/.test(id)) return ["skierg"];
    if (/run|shuttle/.test(id)) return ["running"];
    if (/pull-up|toes-to-bar|muscle-up|knee-to-elbow/.test(id))
      return ["pullupBar"];
    if (/box|step-over/.test(id)) return ["box"];
    if (/dumbbell/.test(id)) return ["dumbbells"];
    if (/kettlebell/.test(id)) return ["kettlebells"];
    if (
      /clean|snatch|jerk|deadlift|front-squat|overhead-squat|thruster/.test(id)
    ) {
      return ["barbell"];
    }
    return [];
  }

  function targetTypesForDiscipline(discipline) {
    if (discipline === "monostructural") {
      return ["calories", "distance_m", "duration_seconds", "reps"];
    }
    return ["reps", "progressive_reps", "duration_seconds"];
  }

  function movementRecord(id, displayName, discipline, options = {}) {
    const technicalDrill = TECHNICAL_DRILL_IDS.has(id);
    const conditioningEligible =
      options.conditioningEligible ?? !NON_CONDITIONING_MOVEMENT_IDS.has(id);
    return Object.freeze({
      id,
      displayName,
      baseMovementId: options.baseMovementId || id,
      aliases: Object.freeze([...(options.aliases || [])]),
      discipline,
      roles: Object.freeze(
        options.roles ||
          (technicalDrill
            ? ["skill", "technical_drill"]
            : conditioningEligible
              ? ["conditioning"]
              : ["strength", "accessory"]),
      ),
      olympicFamily: CLEAN_FAMILY_IDS.has(id)
        ? "clean"
        : SNATCH_FAMILY_IDS.has(id)
          ? "snatch"
          : null,
      olympicVariationType: OLYMPIC_VARIATION_TYPES[id] || null,
      conditioningEligible,
      equipment: Object.freeze(options.equipment || equipmentForMovement(id)),
      supportedTargetTypes: Object.freeze(
        options.supportedTargetTypes || targetTypesForDiscipline(discipline),
      ),
      ...(options.learn ? { learn: options.learn } : {}),
    });
  }

  const generatedRecords = GENERATED_MOVEMENT_SPECS.map(
    ([id, displayName, discipline]) =>
      movementRecord(id, displayName, discipline),
  );
  const generatedIds = new Set(generatedRecords.map((movement) => movement.id));
  const learnRecords = LEARN_MOVEMENTS.filter(
    (movement) => !generatedIds.has(movement.id),
  ).map((learn) =>
    movementRecord(
      learn.id,
      learn.name,
      learn.category === "Gymnastics" ? "gymnastics" : "weightlifting",
      {
        roles: ["strength", "skill"],
        conditioningEligible: false,
        learn,
      },
    ),
  );
  const learnedGeneratedRecords = generatedRecords.map((record) => {
    const learn = LEARN_MOVEMENTS.find((movement) => movement.id === record.id);
    return learn ? Object.freeze({ ...record, learn }) : record;
  });

  const MOVEMENT_CATALOG = Object.freeze([
    ...learnedGeneratedRecords,
    ...learnRecords,
  ]);
  const movementById = new Map(
    MOVEMENT_CATALOG.map((movement) => [movement.id, movement]),
  );
  const aliasToId = new Map();
  for (const movement of MOVEMENT_CATALOG) {
    aliasToId.set(slugMovementId(movement.id), movement.id);
    aliasToId.set(slugMovementId(movement.displayName), movement.id);
    for (const alias of movement.aliases)
      aliasToId.set(slugMovementId(alias), movement.id);
  }
  aliasToId.set("hang-power-clean-drills", "hang-power-clean-drill");
  aliasToId.set("bar-muscle-up-transitions", "bar-muscle-up-transition");

  const MOVEMENT_LIBRARY = Object.freeze(
    MOVEMENT_CATALOG.filter((movement) => movement.learn).map(
      (movement) => movement.learn,
    ),
  );

  function resolveMovementId(value) {
    const normalized = slugMovementId(value);
    return aliasToId.get(normalized) || normalized;
  }

  function getMovementDefinition(value) {
    return movementById.get(resolveMovementId(value)) || null;
  }

  function isRegisteredMovement(value) {
    return getMovementDefinition(value) != null;
  }

  function isConditioningEligible(value) {
    const definition = getMovementDefinition(value);
    if (definition) return definition.conditioningEligible;
    return !/\b(?:drills?|practice|rehearsal)\b/i.test(String(value || ""));
  }

  function getOlympicFamily(value) {
    const definition = getMovementDefinition(value);
    if (definition) return definition.olympicFamily;
    const movement = String(value || "").toLowerCase();
    if (/snatch|overhead squat|overhead hold/.test(movement)) return "snatch";
    if (/clean|front-rack|front rack/.test(movement)) return "clean";
    return null;
  }

  function getOlympicVariationType(value) {
    return getMovementDefinition(value)?.olympicVariationType || null;
  }

  function isMeaningfulOlympicExposure(value) {
    const definition = getMovementDefinition(value);
    return Boolean(
      definition?.olympicFamily &&
      definition.olympicVariationType &&
      definition.olympicVariationType !== "position",
    );
  }

  function sameMovement(left, right) {
    return (
      resolveMovementId(left?.movementId || left?.movement || left) ===
      resolveMovementId(right?.movementId || right?.movement || right)
    );
  }

  function getOrderedMovementPool(pool, goal = "balanced") {
    const pools = ORDERED_MOVEMENT_POOLS[pool];
    if (!pools) return [];
    return [...(pools[goal] || pools.balanced || pools.default || [])];
  }

  function getEquipmentSubstitution(value, availableEquipment) {
    const equipment = new Set(availableEquipment || []);
    const definition = getMovementDefinition(
      value?.movementId || value?.movement || value,
    );
    const movement = String(
      value?.movement || definition?.displayName || value || "",
    );
    let replacement = movement;
    let resetTarget = false;
    let clearLoad = false;

    if (/row/i.test(movement) && !equipment.has("rower")) {
      replacement = equipment.has("bike")
        ? movement.replace(/row/gi, "bike erg")
        : equipment.has("running")
          ? movement.replace(/row/gi, "run")
          : "burpees";
    } else if (/bike/i.test(movement) && !equipment.has("bike")) {
      replacement = equipment.has("rower")
        ? movement.replace(/bike(?: erg)?/gi, "row")
        : equipment.has("running")
          ? movement.replace(/bike(?: erg)?/gi, "run")
          : "burpees";
    } else if (/run|shuttle/i.test(movement) && !equipment.has("running")) {
      replacement = equipment.has("rower")
        ? "row"
        : equipment.has("bike")
          ? "bike erg"
          : "burpees";
    }
    if (replacement !== movement && replacement === "burpees") {
      resetTarget = true;
      clearLoad = true;
    }
    if (/dumbbell|\bDB\b/i.test(replacement) && !equipment.has("dumbbells")) {
      if (equipment.has("kettlebells")) {
        replacement = replacement.replace(/dumbbell|\bDB\b/gi, "kettlebell");
      } else {
        replacement = "alternating reverse lunges";
        resetTarget = true;
        clearLoad = true;
      }
    }
    if (
      /kettlebell|\bKB\b/i.test(replacement) &&
      !equipment.has("kettlebells")
    ) {
      if (equipment.has("dumbbells")) {
        replacement = replacement.replace(/kettlebell|\bKB\b/gi, "dumbbell");
      } else {
        replacement = "air squats";
        resetTarget = true;
        clearLoad = true;
      }
    }
    if (/box (?:jump|step)/i.test(replacement) && !equipment.has("box")) {
      replacement = replacement.replace(
        /box (?:jump|step)(?:-over)?s?/gi,
        "walking lunges",
      );
    }
    if (/ring/i.test(replacement) && !equipment.has("rings")) {
      replacement = replacement.replace(/ring rows?/gi, "strict pull-ups");
    }

    return Object.freeze({
      movementId: resolveMovementId(replacement),
      displayName: replacement,
      resetTarget,
      clearLoad,
    });
  }

  function getBarbellDropSubstitution(value) {
    const definition = getMovementDefinition(
      value?.movementId || value?.movement || value,
    );
    const movement = String(
      value?.movement || definition?.displayName || value || "",
    );
    const replacementId = /press|thruster|jerk/i.test(movement)
      ? "hand-release-push-ups"
      : /squat/i.test(movement)
        ? "air-squats"
        : "alternating-reverse-lunges";
    return getMovementDefinition(replacementId);
  }

  const MOVEMENT_CATALOG_API = Object.freeze({
    MASTERS_MOVEMENT_VARIATIONS,
    MOVEMENT_CATALOG,
    MOVEMENT_LIBRARY,
    ORDERED_MOVEMENT_POOLS,
    WEAKNESS_MOVEMENT_IDS,
    getMovementDefinition,
    getBarbellDropSubstitution,
    getEquipmentSubstitution,
    getOlympicFamily,
    getOlympicVariationType,
    getOrderedMovementPool,
    isConditioningEligible,
    isMeaningfulOlympicExposure,
    isRegisteredMovement,
    resolveMovementId,
    sameMovement,
  });

  if (typeof globalScope !== "undefined") {
    /** @type {any} */ (globalScope).ForgeHourMovementCatalog =
      MOVEMENT_CATALOG_API;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = MOVEMENT_CATALOG_API;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
