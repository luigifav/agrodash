import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `Você é um especialista em nomenclatura de talhões agrícolas brasileiros.
Identifique quais talhões da lista representam o mesmo campo físico.

REGRAS — considere iguais quando houver:
- Variações de pivô: PV, Pv, pv, Pivô, Pivo, PIVO
- Números equivalentes: 3, III, Três, tres
- Diferenças de acento: seleçoes = seleções, area = área
- Sufixos de ano: 2022, 2023, 22/23, 23/24 (ignore)
- Sufixos de cultura: Soja, Milho, Verão, Safrinha (ignore)
- Abreviações: Faz. = Fazenda, Prop. = Propriedade
- Capitalização diferente (ignore completamente)

Para cada grupo de talhões iguais, escolha como canônico o de
nome mais completo e legível.

Retorne APENAS JSON válido sem markdown:
[
  {
    "canonical_id": "uuid_do_talhao_canonico",
    "alias_ids": ["uuid_alias_1", "uuid_alias_2"]
  }
]
Inclua apenas grupos com 2+ membros. Talhões únicos não aparecem.`;

function stripFences(text: string): string {
  return text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');
}

async function comRetry<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  for (let i = 0; i < tentativas; i++) {
    try { return await fn() }
    catch (err: unknown) {
      const e = err as Error;
      if (e.message?.includes('rate_limit') && i < tentativas - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Máximo de tentativas atingido');
}

type NormGroup = { canonical_id: string; alias_ids: string[] };

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: talhoes, error: fetchError } = await supabase
    .from('talhoes')
    .select('id, nome, criado_em')
    .eq('ativo', true)
    .order('criado_em', { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!talhoes || talhoes.length < 2) {
    return NextResponse.json({ message: 'Nada a normalizar' });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let grupos: NormGroup[];
  try {
    const resultado = await comRetry(() =>
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(talhoes.map(t => ({ id: t.id, nome: t.nome }))),
          },
        ],
      })
    );

    if (resultado.stop_reason !== 'end_turn') {
      return NextResponse.json(
        { error: 'Resposta da IA incompleta. Tente novamente.' },
        { status: 500 }
      );
    }

    const content = resultado.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Resposta inesperada da IA' }, { status: 500 });
    }

    grupos = JSON.parse(stripFences(content.text)) as NormGroup[];
  } catch (err) {
    const e = err as Error;
    if (e.message?.includes('rate_limit')) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde alguns segundos e tente novamente.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: e.message ?? 'Erro desconhecido' }, { status: 500 });
  }

  let talhoes_consolidados = 0;
  for (const grupo of grupos) {
    if (!grupo.alias_ids?.length) continue;

    const { error: plantiosError } = await supabase
      .from('plantios')
      .update({ talhao_id: grupo.canonical_id })
      .in('talhao_id', grupo.alias_ids);

    if (plantiosError) {
      return NextResponse.json({ error: plantiosError.message }, { status: 500 });
    }

    const { error: talhaoError } = await supabase
      .from('talhoes')
      .update({ ativo: false })
      .in('id', grupo.alias_ids);

    if (talhaoError) {
      return NextResponse.json({ error: talhaoError.message }, { status: 500 });
    }

    talhoes_consolidados += grupo.alias_ids.length;
  }

  return NextResponse.json({
    grupos: grupos.length,
    talhoes_consolidados,
    detalhes: grupos,
  });
}
