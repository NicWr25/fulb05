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
 * rechaza y el formulario avisa que el buscador no está disponible.
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
    location?: LatLng | null;
    fetchFields(opts: { fields: string[] }): Promise<unknown>;
  };
};

type LatLng = { lat(): number; lng(): number };
export type LatLngLiteral = { lat: number; lng: number };

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

type MapsLibrary = {
  Map: new (
    el: HTMLElement,
    opts: {
      center: LatLngLiteral;
      zoom: number;
      mapId: string;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
      gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
      clickableIcons?: boolean;
    },
  ) => unknown;
};

type MarkerLibrary = {
  AdvancedMarkerElement: new (opts: { map: unknown; position: LatLngLiteral; title?: string }) => unknown;
};

type Libraries = { places: PlacesLibrary; maps: MapsLibrary; marker: MarkerLibrary };

type GoogleMaps = {
  maps: { importLibrary<K extends keyof Libraries>(name: K): Promise<Libraries[K]> };
};

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

/**
 * Los marcadores modernos (AdvancedMarkerElement) exigen un "Map ID" creado
 * en Google Cloud (el marcador clásico, que no lo pide, está deprecado).
 * No es un secreto ni una credencial: identifica una configuración de mapa
 * (ej. un estilo), así que va como constante y no como variable de entorno.
 * Es el ID "fulb05-organizador" (JavaScript, vectorial) del proyecto de
 * Google Cloud.
 */
const MAP_ID = "ee5d40e05aea28f56e19d9b9";

let loading: Promise<void> | null = null;
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
  return loadApi().then(() => window.google!.maps.importLibrary("places"));
}

/** Mapa de solo lectura con un marcador en `position` (ver PlaceMap). */
export async function showMap(el: HTMLElement, position: LatLngLiteral, title: string): Promise<void> {
  await loadApi();
  const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
    window.google!.maps.importLibrary("maps"),
    window.google!.maps.importLibrary("marker"),
  ]);
  const map = new Map(el, {
    center: position,
    zoom: 16,
    mapId: MAP_ID,
    disableDefaultUI: true,
    zoomControl: true,
    // En el celular, un dedo scrollea la página y dos mueven el mapa: así el
    // mapa no "atrapa" el scroll del formulario.
    gestureHandling: "cooperative",
    clickableIcons: false,
  });
  new AdvancedMarkerElement({ map, position, title });
}

function loadApi(): Promise<void> {
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
  });

  return loading;
}
