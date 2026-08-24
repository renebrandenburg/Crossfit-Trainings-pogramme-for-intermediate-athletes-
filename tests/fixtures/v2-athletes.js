"use strict";

const INTERMEDIATE_V2_ATHLETE = Object.freeze({
  athleteLevel: "intermediate",
  maxes: Object.freeze({
    front_squat: 125,
    back_squat: 145,
    deadlift: 180,
    snatch: 75,
    clean_and_jerk: 100,
    strict_press: 60,
  }),
  skills: Object.freeze({
    pullUps: 10,
    chestToBar: 5,
    toesToBar: 8,
    barMuscleUps: 0,
    strictHspu: 0,
    ringDips: 6,
    handstandWalkMeters: 0,
  }),
  equipment: Object.freeze([
    "barbell",
    "rack",
    "pull-up bar",
    "rings",
    "dumbbell",
    "box",
    "rower",
    "bike",
    "ski erg",
    "band",
    "PVC",
  ]),
});

module.exports = { INTERMEDIATE_V2_ATHLETE };
