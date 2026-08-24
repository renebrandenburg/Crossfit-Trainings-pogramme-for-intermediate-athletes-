"use strict";

class PlanOverviewPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page
      .getByRole("button", { name: "Calendar", exact: true })
      .click();
  }

  programmeDetails(name) {
    return this.page.locator(".calendar-programme-details").filter({
      hasText: name,
    });
  }
}

module.exports = { PlanOverviewPage };
