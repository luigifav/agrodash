import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import type { ResumoProducao } from "@/lib/database.types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [talhoesRes, resumoRes] = await Promise.all([
    supabase
      .from("talhoes")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
    supabase.rpc("resumo_producao_por_ano_cultura"),
  ]);

  const resumo: ResumoProducao[] = (resumoRes.data ?? []).map((r) => ({
    ano: r.ano,
    cultura: r.cultura,
    total_area: Number(r.total_area) || 0,
    total_volume: r.total_volume != null ? Number(r.total_volume) : null,
    avg_produtividade: r.avg_produtividade != null ? Number(r.avg_produtividade) : null,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <DashboardClient
        resumo={resumo}
        talhoesAtivos={talhoesRes.count ?? 0}
      />
    </div>
  );
}
