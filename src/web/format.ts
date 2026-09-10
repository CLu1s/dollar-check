// Formatos es-MX del dashboard. Las fechas llegan ya como día local de la
// config ("YYYY-MM-DD"), así que se formatean en UTC para no moverlas de día.

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});
const MINUS = "−";

/** "$103,452" */
export const mxn = (n: number) => MXN.format(n);

/** "US$6,097.24": el prefijo evita confundirlo con pesos. */
export const usd = (n: number) =>
  `US$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "+$1,234" / "−$832" */
export const signedMxn = (n: number) => `${n >= 0 ? "+" : MINUS}${MXN.format(Math.abs(n))}`;

/** Tasas: 4 decimales como en Telegram. */
export const rate = (n: number, digits = 4) => n.toFixed(digits);

/** "+1.21%" / "−0.80%" */
export const signedPct = (n: number, digits = 2) => `${n >= 0 ? "+" : MINUS}${Math.abs(n).toFixed(digits)}%`;

const utcDate = (ymd: string) => {
  const [y, m, d = 1] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const DAY_SHORT = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY_LONG = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH = new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric", timeZone: "UTC" });

/** "10 sept" */
export const dayShort = (ymd: string) => DAY_SHORT.format(utcDate(ymd));
/** "mié, 10 sept 2026" */
export const dayLong = (ymd: string) => DAY_LONG.format(utcDate(ymd));
/** "ago 2026" */
export const monthLabel = (ym: string) => MONTH.format(utcDate(ym));

/** Suma días (negativos para restar) a una fecha "YYYY-MM-DD". */
export function addDays(ymd: string, days: number): string {
  const d = utcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "14:05" en la zona de la config. */
export function timeIn(epochMs: number, tz: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(epochMs);
}
