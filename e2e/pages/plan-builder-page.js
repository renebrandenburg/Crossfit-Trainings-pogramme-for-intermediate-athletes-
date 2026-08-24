"use strict";

const { expect } = require("@playwright/test");

class PlanBuilderPage {
  constructor(page) {
    this.page = page;
    this.customPlanForm = page.locator("#customPlanForm");
  }

  async open() {
    await this.page.getByRole("button", { name: "More", exact: true }).click();
    await this.page
      .getByRole("button", { name: "Build programme", exact: true })
      .click();
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

  async generateV2({
    goal = "mixed",
    blockType = "mixed_strength",
    templateId = "mixed_strength_6w",
    frequency = 2,
    preferredDays = ["tuesday", "saturday"],
    athleteLevel = "intermediate",
  } = {}) {
    const setup = this.page.locator(".v2-programme-setup");
    await setup.locator('select[name="v2Goal"]').selectOption(goal);
    await setup.locator('select[name="v2BlockType"]').selectOption(blockType);
    await setup.locator('select[name="v2TemplateId"]').selectOption(templateId);
    await setup
      .locator('select[name="v2AthleteLevel"]')
      .selectOption(athleteLevel);
    if (templateId !== "strict_strength_8w") {
      await setup
        .locator('select[name="v2Frequency"]')
        .selectOption(String(frequency));
    }
    for (const checkbox of await setup
      .locator('input[name="v2PreferredDay"]')
      .all()) {
      const selected = preferredDays.includes(await checkbox.inputValue());
      if (selected) await checkbox.check();
      else await checkbox.uncheck();
    }
    await setup.getByRole("button", { name: /Generate .*block/ }).click();
    await this.page
      .getByText(/Generated a connected \d+-week, \d+-session V2 block\./)
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
