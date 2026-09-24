import Link from "next/link";

/** Estado no cubierto por el diseño: partido inexistente o ya borrado. */
export function NotFoundCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-col gap-4 px-4 pt-10 pb-8">
      <h1 className="font-display text-30 leading-[1.05] font-extrabold">{title}</h1>
      <p className="text-16 leading-normal text-ink-2">{body}</p>
      <Link
        href="/"
        className="mt-2 flex h-13 items-center justify-center rounded-btn bg-ink text-16 font-semibold text-white no-underline hover:text-white"
      >
        Armar un partido
      </Link>
    </main>
  );
}
