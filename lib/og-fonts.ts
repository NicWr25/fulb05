/**
 * Fuentes para las imágenes Open Graph (next/og).
 *
 * ImageResponse no puede usar las fuentes de next/font: necesita los bytes
 * del archivo (TTF/OTF). Se piden a Google Fonts SOLO con los caracteres que
 * lleva la imagen (parámetro `text=`), así cada archivo pesa unos pocos KB.
 * Si Google no responde, se devuelve null y la imagen se genera igual con la
 * fuente por defecto: una vista previa sin la tipografía es mejor que ninguna.
 */
export async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
    // force-cache: Next guarda la respuesta en su Data Cache y la reusa entre
    // pedidos (las fuentes no cambian). Sin esto, cada imagen iría a Google.
    const css = await (await fetch(url, { cache: "force-cache" })).text();
    // Sin user-agent de navegador moderno, Google responde con TTF (lo que necesita Satori).
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { cache: "force-cache" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

type FontSpec = { name: string; weight: 400 | 600 | 800; data: ArrayBuffer };

/** Carga en paralelo las fuentes del diseño para un texto dado; omite las que fallen. */
export async function ogFonts(text: string): Promise<FontSpec[]> {
  const wanted = [
    { name: "Bricolage Grotesque", weight: 800 as const },
    { name: "IBM Plex Sans", weight: 400 as const },
    { name: "IBM Plex Sans", weight: 600 as const },
  ];
  const loaded = await Promise.all(wanted.map((f) => googleFont(f.name, f.weight, text)));
  return wanted.flatMap((f, i) => (loaded[i] ? [{ ...f, data: loaded[i] }] : []));
}
