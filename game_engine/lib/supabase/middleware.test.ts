import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicPath } from "./middleware";
import { config } from "../../middleware";

test("a public page is public with or without a trailing slash; the game is not", () => {
  for (const p of ["/login", "/login/", "/privacy", "/terms/", "/auth/callback"]) assert.equal(isPublicPath(p), true, p);
  for (const p of ["/", "/leaderboard", "/api/districts", "/loginx"]) assert.equal(isPublicPath(p), false, p);
});

test("the auth middleware leaves the PostHog proxy and static files alone, and guards the app and the API", () => {
  // The matcher is a path-to-regexp pattern; this one is plain regex syntax.
  const runs = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));
  for (const p of ["/ingest/e/", "/ingest/static/array.js", "/ingest/flags/", "/_next/static/x.js", "/covers/game/purani-sadak.jpg"]) {
    assert.equal(runs(p), false, `middleware runs on ${p}`);
  }
  for (const p of ["/", "/login", "/login/", "/api/districts", "/leaderboard"]) assert.equal(runs(p), true, `middleware skips ${p}`);
});
