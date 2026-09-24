import type { Metadata } from "next";
import { ClaimAdmin } from "./ClaimAdmin";

// Nunca indexar ni previsualizar esta ruta.
export const metadata: Metadata = {
  title: "Enlace de organizador",
  robots: { index: false, follow: false },
};

/**
 * /p/[id]/admin#<token>
 * El token viaja en el FRAGMENTO (#): el navegador no lo manda al servidor,
 * así que no queda en los logs de Vercel ni en el header Referer. Por eso
 * esta página no puede validarlo del lado del servidor: lo lee el cliente
 * y se lo pasa a la RPC claim_admin, que es la que valida (en Postgres).
 */
export default async function ClaimAdminPage({ params }: PageProps<"/p/[id]/admin">) {
  const { id } = await params;
  return <ClaimAdmin matchId={id} />;
}
