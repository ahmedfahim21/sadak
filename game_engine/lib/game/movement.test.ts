import { test } from "node:test";
import assert from "node:assert/strict";
import { newBody, stepBody, WALK_SPEED, SPRINT_SPEED, JUMP_SPEED, type MoveInput } from "./movement";

const DT = 1 / 60;
const go = (dx: number, dz: number, extra: Partial<MoveInput> = {}): MoveInput => ({
  dx,
  dz,
  sprint: false,
  jumpPressed: false,
  jumpHeld: false,
  control: 1,
  ...extra,
});
const run = (b: ReturnType<typeof newBody>, input: MoveInput, seconds: number) => {
  let last = stepBody(b, input, DT);
  for (let t = DT; t < seconds; t += DT) last = stepBody(b, { ...input, jumpPressed: false }, DT);
  return last;
};
const speed = (b: ReturnType<typeof newBody>) => Math.hypot(b.vx, b.vz);

test("speed builds up and bleeds off over a moment, not instantly", () => {
  const b = newBody();
  stepBody(b, go(0, 1), DT);
  assert.ok(speed(b) < 0.5, "full speed on the first frame");
  run(b, go(0, 1), 0.5);
  assert.ok(Math.abs(speed(b) - WALK_SPEED) < 0.05, `walk top speed ${speed(b)}`);
  run(b, go(0, 0), 0.08);
  assert.ok(speed(b) > 1 && speed(b) < WALK_SPEED, "stopped dead");
  run(b, go(0, 0), 0.4);
  assert.equal(speed(b), 0);
});

test("sprinting takes longer to reach a higher top speed", () => {
  const b = newBody();
  run(b, go(0, 1, { sprint: true }), 0.4);
  assert.ok(speed(b) < SPRINT_SPEED - 1, "sprint top speed at once");
  run(b, go(0, 1, { sprint: true }), 1.5);
  assert.ok(Math.abs(speed(b) - SPRINT_SPEED) < 0.05);
});

test("turning back brakes through a stop instead of flipping velocity", () => {
  const b = newBody();
  run(b, go(0, 1), 0.6);
  let slowest = Infinity;
  for (let t = 0; t < 0.6; t += DT) {
    stepBody(b, go(0, -1), DT);
    slowest = Math.min(slowest, speed(b));
  }
  assert.ok(slowest < 0.6, `never slowed down (min ${slowest.toFixed(2)})`);
  assert.ok(b.vz < -WALK_SPEED * 0.5, "not going the new way");
});

test("the body turns toward travel at a limited rate, faster when slow", () => {
  const b = newBody(0);
  run(b, go(0, 1), 0.6);
  const r = stepBody(b, go(1, 0), DT);
  assert.ok(Math.abs(b.facing) < 0.3, "snapped round in a frame");
  assert.ok(r.turn > 0, "turned the wrong way");
  run(b, go(1, 0), 0.8);
  assert.ok(Math.abs(b.facing - Math.PI / 2) < 0.05, `facing ${b.facing}`);
});

test("a jump winds up, rises higher when held, and lands in a crouch", () => {
  const tap = newBody();
  const r0 = stepBody(tap, go(0, 0, { jumpPressed: true }), DT);
  assert.equal(tap.y, 0, "left the ground before the wind-up");
  assert.ok(r0.crouch > 0, "no wind-up crouch");
  let peakTap = 0;
  let landed = false;
  for (let t = 0; t < 1.5 && !landed; t += DT) {
    const r = stepBody(tap, go(0, 0), DT);
    peakTap = Math.max(peakTap, tap.y);
    landed = r.landed;
  }
  assert.ok(landed, "never came down");
  assert.ok(tap.land > 0.3, "no landing squash");

  const held = newBody();
  stepBody(held, go(0, 0, { jumpPressed: true, jumpHeld: true }), DT);
  let peakHeld = 0;
  for (let t = 0; t < 1.5; t += DT) {
    stepBody(held, go(0, 0, { jumpHeld: true }), DT);
    peakHeld = Math.max(peakHeld, held.y);
  }
  assert.ok(peakHeld > peakTap * 1.2, `held ${peakHeld.toFixed(2)} vs tapped ${peakTap.toFixed(2)}`);
  assert.ok(peakTap > (JUMP_SPEED * JUMP_SPEED) / (2 * 16) * 0.9, "a tap barely hops");
});

