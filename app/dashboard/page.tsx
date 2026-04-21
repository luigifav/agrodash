import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import type { PlantioData } from "@/components/dashboard-client";
import type { PlantioComResumo, Tables } from "@/lib/database.types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [talhoesRes, plantiosRes, safrasRes] = await Promise.all([
    supabase
      .from("talhoes")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
    supabase.from("plantios").select(
      `id, ano, area_ha, volume_colhido, produtividade_sc_ha,
       talhoes(nome), culturas(nome), safras(nome)`
    ),
    supabase.from("safras").select("nome").order("id"),
  ]);

  const plantios: PlantioData[] = (plantiosRes.data as PlantioComResumo[] ?? []).map((p) => ({
    id: p.id,
    ano: p.ano,
    area_ha: Number(p.area_ha) || 0,
    volume_colhido: p.volume_colhido != null ? Number(p.volume_colhido) : null,
    produtividade_sc_ha:
      p.produtividade_sc_ha != null ? Number(p.produtividade_sc_ha) : null,
    cultura: p.culturas?.nome ?? "—",
    safra: p.safras?.nome ?? "—",
    talhao: p.talhoes?.nome ?? "—",
  }));

  const safras: string[] = (safrasRes.data as Pick<Tables<"safras">, "nome">[] ?? []).map(
    (s) => s.nome
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <DashboardClient
        plantios={plantios}
        safras={safras}
        talhoesAtivos={talhoesRes.count ?? 0}
      />
    </div>
  );
}
