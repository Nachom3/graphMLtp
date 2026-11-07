import { LeyendaPrioridades } from "@/features/route-planning";
import { EstadoVista } from "@/components/operation-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Planificación de recorridos</h1>
        <p className="mt-2 text-zinc-600">Interfaz en desarrollo.</p>
      </header>
      <EstadoVista estado={{ estado: "ociosa" }} />
      <LeyendaPrioridades />
    </main>
  );
}
