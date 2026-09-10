import type { DashboardData } from "../types";
import { useDashboard } from "./useDashboard";
import { timeIn, usd } from "./format";
import { Notice } from "./components/Notice";
import { Hero } from "./components/Hero";
import { KpiRow } from "./components/KpiRow";
import { RateChart } from "./components/RateChart";
import { HistoryTable } from "./components/HistoryTable";

export function App() {
  const { state, reload } = useDashboard();

  return (
    <main className="page">
      <header className="page-header">
        <h1>
          Dollar Check <span className="muted">USD/MXN</span>
        </h1>
        {state.status === "ready" && (
          <p className="muted small">
            {state.stale ? "No se pudo actualizar · " : "Actualizado "}
            {timeIn(state.loadedAt.getTime(), state.data.settings.timezone)}
          </p>
        )}
      </header>

      {state.status === "loading" && <p className="muted">Cargando…</p>}

      {state.status === "starting" && (
        <Notice tone="warning" icon="⏳" title="El bot está arrancando">
          Reintento en 30 segundos. Si tarda más de un par de minutos, revisa los logs de la app en CIAB.
        </Notice>
      )}

      {state.status === "session" && (
        <Notice tone="warning" icon="🔒" title="Tu sesión de CIAB venció">
          <button type="button" className="button" onClick={() => location.reload()}>
            Recargar la página
          </button>
        </Notice>
      )}

      {state.status === "error" && (
        <Notice tone="critical" icon="⚠️" title="No pude cargar los datos">
          <p>{state.message}.</p>
          <button type="button" className="button" onClick={reload}>
            Reintentar
          </button>
        </Notice>
      )}

      {state.status === "ready" && <Dashboard data={state.data} />}
    </main>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const { settings } = data;

  return (
    <>
      {data.latest && !data.health.ok && (
        <Notice tone="warning" icon="⚠️" title="No están llegando tasas nuevas">
          {data.health.message}. Los números de abajo pueden estar viejos: revisa los logs de la app en CIAB.
        </Notice>
      )}

      <Hero data={data} />

      {data.latest && data.today && (
        <>
          <KpiRow data={data} />
          <RateChart
            daily={data.daily}
            breakEven={data.break_even_rate}
            lastMonth={data.last_exchange?.month ?? null}
            mxnPerRateUnit={data.today.net_usd * (1 - settings.spread_percent / 100)}
          />
        </>
      )}

      <HistoryTable history={data.history} totals={data.totals} spreadPercent={settings.spread_percent} />

      <footer className="page-footer muted small">
        Sueldo {usd(settings.salary_usd)} · tarifa Deel {usd(settings.fee_usd)} · spread {settings.spread_percent}% ·
        umbral de alerta {settings.threshold_percent}%. Se cambian con los <code>/set_*</code> del bot.
      </footer>
    </>
  );
}
