import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "../../types";
import {
  addDays,
  dateTimeIn,
  dayLong,
  dayShort,
  hourIn,
  localHour,
  monthLabel,
  rate,
  signedMxn,
  weekdayIn,
} from "../format";

// Los rangos cortos sirven para decidir el día del cambio y usan cada lectura
// de OXR (una por hora); los largos comparan meses y usan el promedio diario.
const RANGES = [
  { key: "24h", label: "24 h", hours: 24 },
  { key: "7d", label: "7 días", hours: 24 * 7 },
  { key: "30d", label: "30 días", days: 30 },
  { key: "90d", label: "90 días", days: 90 },
  { key: "365d", label: "1 año", days: 365 },
] as const;
type Range = (typeof RANGES)[number];
type RangeKey = Range["key"];

// `?rango=24h` gana (sirve para un marcador); si no, el último que elegiste en
// este navegador; si no, 7 días.
const RANGE_KEY = "dollar-check:rango";
function initialRange(): RangeKey {
  const known = (value: string | null) => RANGES.find((r) => r.key === value)?.key;
  try {
    return known(new URLSearchParams(location.search).get("rango")) ?? known(localStorage.getItem(RANGE_KEY)) ?? "7d";
  } catch {
    return "7d";
  }
}

/** Un punto de la gráfica: `x` es un día "YYYY-MM-DD" (rangos largos) o un epoch en ms (cortos). */
interface ChartPoint {
  x: string | number;
  value: number;
  min?: number;
  max?: number;
  points?: number;
}

interface Props {
  daily: DashboardData["daily"];
  intraday: DashboardData["intraday"];
  timezone: string;
  breakEven: number | null;
  lastMonth: string | null;
  /** MXN que cambia lo recibido por cada peso de tasa de mercado: neto × (1 − spread). */
  mxnPerRateUnit: number;
}

