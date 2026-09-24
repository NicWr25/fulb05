import { notFound } from "next/navigation";
import { UiGallery } from "./UiGallery";

// Catálogo de componentes para comparar contra design/. Solo en desarrollo:
// en producción esta ruta responde 404.
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
