"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapsLink } from "@/components/ui/MapsLink";
import { TextField } from "@/components/ui/TextField";
import { PinIcon } from "@/components/ui/icons";
import { loadPlaces, mapsEnabled, onMapsAuthFailure, type PlacePrediction } from "@/lib/maps/loader";
import { mapsUrlFromPlace, venueFromMapsUrl, venueName } from "@/lib/domain/validation";

// Centro de Montevideo: las sugerencias priorizan (no restringen) esta zona.
const MONTEVIDEO = { center: { lat: -34.8941, lng: -56.1650 }, radius: 25_000 };

type Picked = { name: string; address: string };

type Props = {
  /** Enlace actual ("" si todavía no hay). */
  value: string;
  /** Nombre guardado de la cancha (al editar), para mostrarlo. */
  venue?: string | null;
  /**
   * `venue` = nombre de la cancha que corresponde a ese enlace: el del lugar
   * elegido, el que trae un enlace largo pegado, o null.
   */
  onChange: (mapsUrl: string, venue: string | null) => void;
  error?: string;
};

/**
 * "Ubicación en Google Maps": buscador de lugares de Google y, como plan B,
 * el campo para pegar un enlace. El valor final siempre es un enlace que
 * valida el mismo CHECK de Postgres, venga de donde venga.
 */
export function MapsField({ value, venue, onChange, error }: Props) {
  const [mode, setMode] = useState<"search" | "paste">(mapsEnabled ? "search" : "paste");
  const [unavailable, setUnavailable] = useState(!mapsEnabled);
  const [picked, setPicked] = useState<Picked | null>(null);

  const canSearch = !unavailable && mode === "search";

  if (!canSearch) {
    return (
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Ubicación en Google Maps"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="Pegá el enlace de la cancha"
          icon={<PinIcon />}
          value={value}
          onChange={(e) => onChange(e.target.value, venueFromMapsUrl(e.target.value))}
          error={error}
          hint="En Google Maps buscá la cancha, tocá Compartir y copiá el enlace. Así los jugadores ven cómo llegar."
        />
        {!unavailable && (
          <SwitchButton onClick={() => setMode("search")}>Mejor buscarla por nombre</SwitchButton>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value ? (
        <Selected
          picked={picked ?? (venue ? { name: venue, address: "" } : null)}
          href={value}
          onChange={() => {
            setPicked(null);
            onChange("", null);
          }}
        />
      ) : (
        <PlaceSearch
          error={error ? "Buscá la cancha y elegila de la lista." : undefined}
          onUnavailable={() => setUnavailable(true)}
          onSelect={(place) => {
            const name = venueName(place.name) ?? place.address;
            setPicked({ name, address: place.address });
            onChange(mapsUrlFromPlace({ placeId: place.placeId, name }), venueName(place.name));
          }}
        />
      )}
      <SwitchButton onClick={() => setMode("paste")}>¿No la encontrás? Pegá un enlace</SwitchButton>
    </div>
  );
}

function SwitchButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 self-start text-13 font-semibold text-ink-2 underline underline-offset-2"
    >
      {children}
    </button>
  );
}

/** Lugar ya elegido (o el enlace guardado, al editar) con opción de cambiarlo. */
function Selected({ picked, href, onChange }: { picked: Picked | null; href: string; onChange: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-13 font-semibold text-ink-2">Ubicación en Google Maps</span>
      <div className="flex items-center gap-3 rounded-field border border-line-strong bg-field px-3.5 py-2.5">
        <div className="flex min-w-0 grow flex-col">
          {picked ? (
            <>
              <span className="truncate text-16 font-semibold text-ink">{picked.name}</span>
              {picked.address ? (
                <span className="truncate text-13 text-ink-2">{picked.address}</span>
              ) : (
                <MapsLink href={href} className="text-13">
                  Ver en Google Maps
                </MapsLink>
              )}
            </>
          ) : (
            <MapsLink href={href} className="text-15">
              Ver la ubicación guardada
            </MapsLink>
          )}
        </div>
        <button
          type="button"
          onClick={onChange}
          className="min-h-11 shrink-0 px-1 text-14 font-semibold text-ink underline underline-offset-2"
        >
          Cambiar
        </button>
      </div>
    </div>
  );
}

/**
 * Widget oficial de Google (`<gmp-place-autocomplete>`, un web component).
 * Se crea de forma imperativa porque React no maneja bien sus eventos
 * personalizados.
 *
 * Costo: las teclas son gratis si la búsqueda termina en un pedido de
 * detalles ("sesión"). Ese pedido trae SOLO `formattedAddress`, un campo
 * Essentials (10.000 gratis por mes). El nombre sale de la sugerencia misma:
 * pedir `displayName` sería un campo Pro, más del triple de caro.
 */
function PlaceSearch({
  error,
  onSelect,
  onUnavailable,
}: {
  error?: string;
  onSelect: (place: { placeId: string; name: string; address: string }) => void;
  onUnavailable: () => void;
}) {
  const labelId = useId();
  const errorId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Los callbacks cambian en cada render; el widget se crea una sola vez.
  const onSelectRef = useRef(onSelect);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onUnavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    let cancelled = false;
    let widget: HTMLElement | null = null;
    const stopAuth = onMapsAuthFailure(() => onUnavailableRef.current());

    loadPlaces()
      .then(({ PlaceAutocompleteElement }) => {
        if (cancelled || !hostRef.current) return;
        const el = new PlaceAutocompleteElement({ includedRegionCodes: ["uy"], locationBias: MONTEVIDEO });
        el.setAttribute("aria-labelledby", labelId);
        el.setAttribute("placeholder", "Buscá la cancha por nombre");
        el.addEventListener("gmp-select", async (event) => {
          const prediction = (event as Event & { placePrediction: PlacePrediction }).placePrediction;
          const place = prediction.toPlace();
          try {
            await place.fetchFields({ fields: ["formattedAddress"] });
          } catch {
            // Sin dirección igual sirve: el enlace solo necesita el id.
          }
          onSelectRef.current({
            placeId: prediction.placeId,
            name: prediction.mainText?.text ?? prediction.text.text,
            address: place.formattedAddress ?? "",
          });
        });
        hostRef.current.append(el);
        widget = el;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current();
      });

    return () => {
      cancelled = true;
      stopAuth();
      widget?.remove();
    };
  }, [labelId]);

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-13 font-semibold text-ink-2">
        Ubicación en Google Maps
      </span>
      <div
        ref={hostRef}
        aria-describedby={error ? errorId : undefined}
        // Enter en el buscador es para elegir una sugerencia, no para enviar
        // el formulario (el de crear o el de editar) que lo contiene.
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className={`maps-search min-h-[46px] rounded-field ${error ? "maps-search-error" : ""}`}
      >
        {!ready && (
          <div className="flex h-[46px] items-center rounded-field border border-line-strong bg-field px-3.5 text-16 text-ink-4">
            Cargando buscador…
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-13 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
