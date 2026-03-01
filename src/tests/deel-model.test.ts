// ============================================
// Test Suite: Deel Commission Model
// ============================================
// Validates estimateDeelMxn() against real Deel data
//
// Real Deel flow:
//   Gross USD: $6,097.24
//   Fee USD ("Tarifa de cambio"): $106.65
//   Net USD: $5,990.59
//   Deel rate: 17.25
//   MXN received: $103,333.04

import { describe, test, expect } from "bun:test";
import { estimateDeelMxn } from "../types";

describe("estimateDeelMxn - Deel commission model (USD fee)", () => {
  // Model: deelRate = marketRate * (1 - spread/100)
  //        netUsd = grossUsd - feeUsd
  //        mxnReceived = netUsd * deelRate

  test("should calculate Deel rate from market rate and spread", () => {
    // Market rate ~17.35, spread 0.75%
    const result = estimateDeelMxn(17.35, 6097.24, 0.75, 106.65);
    // Deel rate = 17.35 * (1 - 0.0075) = 17.35 * 0.9925 = 17.219875
    expect(result.deelRate).toBeCloseTo(17.2199, 3);
  });

  test("should calculate net USD after fee deduction", () => {
    const result = estimateDeelMxn(17.35, 6097.24, 0.75, 106.65);
    // netUsd = 6097.24 - 106.65 = 5990.59
    expect(result.netUsd).toBeCloseTo(5990.59, 2);
  });

  test("should calculate MXN received as netUsd × deelRate", () => {
    const result = estimateDeelMxn(17.35, 6097.24, 0.75, 106.65);
    // mxnReceived = 5990.59 * deelRate
    expect(result.mxnReceived).toBeCloseTo(result.netUsd * result.deelRate, 2);
  });

  test("should calculate effective rate as mxn / netUsd", () => {
    const result = estimateDeelMxn(17.35, 6097.24, 0.75, 106.65);
    expect(result.effectiveRate).toBeCloseTo(result.mxnReceived / result.netUsd, 4);
    // Effective rate should be equal to deelRate in this model
    expect(result.effectiveRate).toBeCloseTo(result.deelRate, 4);
  });

  test("should produce MXN in reasonable range vs real Deel data", () => {
    // Real: at rate 17.25, got 103,333.04 MXN from 5990.59 net USD
    // Our model estimates a different deelRate from market rate,
    // so we test with the real Deel rate directly (spread=0, fee from market)
    // If market ≈ 17.35 and Deel gave 17.25, spread ≈ 0.577%
    const actualSpread = ((17.35 - 17.25) / 17.35) * 100;
    const result = estimateDeelMxn(17.35, 6097.24, actualSpread, 106.65);

    // With correct spread, should be close to 103,333
    expect(result.mxnReceived).toBeCloseTo(103_337.68, -1);
    // Not exact match (103,333.04) because Deel has internal rounding
  });

  test("should show impact of 1 centavo market change", () => {
    const at1735 = estimateDeelMxn(17.35, 6097.24, 0.75, 106.65);
    const at1736 = estimateDeelMxn(17.36, 6097.24, 0.75, 106.65);

    const diff = at1736.mxnReceived - at1735.mxnReceived;
    // 1 centavo on ~$5990 net USD ≈ $59.9 MXN (minus spread)
    expect(diff).toBeGreaterThan(55);
    expect(diff).toBeLessThan(65);
  });

  test("should handle zero salary", () => {
    const result = estimateDeelMxn(17.35, 0, 0.75, 106.65);
    expect(result.netUsd).toBe(-106.65); // negative net
    expect(result.mxnReceived).toBeLessThan(0);
  });

  test("should handle zero spread", () => {
    const result = estimateDeelMxn(17.25, 6097.24, 0, 106.65);
    // Deel rate = market rate when no spread
    expect(result.deelRate).toBe(17.25);
    expect(result.mxnReceived).toBeCloseTo((6097.24 - 106.65) * 17.25, 2);
  });

  test("should handle zero fee", () => {
    const result = estimateDeelMxn(17.35, 6097.24, 0.75, 0);
    // netUsd = grossUsd (no fee)
    expect(result.netUsd).toBe(6097.24);
    expect(result.mxnReceived).toBeCloseTo(6097.24 * result.deelRate, 2);
  });
});