export function RateChart({ daily, intraday, timezone, breakEven, lastMonth, mxnPerRateUnit }: Props) {
  const [rangeKey, setRangeKey] = useState<RangeKey>(initialRange);
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const hourly = "hours" in range;

  const choose = (key: RangeKey) => {
    setRangeKey(key);
    try {
      localStorage.setItem(RANGE_KEY, key);
    } catch {}
  };

  const points: ChartPoint[] = useMemo(() => {
    if ("hours" in range) {
      if (intraday.length === 0) return [];
      const from = intraday[intraday.length - 1].timestamp - range.hours * 3600;
      return intraday.filter((r) => r.timestamp >= from).map((r) => ({ x: r.timestamp * 1000, value: r.rate }));
    }
    if (daily.length === 0) return [];
    const from = addDays(daily[daily.length - 1].date, -(range.days - 1));
    return daily
      .filter((d) => d.date >= from)
      .map((d) => ({ x: d.date, value: d.avg, min: d.min, max: d.max, points: d.points }));
  }, [range, daily, intraday]);

  const scale = useMemo(
    () => yScale([...points.map((p) => p.value), ...(breakEven != null ? [breakEven] : [])]),
    [points, breakEven]
  );
  const ticks = useMemo(
    () => (hourly && points.length > 1 ? hourTicks(points, range.hours === 24 ? 4 : 24, timezone) : undefined),
    [hourly, points, range, timezone]
  );
  const last = points[points.length - 1];

  // La etiqueta del empate va a la izquierda, del lado de la línea donde hay
  // menos serie en ese tramo (en el teléfono ocupa ~el primer cuarto del plot).
  const head = points.slice(0, Math.max(1, Math.ceil(points.length * 0.25)));
  const labelBelow = breakEven != null && head.filter((p) => p.value > breakEven).length > head.length / 2;

  const when = (x: string | number) => (typeof x === "number" ? dateTimeIn(x, timezone) : dayLong(x));

  return (
    <>
      <div className="ranges" role="group" aria-label="Rango de la gráfica">
        {RANGES.map((r) => (
          <button key={r.key} type="button" aria-pressed={rangeKey === r.key} onClick={() => choose(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <section className="card" aria-labelledby="chart-title">
        <h2 id="chart-title">Tasa de mercado</h2>
        <p className="muted small">
          {hourly ? "Una lectura de OXR por hora, en hora de México" : "Promedio diario USD/MXN, en días de México"}
        </p>

        {points.length < 2 ? (
          <p className="muted">
            {hourly
              ? "Todavía no hay suficientes lecturas en este rango."
              : "Todavía no hay suficientes días para graficar."}
          </p>
        ) : (
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                {hourly ? (
                  <XAxis
                    dataKey="x"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    ticks={ticks}
                    tickFormatter={(t: number) => (range.hours === 24 ? hourIn(t, timezone) : weekdayIn(t, timezone))}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--axis)" }}
                    tickMargin={6}
                    minTickGap={16}
                  />
                ) : (
                  <XAxis
                    dataKey="x"
                    tickFormatter={dayShort}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--axis)" }}
                    tickMargin={6}
                    minTickGap={32}
                  />
                )}
                <YAxis
                  domain={scale.domain}
                  ticks={scale.ticks}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip
                  cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
                  isAnimationActive={false}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <ChartTooltip
                        point={payload[0].payload as ChartPoint}
                        when={when}
                        breakEven={breakEven}
                        lastMonth={lastMonth}
                        mxnPerRateUnit={mxnPerRateUnit}
                      />
                    ) : null
                  }
                />
                {breakEven != null && (
                  <ReferenceLine y={breakEven} stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="4 4" />
                )}
                {breakEven != null && (
                  // Solo la etiqueta, en una capa arriba de la serie (400) y debajo del cursor (1100)
                  <ReferenceLine
                    y={breakEven}
                    stroke="none"
                    zIndex={1000}
                    label={<LineLabel text={`empate ${rate(breakEven, 2)}`} below={labelBelow} />}
                  />
                )}
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <ReferenceDot
                  x={last.x}
                  y={last.value}
                  r={4}
                  fill="var(--series-1)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  label={<EndLabel text={rate(last.value)} />}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {breakEven != null && lastMonth && (
          <p className="chart-key small">
            <svg width="24" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="24" y2="4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>
            <span>
              Empate con {monthLabel(lastMonth)} ({rate(breakEven)}): arriba de la línea recibes más MXN que ese
              mes; abajo, menos.
            </span>
          </p>
        )}

        <details className="table-view">
          <summary>Ver como tabla</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{hourly ? "Lectura" : "Día"}</th>
                  <th scope="col" className="num">{hourly ? "Tasa" : "Promedio"}</th>
                  {!hourly && (
                    <>
                      <th scope="col" className="num">Mín</th>
                      <th scope="col" className="num">Máx</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.x}>
                    <th scope="row">{when(p.x)}</th>
                    <td className="num">{rate(p.value)}</td>
                    {!hourly && (
                      <>
                        <td className="num">{rate(p.min!)}</td>
                        <td className="num">{rate(p.max!)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </>
  );
}

function ChartTooltip({
  point,
  when,
  breakEven,
  lastMonth,
  mxnPerRateUnit,
}: {
  point: ChartPoint;
  when: (x: string | number) => string;
  breakEven: number | null;
  lastMonth: string | null;
  mxnPerRateUnit: number;
}) {
  return (
    <div className="tooltip">
      <p className="tooltip-date">{when(point.x)}</p>
      <p>
        <span className="key-line" aria-hidden="true" /> <strong>{rate(point.value)}</strong>{" "}
        {point.points != null && <span className="muted">promedio</span>}
      </p>
      {point.points != null && point.points > 1 && (
        <p className="muted">
          rango {rate(point.min!)} – {rate(point.max!)}
        </p>
      )}
      {breakEven != null && lastMonth && (
        <p className="muted">
          a esa tasa: {signedMxn((point.value - breakEven) * mxnPerRateUnit)} vs {monthLabel(lastMonth)}
        </p>
      )}
    </div>
  );
}

type LabelViewBox = { x: number; y: number; width: number; height: number };

/**
 * Etiqueta directa de la línea de empate, a la izquierda, sobre un fondo del
 * color de la superficie para que la serie no la tape. Recharts le pasa viewBox.
 */
function LineLabel({ viewBox, text, below }: { viewBox?: LabelViewBox; text: string; below: boolean }) {
  if (!viewBox) return null;
  const width = text.length * 6.6 + 8; // ~12 px de system-ui
  const top = below ? viewBox.y + 3 : viewBox.y - 19;
  return (
    <g>
      <rect x={viewBox.x + 2} y={top} width={width} height={16} rx={3} className="chart-tag" />
      <text x={viewBox.x + 6} y={top + 12} className="chart-label secondary">
        {text}
      </text>
    </g>
  );
}

/** El valor al final de la línea, alineado a la derecha para no salirse del plot. */
function EndLabel({ viewBox, text }: { viewBox?: LabelViewBox; text: string }) {
  if (!viewBox) return null;
  return (
    <text x={viewBox.x + viewBox.width} y={viewBox.y - 6} textAnchor="end" className="chart-label">
      {text}
    </text>
  );
}

/** Ticks en horas locales redondas: cada 4 h (24 h) o cada medianoche (7 días). */
function hourTicks(points: ChartPoint[], everyHours: number, tz: string): number[] {
  const HOUR = 3_600_000;
  const from = points[0].x as number;
  const to = points[points.length - 1].x as number;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / HOUR) * HOUR; t <= to; t += HOUR) {
    if (localHour(t, tz) % everyHours === 0) ticks.push(t);
  }
  return ticks;
}

/** Dominio y ticks redondos (paso 0.01, 0.02, 0.05…) que incluyen la línea de empate. */
function yScale(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 0.04);
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2].find((s) => span / s <= 5) ?? 5;
  const start = Math.floor((lo - span * 0.08) / step) * step;
  const end = Math.ceil((hi + span * 0.08) / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}
