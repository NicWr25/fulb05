import { CreateMatchForm } from "@/components/create/CreateMatchForm";
import { Eyebrow } from "@/components/ui/Eyebrow";

const STEPS = [
  "Creá el partido: día, hora y cancha.",
  "Mandá el enlace al grupo.",
  "Cada uno elige un lugar en la cancha.",
];

// Diseño: design/crear-partido-{celular,escritorio}.dc.html
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-4 pt-6 pb-8 lg:max-w-[1280px] lg:flex-row lg:items-center lg:gap-20 lg:px-20 lg:py-14">
      <div className="flex flex-col gap-3 lg:grow lg:gap-7">
        <Eyebrow className="lg:text-13">Armado de equipos</Eyebrow>
        <h1 className="font-display text-38 leading-[1.02] font-extrabold lg:text-68 lg:leading-none lg:tracking-[-0.01em]">
          Armá el partido.
          <br />
          Pasá el enlace.
        </h1>
        <p className="text-16 leading-normal text-ink-2 lg:max-w-[520px] lg:text-19">
          Cada uno se anota solo, en su equipo y en un lugar libre.
        </p>
        {/* Los 3 pasos solo aparecen en escritorio, como en el diseño. */}
        <ol className="mt-2 hidden flex-col gap-4 lg:flex">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3.5 text-16">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success font-semibold text-white"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <section className="lg:w-[480px] lg:shrink-0" aria-label="Crear partido">
        <CreateMatchForm />
      </section>
    </main>
  );
}
