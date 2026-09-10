import type { DashboardData } from "../../types";
import { mxn, rate, signedPct, timeIn } from "../format";

export function KpiRow({ data }: { data: DashboardData }) {
  const { latest, today, trend, settings } = data;
  if (!latest || !today) return null;

  return (
    <section className="kpis" aria-label="Indicadores de hoy">
      <Kpi
        label="Tasa de mercado"
        value={rate(latest.rate)}
        note={`OXR · ${timeIn(latest.timestamp * 1000, settings.timezone)}`}
      />
      <Kpi label="Tasa Deel estimada" value={rate(today.deel_rate)} note={`con spread de ${settings.spread_percent}%`} />
      <Kpi
        label="Costo de Deel"
        value={mxn(today.deel_cost.total_mxn)}
        unit="MXN"
        note={`tarifa ${mxn(today.deel_cost.fee_mxn)} + spread ${mxn(today.deel_cost.spread_mxn)}`}
      />
      <Kpi
        label="Tendencia"
        value={trendValue(trend)}
        note={trend ? `momentum 5 días ${signedPct(trend.momentum)}` : "sin tasas de los últimos 30 días"}
      />
    </section>
  );
}

function Kpi({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
  return (
    <div className="card kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">
        {value}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </p>
      <p className="kpi-note">{note}</p>
    </div>
  );
}

function trendValue(trend: DashboardData["trend"]): string {
  if (!trend) return "—";
  if (trend.direction === "sideways") return "→ Estable";
  const days = `${trend.consecutive_days} ${trend.consecutive_days === 1 ? "día" : "días"}`;
  return trend.direction === "up" ? `↑ ${days} al alza` : `↓ ${days} a la baja`;
}
