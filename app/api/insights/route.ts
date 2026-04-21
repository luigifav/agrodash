import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

type InsightsRequest = {
  talhao_id?: string;
  cultura?: string;
  anos?: number[];
};

type PlantioData = {
  talhao: string;
  cultura: string;
  safra: string;
  ano: number;
  data_plantio: string;
  data_colheita: string | null;
  area_ha: number;
  volume_colhido: number | null;
  produtividade_sc_ha: number | null;
};

type StatisticsSummary = {
  total_plantios: number;
  periodo: string;
  culturas_analisadas: string[];
  safras_analisadas: string[];
  area_total_ha: number;
  volume_total_colhido: number | null;
  produtividade_media_sc_ha: number | null;
  produtividade_min_sc_ha: number | null;
  produtividade_max_sc_ha: number | null;
  por_ano: Record<
    number,
    {
      total_plantios: number;
      area_ha: number;
      produtividade_media_sc_ha: number | null;
    }
  >;
  por_cultura: Record<
    string,
    {
      total_plantios: number;
      produtividade_media_sc_ha: number | null;
      area_ha: number;
    }
  >;
  melhor_safra: {
    cultura: string;
    ano: number;
    produtividade_sc_ha: number;
  } | null;
  pior_safra: {
    cultura: string;
    ano: number;
    produtividade_sc_ha: number;
  } | null;
};

type InsightsResponse = {
  tendencia: string;
  melhor_epoca: string;
  alertas: string[];
  recomendacoes: string[];
};

function buildStatisticsSummary(plantios: PlantioData[]): StatisticsSummary {
  if (plantios.length === 0) {
    return {
      total_plantios: 0,
      periodo: "N/A",
      culturas_analisadas: [],
      safras_analisadas: [],
      area_total_ha: 0,
      volume_total_colhido: null,
      produtividade_media_sc_ha: null,
      produtividade_min_sc_ha: null,
      produtividade_max_sc_ha: null,
      por_ano: {},
      por_cultura: {},
      melhor_safra: null,
      pior_safra: null,
    };
  }

  const anos = Array.from(new Set(plantios.map((p) => p.ano))).sort();
  const culturas = Array.from(new Set(plantios.map((p) => p.cultura))).sort();
  const safras = Array.from(new Set(plantios.map((p) => p.safra))).sort();

  // Totals
  const area_total_ha = plantios.reduce((sum, p) => sum + p.area_ha, 0);
  const volume_total_colhido = plantios.reduce(
    (sum, p) => sum + (p.volume_colhido ?? 0),
    0
  );

  // Produtividade
  const produtividadeValues = plantios
    .filter((p) => p.produtividade_sc_ha != null)
    .map((p) => p.produtividade_sc_ha as number);
  const produtividade_media_sc_ha =
    produtividadeValues.length > 0
      ? produtividadeValues.reduce((a, b) => a + b, 0) /
        produtividadeValues.length
      : null;
  const produtividade_min_sc_ha =
    produtividadeValues.length > 0 ? Math.min(...produtividadeValues) : null;
  const produtividade_max_sc_ha =
    produtividadeValues.length > 0 ? Math.max(...produtividadeValues) : null;

  // Por ano
  const por_ano: Record<
    number,
    {
      total_plantios: number;
      area_ha: number;
      produtividade_media_sc_ha: number | null;
    }
  > = {};
  for (const ano of anos) {
    const plantiosPorAno = plantios.filter((p) => p.ano === ano);
    const prodValues = plantiosPorAno
      .filter((p) => p.produtividade_sc_ha != null)
      .map((p) => p.produtividade_sc_ha as number);
    por_ano[ano] = {
      total_plantios: plantiosPorAno.length,
      area_ha: plantiosPorAno.reduce((sum, p) => sum + p.area_ha, 0),
      produtividade_media_sc_ha:
        prodValues.length > 0
          ? prodValues.reduce((a, b) => a + b, 0) / prodValues.length
          : null,
    };
  }

  // Por cultura
  const por_cultura: Record<
    string,
    {
      total_plantios: number;
      produtividade_media_sc_ha: number | null;
      area_ha: number;
    }
  > = {};
  for (const cultura of culturas) {
    const plantiosPorCultura = plantios.filter((p) => p.cultura === cultura);
    const prodValues = plantiosPorCultura
      .filter((p) => p.produtividade_sc_ha != null)
      .map((p) => p.produtividade_sc_ha as number);
    por_cultura[cultura] = {
      total_plantios: plantiosPorCultura.length,
      produtividade_media_sc_ha:
        prodValues.length > 0
          ? prodValues.reduce((a, b) => a + b, 0) / prodValues.length
          : null,
      area_ha: plantiosPorCultura.reduce((sum, p) => sum + p.area_ha, 0),
    };
  }

  // Melhor e pior safra
  const plantiosComProdutividade = plantios.filter(
    (p) => p.produtividade_sc_ha != null
  );
  let melhor_safra: { cultura: string; ano: number; produtividade_sc_ha: number } | null = null;
  let pior_safra: { cultura: string; ano: number; produtividade_sc_ha: number } | null = null;

  if (plantiosComProdutividade.length > 0) {
    const melhor = plantiosComProdutividade.reduce((prev, current) =>
      (prev.produtividade_sc_ha ?? 0) > (current.produtividade_sc_ha ?? 0)
        ? prev
        : current
    );
    melhor_safra = {
      cultura: melhor.cultura,
      ano: melhor.ano,
      produtividade_sc_ha: melhor.produtividade_sc_ha as number,
    };

    const pior = plantiosComProdutividade.reduce((prev, current) =>
      (prev.produtividade_sc_ha ?? 0) < (current.produtividade_sc_ha ?? 0)
        ? prev
        : current
    );
    pior_safra = {
      cultura: pior.cultura,
      ano: pior.ano,
      produtividade_sc_ha: pior.produtividade_sc_ha as number,
    };
  }

  return {
    total_plantios: plantios.length,
    periodo: anos.length > 0 ? `${anos[0]}-${anos[anos.length - 1]}` : "N/A",
    culturas_analisadas: culturas,
    safras_analisadas: safras,
    area_total_ha,
    volume_total_colhido: volume_total_colhido || null,
    produtividade_media_sc_ha,
    produtividade_min_sc_ha,
    produtividade_max_sc_ha,
    por_ano,
    por_cultura,
    melhor_safra,
    pior_safra,
  };
}

