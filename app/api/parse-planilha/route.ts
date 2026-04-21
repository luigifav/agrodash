import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// ── Types ──────────────────────────────────────────────────────────────────────

type ColumnMapping = {
  columns: {
    talhao_nome: string | null;
    ano: string | null;
    safra_nome: string | null;
    cultura_nome: string | null;
    data_plantio: string | null;
    data_colheita: string | null;
    area_ha: string | null;
    volume_colhido: string | null;
    unidade_sigla: string | null;
    produtividade_sc_ha: string | null;
    agronomo_nome: string | null;
    latitude: string | null;
    longitude: string | null;
    area_unidade: string | null;
  };
  normalizations: {
    safra_nome?: Record<string, string>;
    cultura_nome?: Record<string, string>;
    unidade_sigla?: Record<string, string>;
    area_unidade?: Record<string, string>;
  };
  // Valores fixos para campos ausentes nas colunas mas inferíveis pelo contexto
  default_values?: {
    cultura_nome?: string | null;
    safra_nome?: string | null;
    unidade_sigla?: string | null;
    ano?: number | null;
  };
  // "sc_alq" quando produtividade vier por alqueire (divide por 2.42 para virar sc/ha)
  produtividade_unit?: "sc_ha" | "sc_alq";
  ano_from_plantio?: boolean;
  talhao_from_concat?: boolean;
  talhao_concat_columns?: string[];
};

// ── System prompts ─────────────────────────────────────────────────────────────

const XLSX_MAPPING_SYSTEM = `Você é um assistente de mapeamento de planilhas agrícolas brasileiras.
Analise os cabeçalhos e linhas de amostra fornecidos e retorne APENAS um objeto JSON válido, sem markdown, sem explicações.

Formato exato:
{
  "columns": {
    "talhao_nome": "nome exato da coluna ou null",
    "ano": "nome exato da coluna ou null",
    "safra_nome": "nome exato da coluna ou null",
    "cultura_nome": "nome exato da coluna ou null",
    "data_plantio": "nome exato da coluna ou null",
    "data_colheita": "nome exato da coluna ou null",
    "area_ha": "nome exato da coluna ou null",
    "area_unidade": "nome exato da coluna ou null",
    "volume_colhido": "nome exato da coluna ou null",
    "unidade_sigla": "nome exato da coluna ou null",
    "produtividade_sc_ha": "nome exato da coluna ou null",
    "agronomo_nome": "nome exato da coluna ou null",
    "latitude": "nome exato da coluna ou null",
    "longitude": "nome exato da coluna ou null"
  },
  "normalizations": {
    "safra_nome": { "valor_exato_da_planilha": "Verão|Inverno|Safrinha" },
    "cultura_nome": { "valor_exato_da_planilha": "Soja|Milho|Sorgo|Cevada|Batata|Trigo|Feijão" },
    "unidade_sigla": { "valor_exato_da_planilha": "sc|t" },
    "area_unidade": { "valor_exato_da_planilha": "alq|ha" }
  },
  "default_values": {
    "cultura_nome": null,
    "safra_nome": null,
    "unidade_sigla": null,
    "ano": null
  },
  "produtividade_unit": "sc_ha",
  "ano_from_plantio": false,
  "talhao_from_concat": false,
  "talhao_concat_columns": []
}

REGRAS CRÍTICAS:

1. CULTURA vs VARIEDADE (muito importante):
   - "cultura_nome" deve ser uma coluna que contenha o TIPO de cultivo: Soja, Milho, Trigo, etc.
   - Colunas chamadas "Variedade", "Cultivar", "Varietal", "Lote" contêm NOMES DE SEMENTES (ex: "LG 60162", "BMX ZEUS IPRO") — NÃO são cultura. Mapeie-as como null para cultura_nome.
   - Se não houver coluna de cultura mas os valores de Variedade forem claramente de soja (ex: terminam em "IPRO", "RR", "I2X", ou são codes como "LG 60162"), coloque "Soja" em default_values.cultura_nome.
   - Se os valores de variedade forem de milho (ex: "DKB", "P3431"), coloque "Milho" em default_values.cultura_nome.

2. SAFRA (quando não há coluna explícita):
   - Se houver coluna de data_plantio e não houver coluna de safra_nome, analise os meses das datas de amostra:
     - Plantio em out-fev → default_values.safra_nome = "Verão"
     - Plantio em mar-mai → default_values.safra_nome = "Safrinha"
     - Plantio em jun-set → default_values.safra_nome = "Inverno"
   - Se não houver data_plantio, deixe default_values.safra_nome como null.

3. UNIDADE (quando não há coluna explícita):
   - Se a área estiver em alqueires (coluna "Alq", "Alqueire") e não houver coluna de unidade_sigla, defina default_values.unidade_sigla = "sc" (padrão para soja/grãos).

4. PRODUTIVIDADE:
   - Se a coluna de produtividade tiver "Alq" no nome (ex: "Prod./Alq.", "Prod/Alq"), defina produtividade_unit: "sc_alq". O sistema vai dividir por 2.42 automaticamente para converter para sc/ha.
   - Se já for por hectare, use produtividade_unit: "sc_ha".

5. TALHÃO:
   - Se o talhão for formado por múltiplas colunas (ex: Local + Propriedade, ou Fazenda + Pivô), defina talhao_from_concat: true e liste as colunas em talhao_concat_columns.
   - Se houver somente uma coluna identificando o talhão (ex: "Propriedade", "Pivô"), mapeie diretamente para talhao_nome.

6. ÁREA:
   - Se a área estiver em alqueires (coluna "Alq" ou similar), normalize area_unidade para "alq".
   - Se já estiver em hectares, normalize para "ha".

7. ANO:
   - Se não houver coluna de ano mas houver data_plantio, defina ano_from_plantio: true.
   - Se não houver nem data_plantio, tente inferir o ano pelo contexto e coloque em default_values.ano.

8. Campos não encontrados e não inferíveis: use null.
9. normalizations deve cobrir TODOS os valores únicos encontrados nas amostras.`;

