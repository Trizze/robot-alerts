import test from "node:test";
import assert from "node:assert/strict";
import { serviceUrls } from "../src/urls.js";

test("same-origin service URLs retain the public API base path", () => {
  for (const base of [
    "https://trizze.tv/robot/api",
    "https://trizze.tv/robot/api/",
  ])
    assert.deepEqual(serviceUrls(base, "https://trizze.tv/robot/"), {
      callback: "https://trizze.tv/robot/api/auth/callback",
      webhookCallback: "https://trizze.tv/robot/api/eventsub",
      frontendUrl: "https://trizze.tv/robot/",
    });
});
test("service rejects insecure, cross-origin, credential-bearing and parameterized URLs", () => {
  for (const base of [
    "http://trizze.tv/robot/api/",
    "https://elsewhere.invalid/api/",
    "https://user@trizze.tv/robot/api/",
    "https://trizze.tv/robot/api/?x=1",
    "https://trizze.tv/robot/api/#x",
  ])
    assert.throws(() => serviceUrls(base, "https://trizze.tv/robot/"));
});
