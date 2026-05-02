import { createClient } from "@/lib/supabase/server";
import { JanelaPlantioClient } from "@/components/janela-plantio-client";
import type { JanelaData } from "@/lib/database.types";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

type JanelaRow = {
  data_plantio: string | null;
  produtividade_sc_ha: number | null;
  area_ha: number | null;
  talhoes: { id: string; nome: string } | null;
  culturas: { nome: string } | null;
  safras: { nome: string } | null;
};

type Acc = {
  cultura: string;
  talhao: string;
  mes: number;
  quinzena: 1 | 2;
  prodSum: number;
  prodCount: number;
  areaSum: number;
  areaCount: number;
};

export default async function JanelaPlantioPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("plantios")
    .select(
      `data_plantio, produtividade_sc_ha, area_ha,
       talhoes(id, nome),
       culturas(nome),
       safras(nome)`
    )
    .not("produtividade_sc_ha", "is", null)
    .not("data_plantio", "is", null);

  const rows = (data as JanelaRow[] | null) ?? [];

  const buckets = new Map<string, Acc>();
  for (const r of rows) {
    if (!r.data_plantio || r.produtividade_sc_ha == null) continue;
    const cultura = r.culturas?.nome ?? "—";
    const talhao = r.talhoes?.nome ?? "—";
    const d = new Date(r.data_plantio);
    if (Number.isNaN(d.getTime())) continue;
    const mes = d.getMonth();
    const dia = d.getDate();
    const quinzena: 1 | 2 = dia <= 15 ? 1 : 2;
    const key = `${cultura}__${talhao}__${mes}__${quinzena}`;
    const cur = buckets.get(key) ?? {
      cultura,
      talhao,
      mes,
      quinzena,
      prodSum: 0,
      prodCount: 0,
      areaSum: 0,
      areaCount: 0,
    };
    cur.prodSum += Number(r.produtividade_sc_ha);
    cur.prodCount += 1;
    if (r.area_ha != null) {
      cur.areaSum += Number(r.area_ha);
      cur.areaCount += 1;
    }
    buckets.set(key, cur);
  }

  const janelaData: JanelaData[] = Array.from(buckets.values()).map((b) => ({
    cultura: b.cultura,
    talhao: b.talhao,
    periodo: `${MESES[b.mes]} Q${b.quinzena}`,
    mes: b.mes,
    quinzena: b.quinzena,
    produtividade_media: b.prodCount > 0 ? b.prodSum / b.prodCount : 0,
    total_plantios: b.prodCount,
    area_media: b.areaCount > 0 ? b.areaSum / b.areaCount : 0,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Janela de Plantio
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Identifique as melhores quinzenas de plantio cruzando histórico de
        produtividade por cultura e talhão.
      </p>
      <JanelaPlantioClient data={janelaData} />
    </div>
  );
}
