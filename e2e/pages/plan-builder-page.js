"use strict";

const { expect } = require("@playwright/test");

class PlanBuilderPage {
  constructor(page) {
    this.page = page;
    this.generatorForm = page.locator("#programmeGeneratorForm");
    this.customPlanForm = page.locator("#customPlanForm");
  }

  async open() {
    await this.page.getByRole("button", { name: "Build", exact: true }).click();
    await this.page
      .getByRole("heading", { name: "Programme builder" })
      .waitFor();
  }

  async createCustomPlan({
    planName,
    sessionTitle,
    week = "2",
    focus = "Engine and pull-up quality",
    warmup = "8 min easy row\nDynamic shoulders",
    strength = "EMOM 10: strict pull-ups",
    wod = "AMRAP 16: 12 cal row, 10 DB snatches, 8 burpees",
    mobility = "5 min easy breathing",
    duration = "55",
    intensity = "Moderate",
  }) {
    await this.customPlanForm.locator("#customPlanWeek").selectOption(week);
    await this.customPlanForm.getByLabel("Day or title").fill(sessionTitle);
    await this.customPlanForm.getByLabel("Focus", { exact: true }).fill(focus);
    await this.customPlanForm.getByLabel("Warm-up").fill(warmup);
    await this.customPlanForm.getByLabel("Strength or skill").fill(strength);
    await this.customPlanForm.getByLabel("WOD", { exact: true }).fill(wod);
    await this.customPlanForm.getByLabel("Cooldown or mobility").fill(mobility);
    await this.customPlanForm
      .getByLabel("Duration", { exact: true })
      .fill(duration);
    await this.customPlanForm.getByLabel("Intensity").selectOption(intensity);
    await this.customPlanForm
      .getByRole("button", { name: "Save training session" })
      .click();
    await this.page
      .getByText("Training session saved.", { exact: true })
      .waitFor();

    await this.page.getByLabel("Plan name").fill(planName);
    await this.page.getByRole("button", { name: "Save plan name" }).click();
    await this.page
      .getByText("Custom plan updated.", { exact: true })
      .waitFor();
  }

  async editSession(currentTitle, { title, focus, duration }) {
    const card = this.page
      .locator("#customProgramList article")
      .filter({ has: this.page.getByRole("heading", { name: currentTitle }) });
    await card.getByRole("button", { name: "Edit" }).click();
    await this.page
      .getByRole("heading", { name: "Edit training session" })
      .waitFor();
    if (title) await this.customPlanForm.getByLabel("Day or title").fill(title);
    if (focus) {
      await this.customPlanForm
        .getByLabel("Focus", { exact: true })
        .fill(focus);
    }
    if (duration) {
      await this.customPlanForm
        .getByLabel("Duration", { exact: true })
        .fill(duration);
    }
    await this.customPlanForm
      .getByRole("button", { name: "Update training session" })
      .click();
    await this.page
      .getByText("Training session updated.", { exact: true })
      .waitFor();
  }

  async deleteActivePlan() {
    this.page.once("dialog", (dialog) => dialog.accept());
    await this.page.getByRole("button", { name: "Delete custom plan" }).click();
    await this.page
      .getByText("Custom plan deleted.", { exact: true })
      .waitFor();
  }

  async waitForSync() {
    await expect(this.page.locator(".app-shell")).toHaveAttribute(
      "data-sync-message",
      "Profile and programme changes synced.",
    );
  }

  async waitForHydration() {
    await expect(this.page.locator(".app-shell")).toHaveAttribute(
      "data-sync-message",
      "Profile, programmes, logs, and PRs are syncing.",
    );
  }

  /**
   * @param {{
   *   goal: string,
   *   days?: string,
   *   totalDays?: string,
   *   secondaryGoal?: string,
   *   weakness?: string,
   *   athleteLevel?: string,
   *   duration?: string,
   *   barMuscleUpLevel?: string,
   *   boxDays?: string
   * }} options
   */
  async generate({
    goal,
    days = "4",
    totalDays = "4",
    secondaryGoal,
    weakness,
    athleteLevel = "intermediate",
    duration = "60",
    barMuscleUpLevel,
    boxDays,
  }) {
    await this.generatorForm.getByLabel("Main goal").selectOption(goal);
    if (secondaryGoal) {
      await this.generatorForm
        .getByLabel("Secondary goal (optional)")
        .selectOption(secondaryGoal);
    }
    await this.generatorForm
      .getByLabel("Total weekly training")
      .selectOption(totalDays);
    await this.generatorForm
      .getByLabel("App-programmed sessions")
      .selectOption(days);
    if (weakness) {
      await this.generatorForm
        .getByLabel("Biggest weakness")
        .selectOption(weakness);
    }
    if (barMuscleUpLevel) {
      await this.generatorForm
        .getByLabel("Current bar muscle-up level")
        .selectOption(barMuscleUpLevel);
    }
    await this.generatorForm
      .getByLabel("Max session length")
      .selectOption(duration);
    if (boxDays) {
      await this.generatorForm
        .getByLabel("I also follow workouts at a CrossFit box")
        .check();
      await this.generatorForm
        .getByLabel("Expected box workouts")
        .fill(boxDays);
    }
    await this.generatorForm
      .getByLabel("Athlete programming level")
      .selectOption(athleteLevel);
    await this.generatorForm
      .getByRole("button", { name: /(?:Generate|Regenerate) 8-week programme/ })
      .click();
    await this.page
      .getByText(
        /(?:Generated|Regenerated) \d+ sessions\.|Updated to \d+ app sessions per week\./,
      )
      .waitFor();
  }

  async expectActivePlan(name) {
    await expect(this.page.getByLabel("Active plan")).toHaveValue(/.+/);
    await expect(
      this.page.getByLabel("Active plan").locator("option:checked"),
    ).toHaveText(name);
  }
}

module.exports = { PlanBuilderPage };
