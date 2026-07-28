"use strict";

class PlanOverviewPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.getByRole("button", { name: "Plan", exact: true }).click();
  }

  heading(name) {
    return this.page.getByRole("heading", { name, exact: true });
  }
}

module.exports = { PlanOverviewPage };
