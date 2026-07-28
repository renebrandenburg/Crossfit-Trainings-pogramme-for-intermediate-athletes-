"use strict";

const crypto = require("node:crypto");

function uniqueTestData(prefix = "E2E") {
  const testRunId = crypto.randomUUID();
  return {
    testRunId,
    planName: `${prefix} Plan ${testRunId}`,
    sessionTitle: `${prefix} Session ${testRunId}`,
    updatedTitle: `${prefix} Updated ${testRunId}`,
  };
}

module.exports = { uniqueTestData };
