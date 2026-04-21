import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SAFRAS, CULTURAS, UNIDADES, AREA_UNIDADES } from "@/lib/constants";

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
  ano_from_plantio?: boolean;
  talhao_from_concat?: boolean;
  talhao_concat_columns?: string[];
  default_values?: {
    cultura_nome?: string | null;
    safra_nome?: string | null;
    unidade_sigla?: string | null;
    ano?: number | null;
  };
  produtividade_unit?: "sc_ha" | "sc_alq";
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
    "safra_nome": { "valor_exato": "Verão|Inverno|Safrinha" },
    "cultura_nome": { "valor_exato": "Soja|Milho|Sorgo|Cevada|Batata|Trigo|Feijão" },
    "unidade_sigla": { "valor_exato": "sc|t" },
    "area_unidade": { "valor_exato": "alq|ha" }
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

Regras CRÍTICAS de mapeamento de colunas:
- "cultura_nome" deve ser mapeado para uma coluna que contenha o TIPO de cultivo (Soja, Milho, Trigo etc.), NÃO para colunas de variedade/cultivar (ex: "Variedade", "Cultivar", "Varietal" devem ser null para cultura_nome — elas contêm nomes de sementes como "LG 60162", não a cultura)
- Se não existir coluna de cultura_nome mas TODOS os valores de amostra indicarem a mesma cultura (ex: variedades de soja como "LG 60162 IPRO", "BMX ZEUS IPRO"), infira a cultura e coloque em default_values.cultura_nome (ex: "Soja")
- Se não existir coluna de safra_nome mas as datas de plantio indicarem uma época (out-mar = "Verão", abr-jun = "Safrinha", jul-set = "Inverno"), infira e coloque em default_values.safra_nome
- Se não existir coluna de unidade_sigla mas a área estiver em alqueires (Alq), defina default_values.unidade_sigla como "sc" (padrão para soja/grãos)
- Se não existir coluna de ano mas houver data_plantio, defina ano_from_plantio: true
- Se a produtividade for por alqueire (coluna "Prod./Alq.", "Prod/Alq" ou similar), defina produtividade_unit: "sc_alq" (o sistema vai converter dividindo por 2.42)
- Se o talhão for formado por múltiplas colunas (ex: Local + Propriedade), use talhao_from_concat: true com as colunas em talhao_concat_columns
- Se a área estiver em alqueires, normalize area_unidade para "alq"; se em hectares, para "ha"
- normalizations deve cobrir TODOS os valores únicos encontrados nas amostras
- Campos não encontrados e não inferíveis: use null`;

const PDF_SYSTEM = `Você é um parser de relatórios agrícolas brasileiros em PDF. O texto abaixo foi extraído de um PDF que pode ser uma tabela, relatório ou planilha exportada. Analise o conteúdo e extraia todos os registros de plantio que encontrar.

Retorne APENAS um array JSON válido, sem nenhum texto adicional, sem markdown, sem explicações.

Regras obrigatórias:
- Para safra, normalize para: ${SAFRAS.join(", ")}
- Para cultura, normalize para: ${CULTURAS.join(", ")}
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

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  // ISO string from xlsx cellDates:true  →  "2023-03-15T03:00:00.000Z"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  // Already YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // DD/MM/YYYY
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `${y}-${m}-${d}`;
  }
  // Excel serial number
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
  // DMS: 23° 37' 51.65" S  ou  48° 47' 15.42" W (suporta variantes Unicode de ' e ")
  const dms = str.match(/(\d+)[°]\s*(\d+)['\u2019\u2032]\s*([\d.]+)["\u201d\u2033]\s*([NSEWnsew])/);
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
  // Exact match
  if (map[raw] != null) return map[raw];
  if (map[trimmed] != null) return map[trimmed];
  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase().trim() === lower) return v;
  }
  return trimmed;
}