async function getInsightsFromClaude(
  summary: StatisticsSummary
): Promise<InsightsResponse> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `Você é um especialista agrícola com profundo conhecimento em análise de dados de plantios, produtividade e safras. Analise os dados estatísticos fornecidos e retorne um JSON válido com exatamente esses campos:
- "tendencia": Descrição em 1-2 frases sobre a tendência geral (produtividade aumentando, estável ou diminuindo)
- "melhor_epoca": Descrição em 1-2 frases sobre a melhor época/cultura/ano para plantio baseado nos dados
- "alertas": Array de strings com até 3 alertas sobre riscos ou problemas identificados
- "recomendacoes": Array de strings com até 4 recomendações práticas para melhorar a produção

Retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações.`;

  const userMessage = `Analise os seguintes dados de plantios:

${JSON.stringify(summary, null, 2)}

Identifique: tendências de produtividade, melhor época/cultura para plantio, alertas sobre baixa performance, e recomendações para otimizar a produção.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Resposta inesperada da IA");
  }

  try {
    const cleaned = content.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Falha ao processar resposta da IA: ${content.text}`);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: InsightsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    // Build query
    let query = supabase
      .from("plantios")
      .select(
        `talhao_id, cultura_id, safra_id, ano, data_plantio, data_colheita,
         area_ha, volume_colhido, produtividade_sc_ha,
         talhoes(nome), culturas(nome), safras(nome)`
      );

    // Apply filters
    if (body.talhao_id) {
      query = query.eq("talhao_id", body.talhao_id);
    }

    if (body.cultura) {
      query = query.eq("culturas.nome", body.cultura);
    }

    if (body.anos && body.anos.length > 0) {
      query = query.in("ano", body.anos);
    }

    const { data: rawPlantios, error: queryError } = await query;

    if (queryError) {
      return NextResponse.json(
        { error: `Erro ao buscar plantios: ${queryError.message}` },
        { status: 500 }
      );
    }

    if (!rawPlantios || rawPlantios.length === 0) {
      return NextResponse.json(
        { error: "Nenhum plantio encontrado com os filtros especificados" },
        { status: 404 }
      );
    }

    // Map data
    const plantios: PlantioData[] = (
      rawPlantios as Array<{
        talhao_id: string;
        cultura_id: string;
        safra_id: string;
        ano: number;
        data_plantio: string;
        data_colheita: string | null;
        area_ha: number;
        volume_colhido: number | null;
        produtividade_sc_ha: number | null;
        talhoes: { nome: string } | null;
        culturas: { nome: string } | null;
        safras: { nome: string } | null;
      }>
    ).map((p) => ({
      talhao: p.talhoes?.nome || "—",
      cultura: p.culturas?.nome || "—",
      safra: p.safras?.nome || "—",
      ano: p.ano,
      data_plantio: p.data_plantio,
      data_colheita: p.data_colheita,
      area_ha: Number(p.area_ha) || 0,
      volume_colhido: p.volume_colhido != null ? Number(p.volume_colhido) : null,
      produtividade_sc_ha:
        p.produtividade_sc_ha != null ? Number(p.produtividade_sc_ha) : null,
    }));

    // Build summary
    const summary = buildStatisticsSummary(plantios);

    // Get insights from Claude
    const insights = await getInsightsFromClaude(summary);

    return NextResponse.json({
      summary,
      insights,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao gerar insights: ${msg}` },
      { status: 500 }
    );
  }
}
