export type Team = "A" | "B";
export type Format = 5 | 7;

export const TEAMS: readonly Team[] = ["A", "B"];

export const TEAM_LABEL: Record<Team, string> = { A: "Blanco", B: "Negro" };
export const TEAM_IN: Record<Team, string> = { A: "el equipo blanco", B: "el equipo negro" };

/** Clases de Tailwind del color de cada equipo (fondo + texto legible encima). */
export const TEAM_TOKEN_CLASS: Record<Team, string> = {
  A: "bg-team-a text-ink",
  B: "bg-team-b text-white",
};

export const TEAM_SWATCH_CLASS: Record<Team, string> = {
  A: "bg-team-a",
  B: "bg-team-b",
};
