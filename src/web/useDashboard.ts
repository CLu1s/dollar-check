// Trae GET /api/dashboard al abrir, cada 15 minutos y al volver a la pestaña.
// Un refresco que falla no borra lo que ya se ve: lo marca como viejo.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "../types";

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData; loadedAt: Date; stale: boolean }
  | { status: "starting" } // 503: el bot está arrancando
  | { status: "session" } // llegó HTML (el login de CIAB): la sesión venció
  | { status: "error"; message: string };

type FetchResult =
  | { kind: "ok"; data: DashboardData }
  | { kind: "starting" }
  | { kind: "session" }
  | { kind: "error"; message: string };

const REFRESH_MS = 15 * 60_000;
const RETRY_STARTING_MS = 30_000;
const REFRESH_ON_FOCUS_AFTER_MS = 5 * 60_000;

async function fetchDashboard(): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch("/api/dashboard", { headers: { accept: "application/json" }, cache: "no-store" });
  } catch {
    return { kind: "error", message: "sin conexión con la app" };
  }

  if (res.status === 503) return { kind: "starting" };
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  if (res.status === 401 || res.status === 403 || !isJson) return { kind: "session" };
  if (!res.ok) return { kind: "error", message: `la app respondió ${res.status}` };

  try {
    return { kind: "ok", data: (await res.json()) as DashboardData };
  } catch {
    return { kind: "error", message: "respuesta ilegible" };
  }
}

export function useDashboard(): { state: LoadState; reload: () => void } {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastAttempt = useRef(0);
  // Sube en cada montaje y desmontaje: una respuesta que llega después de
  // desmontar (StrictMode monta dos veces en dev) no programa otro timer.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = generation.current;
    clearTimeout(timer.current);
    lastAttempt.current = Date.now();
    const result = await fetchDashboard();
    if (gen !== generation.current) return;

    setState((prev) => {
      if (result.kind === "ok") return { status: "ready", data: result.data, loadedAt: new Date(), stale: false };
      // Con datos en pantalla, un error pasajero o un reinicio del bot no los borra.
      if (prev.status === "ready" && (result.kind === "error" || result.kind === "starting")) {
        return { ...prev, stale: true };
      }
      if (result.kind === "error") return { status: "error", message: result.message };
      return { status: result.kind };
    });

    timer.current = setTimeout(load, result.kind === "starting" ? RETRY_STARTING_MS : REFRESH_MS);
  }, []);

  useEffect(() => {
    generation.current++;
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt.current > REFRESH_ON_FOCUS_AFTER_MS) {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      generation.current++;
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { state, reload: load };
}
