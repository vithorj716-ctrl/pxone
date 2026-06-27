// PX AI Core — wrapper único do Lovable AI Gateway para a plataforma.
// Helper opt-in: módulos atuais continuam usando seus próprios callGateway
// até serem migrados; novos módulos devem importar callPxAI daqui.

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function callPxAI(opts: {
  messages: Msg[];
  modulo: string;
  modo?: "rapido" | "analitico";
  modelOverride?: string;
  empresa?: { id: string; nome: string } | null;
  permitirComparativoEntreEmpresas?: boolean;
}): Promise<{ content: string; modelo: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const modelo =
    opts.modelOverride ??
    (opts.modo === "analitico" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-lite");

  // Injeta contexto de empresa ativa como mensagem de sistema adicional (opt-in)
  const ctxMsgs: Msg[] = [];
  if (opts.empresa) {
    ctxMsgs.push({
      role: "system",
      content: `Contexto: usuário está trabalhando na empresa "${opts.empresa.nome}" (id ${opts.empresa.id}). Considere APENAS dados desta empresa nas análises, salvo autorização explícita.`,
    });
  } else if (opts.permitirComparativoEntreEmpresas) {
    ctxMsgs.push({
      role: "system",
      content: "Contexto: modo Grupo (Visão Consolidada). É permitido comparar empresas do grupo.",
    });
  }
  const messages = [...ctxMsgs, ...opts.messages];

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelo, messages }),
  });
  if (r.status === 429) throw new Error("Limite de IA atingido");
  if (r.status === 402) throw new Error("Créditos de IA esgotados");
  if (!r.ok) throw new Error(`Falha IA ${r.status}`);
  const j: any = await r.json();
  return { content: j?.choices?.[0]?.message?.content ?? "", modelo };
}
