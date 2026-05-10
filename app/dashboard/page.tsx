import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import type { PlantioComDetalhes } from "@/lib/database.types";
import type { PlantioResumo } from "@/components/dashboard-client";
import type { TalhaoMapData } from "@/components/talhoes-map";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [talhoesRes, plantiosRes, talhoesGeoRes] = await Promise.all([
    supabase
      .from("talhoes")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
    supabase
      .from("plantios")
      .select(
        `id, ano, data_plantio, data_colheita,
         area_ha, volume_colhido, produtividade_sc_ha, agronomo,
         latitude, longitude, talhao_id,
         talhoes(nome), culturas(nome), safras(nome), unidades(sigla)`
      )
      .order("ano", { ascending: true }),
    supabase
      .from("talhoes")
      .select("id, nome, geojson")
      .eq("ativo", true),
  ]);

  const { data: plantiosData, error: plantiosError } = plantiosRes;
  const { error: talhoesError } = talhoesRes;
  const { data: talhoesGeoData } = talhoesGeoRes;

  const allPlantios = (plantiosData as PlantioComDetalhes[] | null) ?? [];

  const recentPlantioByTalhao = new Map<string, PlantioComDetalhes>();
  for (const p of [...allPlantios].sort((a, b) => b.ano - a.ano)) {
    if (p.talhao_id != null && !recentPlantioByTalhao.has(p.talhao_id)) {
      recentPlantioByTalhao.set(p.talhao_id, p);
    }
  }

  const talhoesMapData: TalhaoMapData[] = (talhoesGeoData ?? [])
    .filter((t): t is typeof t & { geojson: object } => t.geojson != null)
    .map((t) => {
      const plantio = recentPlantioByTalhao.get(t.id) ?? null;
      return {
        id: t.id,
        nome: t.nome,
        geojson: t.geojson,
        cultura: plantio?.culturas?.nome ?? null,
        safra: plantio?.safras?.nome ?? null,
        ano: plantio?.ano ?? null,
        area_ha: plantio?.area_ha != null ? Number(plantio.area_ha) : null,
        produtividade_sc_ha:
          plantio?.produtividade_sc_ha != null
            ? Number(plantio.produtividade_sc_ha)
            : null,
      };
    });

  const plantios: PlantioResumo[] = allPlantios.map((p) => ({
    ano: p.ano,
    area_ha: Number(p.area_ha) || 0,
    volume_colhido: p.volume_colhido != null ? Number(p.volume_colhido) : null,
    produtividade_sc_ha:
      p.produtividade_sc_ha != null ? Number(p.produtividade_sc_ha) : null,
    data_colheita: p.data_colheita ?? null,
    talhao: p.talhoes?.nome ?? "—",
    cultura: p.culturas?.nome ?? "—",
    safra: p.safras?.nome ?? "—",
  }));

  const dataError = plantiosError ?? talhoesError;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
          Erro ao carregar dados: {dataError.message}
        </div>
      )}
      <DashboardClient
        plantios={plantios}
        talhoesAtivos={talhoesRes.count ?? 0}
        talhoesMapData={talhoesMapData}
      />
    </div>
  );
}
