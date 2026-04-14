export const TRUEGO_INTERNAL_PI_USD_RATE = 314159;
export const TRUEGO_PI_DECIMALS = 8;
export const TRUEGO_MIN_PI_AMOUNT = 0.000001;

function roundToPiDecimals(value: number): number {
  return Number(value.toFixed(TRUEGO_PI_DECIMALS));
}

export function usdToPiAmount(usdAmount: number): number {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return TRUEGO_MIN_PI_AMOUNT;
  }

  const rawPi = usdAmount / TRUEGO_INTERNAL_PI_USD_RATE;
  const rounded = roundToPiDecimals(rawPi);

  return Math.max(rounded, TRUEGO_MIN_PI_AMOUNT);
}

export function demoFareToPayablePi(displayFareValue: number): number {
  return usdToPiAmount(displayFareValue);
}

export function formatPiAmount(amount: number): string {
  return `${amount.toFixed(TRUEGO_PI_DECIMALS)} Pi`;
}

export function formatInternalRate(): string {
  return `1 Pi = ${TRUEGO_INTERNAL_PI_USD_RATE.toLocaleString()} USD`;
}
