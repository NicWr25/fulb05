"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { IconButton } from "@/components/ui/IconButton";
import { LinkBox } from "@/components/ui/LinkBox";
import { MapsLink } from "@/components/ui/MapsLink";
import { PlayerChip } from "@/components/ui/PlayerChip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatBox } from "@/components/ui/StatBox";
import { SuccessMark } from "@/components/ui/SuccessMark";
import { TeamSwatch } from "@/components/ui/TeamSwatch";
import { TeamToggle } from "@/components/ui/TeamToggle";
import { TextField } from "@/components/ui/TextField";
import { LinkIcon, PinIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Pitch, PitchSpot } from "@/components/pitch/Pitch";
import { PlayerToken } from "@/components/pitch/PlayerToken";
import { ShirtRow } from "@/components/pitch/ShirtRow";
import { defaultLayout, initials } from "@/lib/domain/positions";
import { TEAM_LABEL, TEAMS, type Format, type Team } from "@/lib/domain/teams";

const COLORS = [
  "cream", "surface", "sand", "field", "ink", "ink-2", "ink-3", "ink-4", "line",
  "line-strong", "pitch", "success", "link-green", "danger", "gold", "me-bg",
  "admin-border", "team-a", "team-b",
];

// Datos de muestra (los mismos de los prototipos).
const SAMPLE: Record<Team, (string | null)[]> = {
  A: ["Nico", null, "Santi", null, "Fede", null, null],
  B: ["Mati", "Joaco", null, null, null, null, null],
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-line pb-1 font-display text-20 font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export function UiGallery() {
  const [format, setFormat] = useState<Format>(7);
  const [team, setTeam] = useState<Team>("A");
  const layout = defaultLayout(format);
  const samplePlayers = TEAMS.flatMap((value) =>
    SAMPLE[value].slice(0, format).flatMap((name, slot) =>
      name ? [{ id: value + slot, name, team: value, slot }] : [],
    ),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <Eyebrow>Solo desarrollo</Eyebrow>
        <h1 className="font-display text-30 leading-[1.05] font-extrabold lg:text-40">Componentes base</h1>
        <p className="text-14 text-ink-2">
          Achicá la ventana a menos de 1024px para ver la versión celular (cancha parada).
        </p>
      </header>

      <Section title="Colores">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          {COLORS.map((c) => (
            <div key={c} className="flex flex-col gap-1 text-12">
              <div className="h-10 rounded-field border border-line" style={{ background: `var(--color-${c})` }} />
              {c}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <p className="font-display text-38 leading-[1.02] font-extrabold lg:text-68 lg:leading-none">Armá el partido.</p>
        <p className="font-display text-30 leading-[1.05] font-extrabold">Fútbol del viernes</p>
        <p className="font-display text-20 font-extrabold">Anotate</p>
        <p className="text-16 leading-normal text-ink-2">
          Cada uno se anota en su equipo y acomoda su ficha arrastrándola. (IBM Plex Sans 16)
        </p>
        <p className="text-13 text-ink-2">Texto de ayuda 13px, ink-2.</p>
      </Section>

      <Section title="Botones">
        <div className="flex max-w-sm flex-col gap-3">
          <Button>Anotarme</Button>
          <Button disabled>Anotarme (deshabilitado)</Button>
          <Button variant="soft" size="md" danger>
            Bajarme del partido
          </Button>
          <Button variant="outline" size="md">
            <WhatsAppIcon /> Compartir por WhatsApp
          </Button>
          <Button variant="ghost" size="sm">
            Crear otro partido
          </Button>
          <div className="flex gap-2">
            <IconButton aria-label="Invitar a alguien">
              <LinkIcon size={18} />
            </IconButton>
          </div>
        </div>
      </Section>

      <Section title="Formularios">
        <div className="flex max-w-sm flex-col gap-4">
          <SegmentedControl
            label="Formato"
            value={format}
            onChange={setFormat}
            options={[
              { value: 5, label: "5 vs 5" },
              { value: 7, label: "7 vs 7" },
            ]}
          />
          <TextField label="Tu nombre" placeholder="ej. Nico" />
          <TextField label="Nombre del partido" labelNote="(opcional)" placeholder="ej. Fútbol del viernes" />
          <TextField label="Cancha" placeholder="Nombre de la cancha" error="Contanos dónde se juega." />
          <TextField
            label="Ubicación en Google Maps"
            labelNote="(opcional)"
            type="url"
            placeholder="Pegá el enlace de la cancha"
            icon={<PinIcon />}
            hint="En Google Maps buscá la cancha, tocá Compartir y copiá el enlace."
          />
          <TeamToggle value={team} onChange={setTeam} />
        </div>
      </Section>

      <Section title="Cajas y cards">
        <div className="flex max-w-sm flex-col gap-4">
          <StatBox value={9} title="Faltan 9 jugadores" subtitle="7 vs 7 · 14 jugadores en cancha" />
          <Card>
            <div className="flex items-center gap-2.5">
              <SuccessMark />
              <CardTitle>¡Listo, Nico!</CardTitle>
            </div>
            <p className="text-15 leading-normal">Jugás en el equipo blanco.</p>
          </Card>
          <Card panel>
            <div className="flex items-center gap-3">
              <SuccessMark size={36} />
              <h2 className="font-display text-24 font-extrabold lg:text-26">¡Partido creado!</h2>
            </div>
            <LinkBox title="Enlace para invitar" url="https://fulb05.vercel.app/p/x7k2m9ab" note="Pasalo por el grupo para que se anoten." />
          </Card>
          <MapsLink href="https://maps.app.goo.gl/ejemplo">Cancha Parque · Cómo llegar</MapsLink>
        </div>
      </Section>

      <Section title="Chips de jugadores">
        <div className="flex flex-wrap gap-1.5">
          <PlayerChip name="Nico" />
          <PlayerChip name="Santi" me />
          <PlayerChip name="Joaco" onRemove={() => alert("sacar a Joaco")} />
          <span className="text-14 text-ink-4">Nadie todavía</span>
        </div>
        <div className="flex items-center gap-2 text-15 font-semibold">
          <TeamSwatch team="A" /> {TEAM_LABEL.A}
          <TeamSwatch team="B" /> {TEAM_LABEL.B}
        </div>
      </Section>

      <Section title="Cancha">
        <p className="text-13 text-ink-2">
          Las remeras muestran lugares libres y ocupados. Dentro de la cancha solo están las fichas anotadas;
          Santi es &ldquo;vos&rdquo; (borde dorado).
        </p>
        <div className="flex w-full max-w-[358px] flex-col gap-3 lg:max-w-[840px]">
          <ShirtRow match={{ format, players: samplePlayers }} team="B" />
          <Pitch>
            {samplePlayers.map((player) => {
              const mine = player.name === "Santi";
              return <PitchSpot key={player.id} point={layout[player.team][player.slot]} z={mine ? 10 : 1}>
                <PlayerToken team={player.team} playerName={player.name}
                  text={initials(player.name)} mine={mine} static
                  aria-label={mine ? "Vos" : player.name} />
              </PitchSpot>;
            })}
          </Pitch>
          <ShirtRow match={{ format, players: samplePlayers }} team="A" />
        </div>
      </Section>
    </main>
  );
}
