"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { SuccessMark } from "@/components/ui/SuccessMark";
import { cx } from "@/lib/cx";

/** "¡Listo, Nico!": estás anotado; podés cambiarte de lugar o bajarte. */
export function MyEntryCard({
  name,
  line,
  moveHint,
  error,
  canMove,
  busy,
  onMove,
  onLeave,
}: {
  name: string;
  line: string;
  moveHint: string;
  error?: string | null;
  canMove: boolean;
  busy?: boolean;
  onMove: () => void;
  onLeave: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <SuccessMark />
        <CardTitle>¡Listo, {name}!</CardTitle>
      </div>
      <p className="text-15 leading-normal">{line}</p>
      <p
        aria-live="polite"
        className={cx("text-13 leading-[1.45] lg:min-h-[38px]", error ? "font-semibold text-danger" : "text-ink-2")}
      >
        {error ?? moveHint}
      </p>
      {canMove && (
        <Button onClick={onMove} disabled={busy} className="lg:h-12">
          {busy ? "Cambiando…" : "Cambiarme a este puesto"}
        </Button>
      )}
      <Button variant="soft" size="md" danger onClick={onLeave} disabled={busy} className="lg:h-11">
        Bajarme del partido
      </Button>
    </Card>
  );
}
