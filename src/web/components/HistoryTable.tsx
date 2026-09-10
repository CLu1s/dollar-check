import type { DashboardData } from "../../types";
import { monthLabel, mxn, rate } from "../format";
import { Delta } from "./Delta";

export function HistoryTable({
  history,
  totals,
  spreadPercent,
}: {
  history: DashboardData["history"];
  totals: DashboardData["totals"];
  spreadPercent: number;
}) {
  return (
    <section className="card" aria-labelledby="history-title">
      <h2 id="history-title">Tus cambios</h2>

      {totals && (
        <p className="muted small">
          {totals.count} {totals.count === 1 ? "cambio" : "cambios"} · {mxn(totals.total_mxn)} MXN recibidos · tasa
          promedio {rate(totals.avg_effective_rate)}
          {totals.count > 1 && ` · mejor mes: ${monthLabel(totals.best_month)}`}
        </p>
      )}

      {history.length === 0 ? (
        <p className="muted">
          Aún no hay cambios registrados. Cuando cambies tu sueldo, regístralo con <code>/changed</code> en Telegram.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col" className="num">Tasa obtenida</th>
                  <th scope="col" className="num">Recibiste</th>
                  <th scope="col" className="num">vs. día promedio</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.month}>
                    <th scope="row">{monthLabel(h.month)}</th>
                    <td className="num">{rate(h.effective_rate)}</td>
                    <td className="num">{mxn(h.amount_mxn)}</td>
                    <td className="num">
                      {h.vs_avg_mxn == null ? <span className="muted">—</span> : <Delta value={h.vs_avg_mxn} compact />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small footnote">
            <strong>vs. día promedio:</strong> cuánto ganaste o perdiste por el día en que cambiaste, contra haberlo
            hecho en un día promedio de ese mes (con spread de {spreadPercent}%). “—”: ese mes tiene menos de 10 días
            con tasas.
          </p>
        </>
      )}
    </section>
  );
}