test("a press just before landing jumps again on landing", () => {
  const b = newBody();
  stepBody(b, go(0, 0, { jumpPressed: true }), DT);
  // Fall until just before touchdown, then press.
  for (let t = 0; t < 2; t += DT) {
    stepBody(b, go(0, 0), DT);
    if (b.vy < 0 && b.y < 0.1) break;
  }
  stepBody(b, go(0, 0, { jumpPressed: true }), DT);
  let again = false;
  for (let t = 0; t < 0.4; t += DT) if (stepBody(b, go(0, 0), DT).tookOff) again = true;
  assert.ok(again, "buffered jump was dropped");
});

test("no control while knocked aside: the body coasts to a stop", () => {
  const b = newBody();
  run(b, go(0, 1), 0.6);
  run(b, go(0, 1, { control: 0 }), 0.5);
  assert.equal(speed(b), 0);
  stepBody(b, go(0, 0, { jumpPressed: true, control: 0 }), DT);
  assert.equal(b.windup, 0, "jumped while stumbling");
});

test("sprint breath: about ten seconds flat out, winded until a third is back, quicker to recover standing", async () => {
  const { newStamina, stepStamina } = await import("./movement");
  const dt = 1 / 60;
  const s = newStamina();
  let t = 0;
  while (stepStamina(s, true, true, dt)) t += dt;
  assert.ok(t > 9.5 && t < 10.5, `sprinted ${t.toFixed(2)}s`);
  assert.equal(s.winded, true);
  // Winded: holding sprint gets nothing until it's back to a third.
  let wait = 0;
  while (!stepStamina(s, true, true, dt)) wait += dt;
  // (less the one frame of sprint it has just spent)
  assert.ok(s.level >= 0.35 - dt / 10 - 1e-9, `sprinting again at ${s.level.toFixed(3)}`);
  assert.ok(wait > 2, `winded for only ${wait.toFixed(2)}s`);
  // Standing still refills faster than walking.
  const still = { level: 0.2, winded: false };
  const walking = { level: 0.2, winded: false };
  for (let i = 0; i < 60; i++) {
    stepStamina(still, false, false, dt);
    stepStamina(walking, false, true, dt);
  }
  assert.ok(still.level > walking.level);
  // Not moving: holding shift doesn't spend any.
  const idle = newStamina();
  assert.equal(stepStamina(idle, true, false, dt), false);
  assert.equal(idle.level, 1);
});

test("a sprint covers real ground: 30m+ in three seconds from a standstill, over twice a walk", async () => {
  const { HeroAnimator } = await import("./hero");
  const run = (sprint: boolean) => {
    const b = newBody(0);
    let z = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 180; i++) {
      stepBody(b, { dx: 0, dz: 1, sprint, jumpPressed: false, jumpHeld: false, control: 1 }, dt);
      z += b.vz * dt;
    }
    return z;
  };
  const sprint = run(true);
  const walk = run(false);
  assert.ok(sprint >= 30, `sprinted ${sprint.toFixed(1)}m`);
  assert.ok(sprint > walk * 2, `sprint ${sprint.toFixed(1)}m vs walk ${walk.toFixed(1)}m`);
  // Long strides, not spinning legs: a human cadence even flat out.
  const cadence = SPRINT_SPEED / HeroAnimator.stepLength(SPRINT_SPEED);
  assert.ok(cadence < 4.6, `${cadence.toFixed(2)} steps/s at a sprint`);
});
