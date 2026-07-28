"use strict";

class AppShell {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.goto("/");
    await this.page
      .getByRole("heading", {
        name: "CrossFit Training Programme",
        level: 1,
      })
      .waitFor();
  }

  async navigate(name) {
    await this.page.getByRole("button", { name, exact: true }).click();
  }
}

module.exports = { AppShell };
