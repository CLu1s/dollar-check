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
import type { DailyPoint } from "../../types";
import { addDays, dayLong, dayShort, monthLabel, rate, signedMxn } from "../format";

const RANGES = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 365, label: "1 año" },
] as const;
type RangeDays = (typeof RANGES)[number]["days"];

// Recordar el rango es una comodidad de este navegador; si localStorage falla, 90 días.
const RANGE_KEY = "dollar-check:range";
function savedRange(): RangeDays {
  try {
    const saved = Number(localStorage.getItem(RANGE_KEY));
    return RANGES.find((r) => r.days === saved)?.days ?? 90;
  } catch {
    return 90;
  }
}

interface Props {
  daily: DailyPoint[];
  breakEven: number | null;
  lastMonth: string | null;
  /** MXN que cambia lo recibido por cada peso de tasa de mercado: neto × (1 − spread). */
  mxnPerRateUnit: number;
}

export function RateChart({ daily, breakEven, lastMonth, mxnPerRateUnit }: Props) {
  const [range, setRange] = useState<RangeDays>(savedRange);
  const choose = (days: RangeDays) => {
    setRange(days);
    try {
      localStorage.setItem(RANGE_KEY, String(days));
    } catch {}
  };

  const points = useMemo(() => {
    if (daily.length === 0) return [];
    const from = addDays(daily[daily.length - 1].date, -(range - 1));
    return daily.filter((d) => d.date >= from);
  }, [daily, range]);

  const scale = useMemo(
    () => yScale([...points.map((p) => p.avg), ...(breakEven != null ? [breakEven] : [])]),
    [points, breakEven]
  );
  const last = points[points.length - 1];
  // La etiqueta del empate va a la izquierda, del lado de la línea donde hay
  // menos serie en ese tramo (en el teléfono ocupa ~el primer cuarto del plot).
  const head = points.slice(0, Math.max(1, Math.ceil(points.length * 0.25)));
  const labelBelow = breakEven != null && head.filter((p) => p.avg > breakEven).length > head.length / 2;

  return (
    <>
      <div className="ranges" role="group" aria-label="Rango de la gráfica">
        {RANGES.map((r) => (
          <button key={r.days} type="button" aria-pressed={range === r.days} onClick={() => choose(r.days)}>
            {r.label}
          </button>
        ))}
      </div>

      <section className="card" aria-labelledby="chart-title">
        <h2 id="chart-title">Tasa de mercado</h2>
        <p className="muted small">Promedio diario USD/MXN, en días de México</p>

        {points.length < 2 ? (
          <p className="muted">Todavía no hay suficientes días para graficar.</p>
        ) : (
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={dayShort}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--axis)" }}
                  tickMargin={6}
                  minTickGap={32}
                />
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
                        point={payload[0].payload as DailyPoint}
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
                  dataKey="avg"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <ReferenceDot
                  x={last.date}
                  y={last.avg}
                  r={4}
                  fill="var(--series-1)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  label={<EndLabel text={rate(last.avg)} />}
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
                  <th scope="col">Día</th>
                  <th scope="col" className="num">Promedio</th>
                  <th scope="col" className="num">Mín</th>
                  <th scope="col" className="num">Máx</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.date}>
                    <th scope="row">{dayLong(p.date)}</th>
                    <td className="num">{rate(p.avg)}</td>
                    <td className="num">{rate(p.min)}</td>
                    <td className="num">{rate(p.max)}</td>
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
  breakEven,
  lastMonth,
  mxnPerRateUnit,
}: {
  point: DailyPoint;
  breakEven: number | null;
  lastMonth: string | null;
  mxnPerRateUnit: number;
}) {
  return (
    <div className="tooltip">
      <p className="tooltip-date">{dayLong(point.date)}</p>
      <p>
        <span className="key-line" aria-hidden="true" /> <strong>{rate(point.avg)}</strong>{" "}
        <span className="muted">promedio</span>
      </p>
      {point.points > 1 && (
        <p className="muted">
          rango {rate(point.min)} – {rate(point.max)}
        </p>
      )}
      {breakEven != null && lastMonth && (
        <p className="muted">
          a esa tasa: {signedMxn((point.avg - breakEven) * mxnPerRateUnit)} vs {monthLabel(lastMonth)}
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