const PDF_SYSTEM = `Você é um parser de relatórios agrícolas brasileiros em PDF. O texto abaixo foi extraído de um PDF que pode ser uma tabela, relatório ou planilha exportada. Analise o conteúdo e extraia todos os registros de plantio que encontrar.

Retorne APENAS um array JSON válido, sem nenhum texto adicional, sem markdown, sem explicações.

Regras obrigatórias:
- Para safra, normalize para: Verão, Inverno ou Safrinha
- Para cultura, normalize para: Soja, Milho, Sorgo, Cevada, Batata, Trigo ou Feijão
- Para datas, use formato YYYY-MM-DD. Se o ano tiver apenas 2 dígitos (ex: 03/10/25), interprete como 2025
- Se a área estiver em alqueires (coluna "Alq" ou similar), defina area_unidade como "alq" e retorne o valor bruto (sem converter). Se já estiver em hectares, defina area_unidade como "ha"
- Se houver coordenadas em grau-minuto-segundo (ex: 23° 37' 51.65" S), converta para decimal negativo: -(graus + minutos/60 + segundos/3600). O resultado para S e W deve ser negativo
- O talhao_nome deve ser formado pela concatenação de todos os campos que identificam o talhão (ex: Propriedade + nome do pivô/área separados por espaço, como "TRIUNFO PV 3" ou "N. ESP. PIVO 8")
- Se não houver coluna de ano mas houver data_plantio, extraia o ano dela
- Se um campo não existir no documento, use null

O formato de cada objeto deve ser exatamente:
{
  talhao_nome,
  ano,
  safra_nome,
  cultura_nome,
  data_plantio,
  data_colheita,
  area_ha,
  area_unidade,
  volume_colhido,
  unidade_sigla,
  produtividade_sc_ha,
  agronomo_nome,
  latitude,
  longitude
}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

const ALQ_TO_HA = 2.42;

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  // ISO string do xlsx cellDates:true → "2023-03-15T03:00:00.000Z"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  // Já YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // DD/MM/YYYY
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `${y}-${m}-${d}`;
  }
  // DD/MM/YY
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{2}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `20${y}-${m}-${d}`;
  }
  // Número serial do Excel
  if (typeof value === "number") {
    return new Date((value - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseCoordenada(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const str = String(value).trim();
  // DMS: 23° 37' 51.65" S  ou  48° 47' 15.42" W
  const dms = str.match(/(\d+)[°]\s*(\d+)['’′]\s*([\d.]+)["”″]\s*([NSEWnsew])/);
  if (dms) {
    const decimal = parseInt(dms[1]) + parseInt(dms[2]) / 60 + parseFloat(dms[3]) / 3600;
    return (dms[4].toUpperCase() === "S" || dms[4].toUpperCase() === "W") ? -decimal : decimal;
  }
  const n = parseFloat(str.replace(",", "."));
  return isNaN(n) ? null : n;
}

function lookupNorm(raw: string, map: Record<string, string> | undefined): string {
  if (!map) return raw;
  const trimmed = raw.trim();
  if (map[raw] != null) return map[raw];
  if (map[trimmed] != null) return map[trimmed];
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase().trim() === lower) return v;
  }
  return trimmed;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

function applyMapping(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping
) {
  const {
    columns: c,
    normalizations: norm = {},
    ano_from_plantio,
    talhao_from_concat,
    talhao_concat_columns,
    default_values: dv = {},
    produtividade_unit = "sc_ha",
  } = mapping;

  return rows.map((row) => {
    // ── Datas ──
    const dataPlantio = parseDate(c.data_plantio ? row[c.data_plantio] : null);
    const dataColheita = parseDate(c.data_colheita ? row[c.data_colheita] : null);

    // ── Ano ──
    let ano: number | null = null;
    if (c.ano && row[c.ano] != null) {
      ano = parseInt(String(row[c.ano]));
      if (isNaN(ano)) ano = null;
    }
    if (ano == null && ano_from_plantio && dataPlantio) {
      ano = parseInt(dataPlantio.slice(0, 4));
    }
    if (ano == null && dv.ano != null) {
      ano = dv.ano;
    }

    // ── Talhão ──
    let talhao_nome = "";
    if (talhao_from_concat && talhao_concat_columns?.length) {
      talhao_nome = talhao_concat_columns
        .map((col) => String(row[col] ?? "").trim())
        .filter(Boolean)
        .join(" ");
    } else {
      talhao_nome = c.talhao_nome ? String(row[c.talhao_nome] ?? "").trim() : "";
    }

    // ── Cultura ──
    const rawCultura = c.cultura_nome ? String(row[c.cultura_nome] ?? "") : "";
    const cultura_nome =
      lookupNorm(rawCultura, norm.cultura_nome) ||
      dv.cultura_nome ||
      null;

    // ── Safra ──
    const rawSafra = c.safra_nome ? String(row[c.safra_nome] ?? "") : "";
    const safra_nome =
      lookupNorm(rawSafra, norm.safra_nome) ||
      dv.safra_nome ||
      null;

    // ── Unidade ──
    const rawUnidade = c.unidade_sigla ? String(row[c.unidade_sigla] ?? "") : "";
    const unidade_sigla =
      lookupNorm(rawUnidade, norm.unidade_sigla) ||
      dv.unidade_sigla ||
      null;

    // ── Área ──
    const rawAreaUnidade = c.area_unidade ? String(row[c.area_unidade] ?? "") : "";
    const area_unidade = lookupNorm(rawAreaUnidade, norm.area_unidade) || "ha";

    // ── Produtividade (com conversão sc/alq → sc/ha se necessário) ──
    let produtividade_sc_ha = parseNumber(
      c.produtividade_sc_ha ? row[c.produtividade_sc_ha] : null
    );
    if (produtividade_sc_ha != null && produtividade_unit === "sc_alq") {
      produtividade_sc_ha = Math.round((produtividade_sc_ha / ALQ_TO_HA) * 100) / 100;
    }

    return {
      talhao_nome: talhao_nome || null,
      ano,
      safra_nome,
      cultura_nome,
      data_plantio: dataPlantio,
      data_colheita: dataColheita,
      area_ha: parseNumber(c.area_ha ? row[c.area_ha] : null),
      area_unidade,
      volume_colhido: parseNumber(c.volume_colhido ? row[c.volume_colhido] : null),
      unidade_sigla,
      produtividade_sc_ha,
      agronomo_nome: c.agronomo_nome ? String(row[c.agronomo_nome] ?? "") || null : null,
      latitude: parseCoordenada(c.latitude ? row[c.latitude] : null),
      longitude: parseCoordenada(c.longitude ? row[c.longitude] : null),
    };
  });
}

// Tenta parsear JSON da IA, fazendo retry com instrução mais restritiva se falhar
async function parseAIJson<T>(
  anthropic: Anthropic,
  params: Parameters<typeof anthropic.messages.create>[0],
  context: string
): Promise<T> {
  const attempt = async (extraInstruction?: string) => {
    const p = extraInstruction
      ? {
          ...params,
          messages: [
            ...params.messages,
            { role: "assistant" as const, content: extraInstruction },
          ],
        }
      : params;
    const msg = await anthropic.messages.create(p);
    const content = msg.content[0];
    if (content.type !== "text") throw new Error("Resposta inesperada da IA");
    return JSON.parse(stripFences(content.text)) as T;
  };

  try {
    return await attempt();
  } catch {
    // Retry com instrução explícita
    try {
      return await attempt("Retorne APENAS JSON válido, sem nenhum texto, sem markdown.");
    } catch (err2) {
      throw new Error(`${context}: ${err2 instanceof Error ? err2.message : String(err2)}`);
    }
  }
}

// ── Route ──────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  // Limite de tamanho
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Arquivo muito grande. O limite é 10 MB." },
      { status: 400 }
    );
  }

  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf");
  const isXlsx = name.endsWith(".xls") || name.endsWith(".xlsx");

  if (!isPdf && !isXlsx) {
    return NextResponse.json(
      { error: "Formato inválido. Envie um arquivo .xls, .xlsx ou .pdf" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Caminho PDF ───────────────────────────────────────────────────────────────
  if (isPdf) {
    let pdfText: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      pdfText = result.text;
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o arquivo PDF." }, { status: 422 });
    }

    if (!pdfText || pdfText.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            "PDF não legível. O arquivo pode ser uma imagem escaneada sem texto. Tente converter para XLS ou XLSX antes de importar.",
        },
        { status: 422 }
      );
    }

    try {
      const parsed = await parseAIJson<unknown[]>(
        anthropic,
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: PDF_SYSTEM,
          messages: [{ role: "user", content: `Aqui está o texto extraído do PDF:\n${pdfText.slice(0, 20000)}` }],
        },
        "Falha ao processar PDF com IA"
      );
      return NextResponse.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Caminho XLSX ──────────────────────────────────────────────────────────────
  let rows: Record<string, unknown>[];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, unknown>[];
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Verifique se é um .xls/.xlsx válido." },
      { status: 422 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "A planilha está vazia." }, { status: 422 });
  }

  const LIMIT = 500;
  const truncated = rows.length > LIMIT;
  const totalRows = rows.length;
  rows = rows.slice(0, LIMIT);

  // Envia apenas cabeçalhos + 10 linhas de amostra para a IA
  const sample = rows.slice(0, 10);
  const headers = Object.keys(rows[0]);

  let mapping: ColumnMapping;
  try {
    mapping = await parseAIJson<ColumnMapping>(
      anthropic,
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: XLSX_MAPPING_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Cabeçalhos: ${JSON.stringify(headers)}\n\nLinhas de amostra:\n${JSON.stringify(sample, null, 2)}`,
          },
        ],
      },
      "Falha ao mapear colunas com IA"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const result = applyMapping(rows, mapping);

  return NextResponse.json({
    rows: result,
    truncated,
    total_rows: totalRows,
  });
}
