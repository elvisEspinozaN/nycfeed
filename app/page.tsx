export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          NYC Pulse
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
          Nearby civic feed scaffold
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          Next.js, TypeScript, Tailwind, ESLint, import aliases, and shadcn are
          ready in the root project.
        </p>
      </section>
    </main>
  );
}
