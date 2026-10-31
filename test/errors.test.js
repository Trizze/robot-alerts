import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError, classifyRequestError } from "../src/errors.js";

test("expected invalid input returns 400; unexpected failures return 500 without exposing details", () => {
  const logs = [];
  assert.equal(
    classifyRequestError(new ValidationError("invalid"), (text) =>
      logs.push(text),
    ).status,
    400,
  );
  assert.equal(logs.length, 0);
  const marker = "sensitive diagnostic marker";
  const response = classifyRequestError(new Error(marker), (text) =>
    logs.push(text),
  );
  assert.equal(response.status, 500);
  assert.ok(!JSON.stringify(response).includes(marker));
  assert.ok(!logs.join(" ").includes(marker));
});
