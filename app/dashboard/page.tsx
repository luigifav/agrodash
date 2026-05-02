import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import type {
  PlantioComDetalhes,
  PlantioEnriquecido,
  ResumoProducao,
} from "@/lib/database.types";

type PlantioBrutoRow = Pick<
  PlantioComDetalhes,
  | "id"
  | "ano"
  | "data_plantio"
  | "data_colheita"
  | "area_ha"
  | "volume_colhido"
  | "produtividade_sc_ha"
> & {
  talhoes: { id: string; nome: string } | null;
  culturas: { nome: string } | null;
  safras: { nome: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [talhoesRes, resumoRes, plantiosRes] = await Promise.all([
    supabase
      .from("talhoes")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
    supabase.rpc("resumo_producao_por_ano_cultura"),
    supabase
      .from("plantios")
      .select(
        `id, ano, data_plantio, data_colheita, area_ha,
         volume_colhido, produtividade_sc_ha,
         talhoes(id, nome),
         culturas(nome),
         safras(nome)`
      )
      .not("produtividade_sc_ha", "is", null)
      .order("data_plantio", { ascending: true }),
  ]);

  const resumo: ResumoProducao[] = (resumoRes.data ?? []).map((r) => ({
    ano: r.ano,
    cultura: r.cultura,
    total_area: Number(r.total_area) || 0,
    total_volume: r.total_volume != null ? Number(r.total_volume) : null,
    avg_produtividade:
      r.avg_produtividade != null ? Number(r.avg_produtividade) : null,
  }));

  const plantiosBrutos: PlantioEnriquecido[] = (
    (plantiosRes.data as PlantioBrutoRow[] | null) ?? []
  ).map((p) => ({
    id: p.id,
    ano: p.ano,
    data_plantio: p.data_plantio ?? null,
    data_colheita: p.data_colheita ?? null,
    area_ha: Number(p.area_ha) || 0,
    volume_colhido: p.volume_colhido != null ? Number(p.volume_colhido) : null,
    produtividade_sc_ha:
      p.produtividade_sc_ha != null ? Number(p.produtividade_sc_ha) : null,
    talhao_id: p.talhoes?.id ?? null,
    talhao: p.talhoes?.nome ?? "—",
    cultura: p.culturas?.nome ?? "—",
    safra: p.safras?.nome ?? "—",
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <DashboardClient
        resumo={resumo}
        talhoesAtivos={talhoesRes.count ?? 0}
        plantiosBrutos={plantiosBrutos}
      />
    </div>
  );
}
