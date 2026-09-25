/**
 * Carga la API de Google Maps (librería "places") una sola vez y solo cuando
 * un formulario la necesita: la página del partido nunca la descarga.
 *
 * La key es pública por diseño (va en el bundle, como la anon key de
 * Supabase). La protegen las restricciones configuradas en Google Cloud: solo
 * funciona desde fulb05.vercel.app y localhost, solo para Maps JavaScript API
 * y Places API (New), y con cuotas diarias debajo de la capa gratuita.
 *
 * Sin key (CI, deploys de preview) o si el script no carga, `loadPlaces()`
 * rechaza y el formulario vuelve al campo de pegar el enlace.
 */

// Tipos mínimos de lo que usamos. Se evita sumar @types/google.maps (miles de
// líneas) por cuatro propiedades.
export type PlacePrediction = {
  placeId: string;
  text: { text: string };
  mainText: { text: string } | null;
  toPlace(): {
    id: string;
    formattedAddress?: string | null;
    fetchFields(opts: { fields: string[] }): Promise<unknown>;
  };
};

export type PlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes: string[] | null;
  locationBias: unknown;
};

type PlacesLibrary = {
  PlaceAutocompleteElement: new (opts: {
    includedRegionCodes?: string[];
    locationBias?: { center: { lat: number; lng: number }; radius: number };
  }) => PlaceAutocompleteElement;
};

type GoogleMaps = { maps: { importLibrary(name: "places"): Promise<PlacesLibrary> } };

declare global {
  interface Window {
    google?: GoogleMaps;
    // Google llama a esta función global si la key es rechazada (referrer no
    // permitido, API no habilitada, facturación caída...).
    gm_authFailure?: () => void;
    __fulb05MapsReady?: () => void;
  }
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** false = no hay key en este entorno: ni siquiera se intenta cargar. */
export const mapsEnabled = Boolean(KEY);

let loading: Promise<PlacesLibrary> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

/** Avisa si Google rechaza la key después de cargar (el script carga igual). */
export function onMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) {
    listener();
    return () => {};
  }
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function loadPlaces(): Promise<PlacesLibrary> {
  if (!KEY) return Promise.reject(new Error("maps_disabled"));
  if (authFailed) return Promise.reject(new Error("maps_auth_failed"));

  loading ??= new Promise<void>((resolve, reject) => {
    window.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((listener) => listener());
    };
    window.__fulb05MapsReady = () => {
      delete window.__fulb05MapsReady;
      resolve();
    };
    const params = new URLSearchParams({
      key: KEY,
      v: "weekly",
      loading: "async",
      libraries: "places",
      // Sugerencias en español y priorizando resultados de Uruguay.
      language: "es",
      region: "UY",
      callback: "__fulb05MapsReady",
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      script.remove();
      loading = null; // permite reintentar (ej. se cortó la conexión)
      reject(new Error("maps_load_failed"));
    };
    document.head.append(script);
  }).then(() => window.google!.maps.importLibrary("places"));

  return loading;
}
