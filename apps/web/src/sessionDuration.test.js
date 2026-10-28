import assert from "node:assert/strict";
import { test } from "node:test";
import { getSessionDurationSeconds } from "./sessionDuration.js";

const startedAt = "2026-10-27T10:00:00.000Z";
const updatedAt = "2026-10-27T10:02:30.000Z";

test("counts an active session up to the current time", () => {
  assert.equal(
    getSessionDurationSeconds({ state: "active", createdAt: startedAt, updatedAt }, Date.parse("2026-10-27T10:02:00.000Z")),
    120
  );
});

test("uses the final update time for completed sessions", () => {
  assert.equal(getSessionDurationSeconds({ state: "completed", createdAt: startedAt, updatedAt }, 0), 150);
});

test("uses the final update time for failed sessions", () => {
  assert.equal(getSessionDurationSeconds({ state: "failed", createdAt: startedAt, updatedAt }, 0), 150);
});

test("clamps negative durations to zero", () => {
  assert.equal(
    getSessionDurationSeconds({ state: "active", createdAt: "2026-10-27T10:01:00.000Z", updatedAt }, Date.parse(startedAt)),
    0
  );
});

test("returns null when a timestamp is invalid", () => {
  assert.equal(getSessionDurationSeconds({ state: "failed", createdAt: "invalid", updatedAt }, 0), null);
});
