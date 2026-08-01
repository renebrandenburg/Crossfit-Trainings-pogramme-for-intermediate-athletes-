"use strict";

class AccountPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.getByRole("button", { name: "More", exact: true }).click();
    await this.page
      .getByRole("heading", { name: "Database sync", exact: true })
      .waitFor();
  }

  async loginWithEmail(email) {
    await this.open();
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByRole("button", { name: "Email sign-in link" }).click();
  }

  async expectSignedIn() {
    await this.open();
    await this.page.getByText("Signed in", { exact: true }).waitFor();
    await this.page.getByRole("button", { name: "Sign out" }).waitFor();
  }
}

module.exports = { AccountPage };
