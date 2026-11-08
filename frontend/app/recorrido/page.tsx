import Link from "next/link";
import { RecorridoSSR } from "@/features/route-planning/components/server-route/RecorridoSSR";
import { calcularRecorridoSSR } from "@/features/route-planning/server/serverRoute";

// Cada selección debe resolverse por solicitud, no durante `next build`.
export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;

export default async function PaginaRecorrido({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item);
    }
  }
  const resultado = await calcularRecorridoSSR(params);
  if (resultado.ok === false) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">No se pudo calcular el recorrido</h1>
        <p role="alert" className="mt-3">{resultado.error}</p>
        <Link href="/" className="mt-4 inline-block underline">Volver al mapa</Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="mb-5 inline-block underline">Volver al mapa y elegir otra área</Link>
      <RecorridoSSR
        scenario={resultado.scenario}
        priorities={resultado.priorities}
        steps={resultado.steps}
        cost={resultado.cost}
        startNodeId={resultado.startNodeId}
      />
    </main>
  );
}
