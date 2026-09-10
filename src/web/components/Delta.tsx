import { mxn } from "../format";

/**
 * Diferencia en MXN con flecha y texto, no solo color: "▲ $1,234 más que en
 * ago 2026". `compact` deja solo flecha y monto, para columnas angostas.
 */
export function Delta({ value, suffix, compact }: { value: number; suffix?: string; compact?: boolean }) {
  const up = value >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {mxn(Math.abs(value))}
      {compact ? <span className="visually-hidden"> {up ? "más" : "menos"}</span> : ` ${up ? "más" : "menos"}`}
      {suffix && ` ${suffix}`}
    </span>
  );
}
