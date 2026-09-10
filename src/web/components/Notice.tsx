import type { ReactNode } from "react";

/** Aviso con ícono + título: el color de estado nunca va solo. */
export function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: "warning" | "critical" | "neutral";
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className={`card notice tone-${tone}`} role={tone === "neutral" ? undefined : "status"}>
      <p className="notice-title">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      {children && <div className="notice-body">{children}</div>}
    </section>
  );
}
