import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import type { PlantioComDetalhes } from "@/lib/database.types";
import type { PlantioResumo } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [talhoesRes, plantiosRes] = await Promise.all([
    supabase
      .from("talhoes")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
    supabase
      .from("plantios")
      .select(
        `id, ano, data_plantio, data_colheita,
         area_ha, volume_colhido, produtividade_sc_ha, agronomo,
         latitude, longitude,
         talhoes(nome), culturas(nome), safras(nome), unidades(sigla)`
      )
      .order("ano", { ascending: true }),
  ]);

  const plantios: PlantioResumo[] = (
    (plantiosRes.data as PlantioComDetalhes[] | null) ?? []
  ).map((p) => ({
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <DashboardClient
        plantios={plantios}
        talhoesAtivos={talhoesRes.count ?? 0}
      />
    </div>
  );
}