function applyMapping(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping
) {
  const { columns: c, normalizations: norm = {}, ano_from_plantio, talhao_from_concat, talhao_concat_columns } = mapping;
  const ALQ_TO_HA = 2.42;

  return rows.map((row) => {
    const dataPlantio = parseDate(c.data_plantio ? row[c.data_plantio] : null);
    const dataColheita = parseDate(c.data_colheita ? row[c.data_colheita] : null);

    let ano: number | null = null;
    if (c.ano && row[c.ano] != null) {
      ano = parseInt(String(row[c.ano]));
      if (isNaN(ano)) ano = null;
    }
    if (ano == null && ano_from_plantio && dataPlantio) {
      ano = parseInt(dataPlantio.slice(0, 4));
    }

    let talhao_nome: string | null = null;
    if (talhao_from_concat && talhao_concat_columns?.length) {
      const joined = talhao_concat_columns
        .map((col) => String(row[col] ?? "").trim())
        .filter(Boolean)
        .join(" ");
      talhao_nome = joined || null;
    } else if (!talhao_from_concat) {
      talhao_nome = c.talhao_nome ? String(row[c.talhao_nome] ?? "") || null : null;
    }
    // talhao_from_concat true mas talhao_concat_columns vazio/indefinido → talhao_nome permanece null

    const rawSafra = c.safra_nome ? String(row[c.safra_nome] ?? "") : "";
    const rawCultura = c.cultura_nome ? String(row[c.cultura_nome] ?? "") : "";
    const rawUnidade = c.unidade_sigla ? String(row[c.unidade_sigla] ?? "") : "";
    const rawAreaUnidade = c.area_unidade ? String(row[c.area_unidade] ?? "") : "";
    const area_unidade = lookupNorm(rawAreaUnidade, norm.area_unidade) || "ha";

    const safra_nome = lookupNorm(rawSafra, norm.safra_nome) || mapping.default_values?.safra_nome || null;
    const cultura_nome = lookupNorm(rawCultura, norm.cultura_nome) || mapping.default_values?.cultura_nome || null;
    const unidade_sigla = lookupNorm(rawUnidade, norm.unidade_sigla) || mapping.default_values?.unidade_sigla || null;

    let produtividade = parseNumber(c.produtividade_sc_ha ? row[c.produtividade_sc_ha] : null);
    if (produtividade != null && mapping.produtividade_unit === "sc_alq") {
      produtividade = Math.round((produtividade / ALQ_TO_HA) * 100) / 100;
    }

    return {
      talhao_nome,
      ano,
      safra_nome,
      cultura_nome,
      data_plantio: dataPlantio,
      data_colheita: dataColheita,
      area_ha: parseNumber(c.area_ha ? row[c.area_ha] : null),
      area_unidade,
      volume_colhido: parseNumber(c.volume_colhido ? row[c.volume_colhido] : null),
      unidade_sigla,
      produtividade_sc_ha: produtividade,
      agronomo_nome: c.agronomo_nome ? String(row[c.agronomo_nome] ?? "") || null : null,
      latitude: parseCoordenada(c.latitude ? row[c.latitude] : null),
      longitude: parseCoordenada(c.longitude ? row[c.longitude] : null),
    };
  });
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

async function parseAIResponse(
  client: Anthropic,
  firstAttemptText: string,
  systemPrompt: string,
  userMessage: string
): Promise<unknown> {
  try {
    const cleaned = stripFences(firstAttemptText);
    return JSON.parse(cleaned);
  } catch {
    // Retry com instrução explícita sobre JSON válido
    const enhancedSystem = systemPrompt + "\n\nRetorne APENAS JSON válido, sem nenhum texto adicional.";
    const retryMessage = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: enhancedSystem,
      messages: [{ role: "user", content: userMessage }],
    });

    const retryContent = retryMessage.content[0];
    if (retryContent.type !== "text") {
      throw new Error("Resposta inesperada da IA no retry");
    }

    const cleaned = stripFences(retryContent.text);
    return JSON.parse(cleaned);
  }
}

// ── Route ──────────────────────────────────────────────────────────────────────

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

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "O arquivo excede o tamanho máximo permitido de 10 MB." },
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

  // ── PDF path ─────────────────────────────────────────────────────────────────
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

    try {
      let message;

      if (!pdfText || pdfText.trim().length < 20) {
        // Fallback: processar PDF como documento visual
        const base64Pdf = buffer.toString("base64");
        message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: PDF_SYSTEM,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Pdf,
                  },
                },
              ],
            },
          ],
        });
      } else {
        // Processamento normal com texto extraído
        const userMessage = `Aqui está o texto extraído do PDF:\n${pdfText.slice(0, 20000)}`;
        message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: PDF_SYSTEM,
          messages: [{ role: "user", content: userMessage }],
        });
      }

      const content = message.content[0];
      if (content.type !== "text") {
        return NextResponse.json({ error: "Resposta inesperada da IA" }, { status: 500 });
      }

      const userMessage = !pdfText || pdfText.trim().length < 20
        ? "Extrair registros do PDF"
        : `Aqui está o texto extraído do PDF:\n${pdfText.slice(0, 20000)}`;
      const parsed = await parseAIResponse(anthropic, content.text, PDF_SYSTEM, userMessage);
      return NextResponse.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      return NextResponse.json({ error: `Falha ao processar com IA: ${msg}` }, { status: 500 });
    }
  }

  // ── XLSX path — mapping strategy ─────────────────────────────────────────────
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

  const totalRows = rows.length;
  const truncated = totalRows > 500;
  if (truncated) {
    rows = rows.slice(0, 500);
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "A planilha está vazia." }, { status: 422 });
  }

  // Send only headers + 10 sample rows to Claude — response is tiny regardless of spreadsheet size
  const sample = rows.slice(0, 10);
  const headers = Object.keys(rows[0]);

  let mapping: ColumnMapping;
  try {
    const userMessage = `Cabeçalhos: ${JSON.stringify(headers)}\n\nLinhas de amostra:\n${JSON.stringify(sample, null, 2)}`;
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: XLSX_MAPPING_SYSTEM,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Resposta inesperada da IA" }, { status: 500 });
    }

    const parsed = await parseAIResponse(anthropic, content.text, XLSX_MAPPING_SYSTEM, userMessage);
    mapping = parsed as ColumnMapping;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Falha ao processar com IA: ${msg}` }, { status: 500 });
  }

  const result = applyMapping(rows, mapping);
  return NextResponse.json({ data: result, truncated, total_rows: totalRows });
}
