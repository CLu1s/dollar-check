// ============================================
// Dollar Check Bot - Open Exchange Rates Client
// ============================================

import { saveRate, getLatestRate } from "./database";

interface OXRResponse {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string;
  rates: Record<string, number>;
}

export async function fetchCurrentRate(appId: string): Promise<number> {
  const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=MXN`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OXR API error (${response.status}): ${errorText}`);
    }

    const data: OXRResponse = await response.json();
    const rate = data.rates.MXN;

    if (!rate || rate <= 0) {
      throw new Error(`Invalid MXN rate received: ${rate}`);
    }

    // Save to database
    saveRate(rate, data.timestamp);

    console.log(`[Exchange] USD/MXN: ${rate.toFixed(4)} (${new Date(data.timestamp * 1000).toISOString()})`);

    return rate;
  } catch (error) {
    console.error("[Exchange] Failed to fetch rate:", error);

    // Return last known rate if available
    const lastRate = getLatestRate();
    if (lastRate) {
      console.log(`[Exchange] Using cached rate: ${lastRate.rate}`);
      return lastRate.rate;
    }

    throw error;
  }
}

/**
 * Tasa de cierre de un día (YYYY-MM-DD, en UTC). Devuelve también el timestamp
 * de OXR: es el que hay que guardar, porque ubica la tasa en su día real.
 */
export async function fetchHistoricalRate(
  appId: string,
  date: string
): Promise<{ rate: number; timestamp: number }> {
  const url = `https://openexchangerates.org/api/historical/${date}.json?app_id=${appId}&symbols=MXN`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OXR historical API error (${response.status})`);
  }

  const data: OXRResponse = await response.json();
  return { rate: data.rates.MXN, timestamp: data.timestamp };
}
