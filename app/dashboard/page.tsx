import { createClient } from "@/lib/supabase/server";
import { MapPin, Sprout, BarChart3, TrendingUp } from "lucide-react";

async function getStats() {
  const supabase = await createClient();

  const [talhoesRes, plantiosRes, areaRes, prodRes, recentRes] =
    await Promise.all([
      supabase
        .from("talhoes")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true),
      supabase
        .from("plantios")
        .select("id", { count: "exact", head: true }),
      supabase.from("plantios").select("area_ha"),
      supabase
        .from("plantios")
        .select("produtividade_sc_ha")
        .not("produtividade_sc_ha", "is", null),
      supabase
        .from("plantios")
        .select(
          `id, ano, area_ha, volume_colhido, produtividade_sc_ha,
           talhoes(nome), culturas(nome), safras(nome), unidades(sigla)`
        )
        .order("criado_em", { ascending: false })
        .limit(10),
    ]);

  const totalArea = (areaRes.data ?? []).reduce(
    (sum, p) => sum + (Number(p.area_ha) || 0),
    0
  );

  const prodValues = (prodRes.data ?? [])
    .map((p) => Number(p.produtividade_sc_ha))
    .filter((v) => !isNaN(v));
  const avgProd =
    prodValues.length > 0
      ? prodValues.reduce((a, b) => a + b, 0) / prodValues.length
      : 0;

  return {
    talhoesAtivos: talhoesRes.count ?? 0,
    totalPlantios: plantiosRes.count ?? 0,
    totalArea: totalArea.toFixed(1),
    avgProd: avgProd.toFixed(1),
    recentPlantios: recentRes.data ?? [],
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const statCards = [
    {
      label: "Talhões Ativos",
      value: stats.talhoesAtivos,
      icon: MapPin,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Plantios",
      value: stats.totalPlantios,
      icon: Sprout,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Área Total",
      value: `${stats.totalArea} ha`,
      icon: BarChart3,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Produtividade Média",
      value: `${stats.avgProd} sc/ha`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div
                className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Últimos Plantios</h2>
        </div>
        {stats.recentPlantios.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum plantio registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Talhão",
                    "Cultura",
                    "Safra",
                    "Ano",
                    "Área (ha)",
                    "Produtividade",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${i >= 4 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {stats.recentPlantios.map((p: any) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 text-gray-900">
                      {p.talhoes?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.culturas?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.safras?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.ano}</td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {Number(p.area_ha).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.produtividade_sc_ha
                        ? `${Number(p.produtividade_sc_ha).toFixed(1)} sc/ha`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
