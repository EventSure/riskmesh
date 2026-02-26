import test from 'node:test';
import assert from 'node:assert/strict';

const BPS = 10_000;

function effectiveReinsurerBps(ceded, commission) {
  return Math.floor((ceded * (BPS - commission)) / BPS);
}

function splitByBps(total, ratios) {
  const out = ratios.map((r) => Math.floor((total * r) / BPS));
  const allocated = out.reduce((a, b) => a + b, 0);
  out[0] += total - allocated;
  return out;
}

function payout(delayMinutes, cancelled) {
  if (cancelled || delayMinutes >= 360) return 100;
  if (delayMinutes >= 240) return 80;
  if (delayMinutes >= 180) return 60;
  if (delayMinutes >= 120) return 40;
  return 0;
}

test('effective reinsurer ratio is 45% with 50% cession and 10% commission', () => {
  assert.equal(effectiveReinsurerBps(5000, 1000), 4500);
});

test('claim settlement split follows 45:55 and 5:3:2 insurer split', () => {
  const C = 500_000;
  const reinsBps = effectiveReinsurerBps(5000, 1000);
  const reinsCost = Math.floor((C * reinsBps) / BPS);
  const insurerCost = C - reinsCost;
  const insurerParts = splitByBps(insurerCost, [5000, 3000, 2000]);

  assert.equal(reinsCost, 225_000);
  assert.deepEqual(insurerParts, [137_500, 82_500, 55_000]);
  assert.equal(insurerParts.reduce((a, b) => a + b, 0) + reinsCost, C);
});

test('premium split follows 45:55 and 5:3:2 insurer split', () => {
  const P = 1_000_000;
  const reinsBps = effectiveReinsurerBps(5000, 1000);
  const reinsPremium = Math.floor((P * reinsBps) / BPS);
  const insurerPremium = P - reinsPremium;
  const insurerParts = splitByBps(insurerPremium, [5000, 3000, 2000]);

  assert.equal(reinsPremium, 450_000);
  assert.deepEqual(insurerParts, [275_000, 165_000, 110_000]);
  assert.equal(insurerParts.reduce((a, b) => a + b, 0) + reinsPremium, P);
});

test('delay tiers are computed correctly', () => {
  assert.equal(payout(110, false), 0);
  assert.equal(payout(130, false), 40);
  assert.equal(payout(210, false), 60);
  assert.equal(payout(250, false), 80);
  assert.equal(payout(380, false), 100);
  assert.equal(payout(30, true), 100);
});
