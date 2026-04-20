import { createClient } from "@/lib/supabase/server";
import { PlantiosClient } from "@/components/plantios-client";
import type { PlantioRow } from "@/components/plantios-client";

export default async function PlantiosPage() {
  const supabase = await createClient();

  const { data: plantios } = await supabase
    .from("plantios")
    .select(
      `id, ano, data_plantio, data_colheita,
       area_ha, volume_colhido, produtividade_sc_ha,
       talhoes(nome), culturas(nome), safras(nome), unidades(sigla)`
    )
    .order("ano", { ascending: false })
    .order("data_plantio", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: PlantioRow[] = (plantios ?? []).map((p: any) => ({
    id: p.id,
    ano: p.ano,
    data_plantio: p.data_plantio ?? null,
    data_colheita: p.data_colheita ?? null,
    area_ha: Number(p.area_ha) || 0,
    volume_colhido: p.volume_colhido != null ? Number(p.volume_colhido) : null,
    produtividade_sc_ha:
      p.produtividade_sc_ha != null ? Number(p.produtividade_sc_ha) : null,
    talhao: p.talhoes?.nome ?? "—",
    cultura: p.culturas?.nome ?? "—",
    safra: p.safras?.nome ?? "—",
    unidade: p.unidades?.sigla ?? "sc",
  }));

  const anos = [...new Set(rows.map((p) => p.ano))].sort((a, b) => b - a);
  const safras = [...new Set(rows.map((p) => p.safra))].filter(
    (s) => s !== "—"
  );
  const culturas = [...new Set(rows.map((p) => p.cultura))]
    .filter((c) => c !== "—")
    .sort();
  const talhoes = [...new Set(rows.map((p) => p.talhao))]
    .filter((t) => t !== "—")
    .sort();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Plantios</h1>
      <PlantiosClient
        plantios={rows}
        anos={anos}
        safras={safras}
        culturas={culturas}
        talhoes={talhoes}
      />
    </div>
  );
}
