"use strict";

async function readAppState(page) {
  return page.evaluate(() => {
    const localStateApi = window.ForgeHourLocalState;
    if (!localStateApi) throw new Error("Local state API is missing.");
    const state = localStateApi
      .createLocalStateStore(window.localStorage)
      .load();
    if (!state) throw new Error("Application state is missing.");
    return state;
  });
}

async function readActivePlan(page) {
  const state = await readAppState(page);
  const plan = state.plans.find(
    (candidate) => candidate.id === state.activePlanId,
  );
  if (!plan) throw new Error("Active plan is missing.");
  return plan;
}

function workoutExercises(definition) {
  const formatExercises =
    definition?.format?.type === "emom"
      ? (definition.format.stations || []).flatMap(
          (station) => station.exercises || [],
        )
      : definition?.exercises || [];
  return [
    ...(definition?.buyIn || []),
    ...formatExercises,
    ...(definition?.afterEachRound || []),
    ...(definition?.cashOut || []),
  ];
}

module.exports = { readActivePlan, readAppState, workoutExercises };
