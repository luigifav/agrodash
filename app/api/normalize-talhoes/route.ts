import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `Você é um assistente especializado em dados agrícolas brasileiros.
Analise os nomes de talhões abaixo e agrupe os que claramente representam
o mesmo talhão físico. Considere variações de ano (2022, 23/24, 22/23),
abreviações, diferenças de capitalização e sufixos como Soja, Verão, Safrinha.
Retorne APENAS JSON válido, sem markdown, no formato:
[{ "canonical_id": "uuid_do_talhao_mais_descritivo", "alias_ids": ["uuid1", "uuid2"] }]
Se um talhão não tiver duplicatas, não inclua no array.
IDs e nomes dos talhões:`;

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

type NormGroup = { canonical_id: string; alias_ids: string[] };

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("talhoes")
    .select("id, nome, canonical_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const talhoes = (data ?? []).filter((t) => !t.canonical_id);

  if (talhoes.length < 2) {
    return NextResponse.json({ message: "Nenhuma normalização necessária" });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const BATCH_SIZE = 80;
  const batches: typeof talhoes[] = [];
  for (let i = 0; i < talhoes.length; i += BATCH_SIZE) {
    batches.push(talhoes.slice(i, i + BATCH_SIZE));
  }

  let grupos: NormGroup[];
  try {
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: JSON.stringify(batch.map((t) => ({ id: t.id, nome: t.nome }))),
            },
          ],
        });

        if (msg.stop_reason !== "end_turn") {
          throw new Error("Resposta da IA incompleta. Tente novamente ou reduza o número de talhões.");
        }

        const content = msg.content[0];
        if (content.type !== "text") throw new Error("Resposta inesperada da IA");
        return JSON.parse(stripFences(content.text)) as NormGroup[];
      })
    );
    grupos = batchResults.flat();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let normalizado = 0;
  for (const grupo of grupos) {
    if (!grupo.alias_ids?.length) continue;
    const { error: updateError } = await supabase
      .from("talhoes")
      .update({ canonical_id: grupo.canonical_id })
      .in("id", grupo.alias_ids);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    normalizado += grupo.alias_ids.length;
  }

  return NextResponse.json({ normalizado, grupos });
}
