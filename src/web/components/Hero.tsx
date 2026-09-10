import type { AlertRecommendation, DashboardData } from "../../types";
import { monthLabel, mxn, rate, signedPct } from "../format";
import { Delta } from "./Delta";

const TONE: Record<AlertRecommendation, "good" | "neutral" | "warning" | "critical"> = {
  strong_buy: "good",
  buy: "good",
  hold: "neutral",
  watch: "warning",
  change_now: "critical",
};

/** La respuesta de la página: qué hacer hoy y cuántos MXN son. */
export function Hero({ data }: { data: DashboardData }) {
  const { today, trend, vs_last, last_exchange: last, break_even_rate: breakEven, month } = data;

  if (!data.latest || !today) {
    return (
      <section className="card hero tone-neutral">
        <p className="rec">
          <span aria-hidden="true">⚪</span> Sin tasas todavía
        </p>
        <p>
          Manda <code>/seed 30</code> al bot en Telegram para cargar el histórico, o espera el primer polling
          de la hora.
        </p>
      </section>
    );
  }

  return (
    <section className={`card hero tone-${trend ? TONE[trend.recommendation] : "neutral"}`}>
      <p className="rec">
        <span aria-hidden="true">{trend?.emoji ?? "⚪"}</span> {trend?.label ?? "Sin datos suficientes para recomendar"}
      </p>

      <p className="hero-label">Hoy recibirías</p>
      <p className="hero-figure">
        {mxn(today.mxn)} <span className="hero-unit">MXN</span>
      </p>

      {vs_last && last ? (
        <p className="hero-delta">
          <Delta value={vs_last.mxn} suffix={`que en ${monthLabel(last.month)}`} />
          {vs_last.percent != null && <span className="muted"> ({signedPct(vs_last.percent)})</span>}
        </p>
      ) : (
        <p className="muted">
          Sin cambio registrado. Cuando cambies tu sueldo, regístralo con <code>/changed</code> en Telegram y
          aquí verás si hoy te conviene más o menos.
        </p>
      )}

      {breakEven != null && last && (
        <p className="muted small">
          Empatas con {monthLabel(last.month)} cuando el mercado está en {rate(breakEven)}.
        </p>
      )}

      <p className="hero-month">{monthStatus(month)}</p>
    </section>
  );
}

function monthStatus(month: DashboardData["month"]): string {
  if (month.exchanged) return "✅ Ya cambiaste este mes · alertas pausadas";
  const days = month.days_to_payday;
  const payday =
    days === 0 ? "hoy es día de pago" : days === 1 ? "mañana es día de pago" : `faltan ${days} días para el pago`;
  return `⏳ Pendiente este mes · ${payday}${month.last_week ? " · última semana: alertas más sensibles" : ""}`;
}
