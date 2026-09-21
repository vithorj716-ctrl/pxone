import { describe, it, expect } from "vitest";
import { parseDecimal, parseValorComTipo } from "./num";
import { calcularTabelaFrete, regrasLegado, escolherTabela, type RegraComercial } from "./regra-engine";
import { parseCSV, parseJSONTabela, sugerirMapeamento, montarImportacao } from "./tabela-import";

const ctx = {
  peso: 100, peso_taxado: 120, cubagem: 2, volumes: 4, valor_nota: 10000, distancia_km: 250,
};

const r = (p: Partial<RegraComercial>): RegraComercial => ({
  nome: "R", tipo: "taxa", modo: "valor_fixo", valor: 0, base_calculo: "nenhuma", ativo: true, ordem: 100, ...p,
});

describe("parser numérico", () => {
  it("interpreta decimais BR e internacionais igualmente", () => {
    expect(parseDecimal("0,05")).toBe(0.05);
    expect(parseDecimal("0.05")).toBe(0.05);
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("1,234.56")).toBe(1234.56);
    expect(parseDecimal("R$ 50,00")).toBe(50);
  });
  it("distingue ausência de zero", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("0")).toBe(0);
    expect(parseDecimal("0,00")).toBe(0);
  });
  it("não aceita NaN/Infinity", () => {
    expect(parseDecimal(NaN)).toBeNull();
    expect(parseDecimal(Infinity)).toBeNull();
  });
  it("detecta percentuais sem alterar a grandeza", () => {
    expect(parseValorComTipo("0,05%")).toEqual({ valor: 0.05, tipo: "percentual" });
    expect(parseValorComTipo("0,5%")).toEqual({ valor: 0.5, tipo: "percentual" });
    expect(parseValorComTipo("5%")).toEqual({ valor: 5, tipo: "percentual" });
    expect(parseValorComTipo("R$ 50,00")).toEqual({ valor: 50, tipo: "monetario" });
  });
});

describe("motor de cálculo", () => {
  it("valor fixo é aplicado puro, sem base automática", () => {
    const res = calcularTabelaFrete([r({ nome: "Taxa de coleta", modo: "valor_fixo", valor: 50 })], ctx);
    expect(res.total).toBe(50);
    expect(res.linhas[0]!.base).toBe(1);
  });

  it("percentual usa a base configurada — nota difere de frete", () => {
    const regras = [
      r({ nome: "Frete", tipo: "frete", modo: "por_kg", valor: 2, base_calculo: "peso_taxado", ordem: 10 }),
      r({ nome: "GRIS", tipo: "adicional", modo: "percentual", valor: 0.05, base_calculo: "valor_nota", ordem: 20 }),
      r({ nome: "Taxa frete", tipo: "adicional", modo: "percentual", valor: 10, base_calculo: "valor_frete", ordem: 30 }),
    ];
    const res = calcularTabelaFrete(regras, ctx);
    expect(res.linhas[0]!.valor).toBe(240);
    expect(res.linhas[1]!.valor).toBe(5); // 0,05% de 10.000
    expect(res.linhas[2]!.valor).toBe(24); // 10% de 240
    expect(res.total).toBe(269);
  });

  it("percentual sem base é ignorado com aviso", () => {
    const res = calcularTabelaFrete([r({ nome: "X", modo: "percentual", valor: 5, base_calculo: "nenhuma" })], ctx);
    expect(res.total).toBe(0);
    expect(res.avisos.length).toBe(1);
  });

  it("zero configurado é respeitado e ausência é ignorada", () => {
    expect(calcularTabelaFrete([r({ modo: "valor_fixo", valor: 0 })], ctx).linhas.length).toBe(1);
    expect(calcularTabelaFrete([r({ modo: "valor_fixo", valor: null })], ctx).linhas.length).toBe(0);
  });

  it("calcula por kg, m³, km e volume", () => {
    expect(calcularTabelaFrete([r({ modo: "por_kg", valor: 2, base_calculo: "peso_taxado" })], ctx).total).toBe(240);
    expect(calcularTabelaFrete([r({ modo: "por_kg", valor: 2, base_calculo: "peso" })], ctx).total).toBe(200);
    expect(calcularTabelaFrete([r({ modo: "por_m3", valor: 100 })], ctx).total).toBe(200);
    expect(calcularTabelaFrete([r({ modo: "por_km", valor: 0.5 })], ctx).total).toBe(125);
    expect(calcularTabelaFrete([r({ modo: "por_volume", valor: 3 })], ctx).total).toBe(12);
  });

  it("aplica faixas pela configuração", () => {
    const regra = r({
      nome: "Frete faixa", tipo: "frete", modo: "faixa", faixa_campo: "peso_taxado",
      config: { faixas: [
        { min: 0, max: 100, modo: "valor_fixo", valor: 50 },
        { min: 100, max: 200, modo: "valor_fixo", valor: 60 },
      ] },
    });
    expect(calcularTabelaFrete([regra], ctx).total).toBe(60);
    expect(calcularTabelaFrete([regra], { ...ctx, peso_taxado: 10 }).total).toBe(50);
  });

  it("frete mínimo é piso, não componente", () => {
    const regras = [
      r({ nome: "Frete", tipo: "frete", modo: "por_kg", valor: 0.1, base_calculo: "peso_taxado", ordem: 10 }),
      r({ nome: "Mínimo", tipo: "minimo", modo: "minimo", valor: 80, ordem: 900 }),
    ];
    const res = calcularTabelaFrete(regras, ctx);
    expect(res.subtotal).toBe(12);
    expect(res.total).toBe(80);
    expect(res.minimo_aplicado).toBe(80);
    expect(res.linhas.length).toBe(1);
  });

  it("respeita piso e teto da própria regra", () => {
    expect(calcularTabelaFrete([r({ modo: "percentual", valor: 0.01, base_calculo: "valor_nota", valor_minimo: 30 })], ctx).total).toBe(30);
    expect(calcularTabelaFrete([r({ modo: "percentual", valor: 10, base_calculo: "valor_nota", valor_maximo: 200 })], ctx).total).toBe(200);
  });

  it("filtra regra por faixa de aplicação e por rota", () => {
    const porFaixa = r({ modo: "valor_fixo", valor: 30, faixa_campo: "peso_taxado", faixa_min: 500 });
    expect(calcularTabelaFrete([porFaixa], ctx).total).toBe(0);
    const porRota = r({ modo: "valor_fixo", valor: 30, rota_id: "rota-a" });
    expect(calcularTabelaFrete([porRota], { ...ctx, rota_id: "rota-b" }).total).toBe(0);
    expect(calcularTabelaFrete([porRota], { ...ctx, rota_id: "rota-a" }).total).toBe(30);
  });

  it("combina múltiplas regras com serviço e desconto, detalhando componentes", () => {
    const regras = [
      r({ nome: "Frete base", tipo: "frete", modo: "por_kg", valor: 2, base_calculo: "peso_taxado", ordem: 10 }),
      r({ nome: "Serviço urgente", tipo: "servico", modo: "valor_fixo", valor: 40, servico_id: "s1", ordem: 20 }),
      r({ nome: "Desconto comercial", tipo: "desconto", modo: "percentual", valor: 10, base_calculo: "subtotal", ordem: 800 }),
    ];
    const res = calcularTabelaFrete(regras, ctx);
    expect(res.linhas.map((l) => l.nome)).toEqual(["Frete base", "Serviço urgente", "Desconto comercial"]);
    expect(res.linhas[2]!.valor).toBe(-28);
    expect(res.total).toBe(252);
    expect(res.frete_base).toBe(240);
  });

  it("nome da regra não influencia a fórmula", () => {
    const a = calcularTabelaFrete([r({ nome: "GRIS", modo: "valor_fixo", valor: 50 })], ctx).total;
    const b = calcularTabelaFrete([r({ nome: "Qualquer coisa", modo: "valor_fixo", valor: 50 })], ctx).total;
    expect(a).toBe(b);
  });

  it("converte a tabela legada em regras equivalentes", () => {
    const legado = { tipo_cobranca: "peso", valor_kg: 2, valor_m3: 0, valor_coleta: 10, valor_entrega: 0, valor_minimo: 100 };
    const regras = regrasLegado(legado);
    const res = calcularTabelaFrete(regras, ctx);
    expect(res.subtotal).toBe(250);
    expect(res.total).toBe(250);
    expect(calcularTabelaFrete(regras, { ...ctx, peso_taxado: 1 }).total).toBe(100);
  });

  it("escolhe a tabela mais específica", () => {
    const tabelas = [
      { id: "geral", ativo: true },
      { id: "cliente", ativo: true, cliente_id: "c1" },
      { id: "cliente-rota", ativo: true, cliente_id: "c1", origem: "Goiânia", destino: "Brasília" },
    ];
    expect(escolherTabela(tabelas, { cliente_id: "c1", origem: "Goiânia", destino: "Brasília" })!.id).toBe("cliente-rota");
    expect(escolherTabela(tabelas, { cliente_id: "c1", origem: "Anápolis", destino: "Rio" })!.id).toBe("cliente");
    expect(escolherTabela(tabelas, {})!.id).toBe("geral");
  });
});

describe("importação", () => {
  const csv = `Origem;Destino;Faixa Inicial;Faixa Final;Frete;GRIS;Taxa Coleta;Mínimo
Goiânia;Brasília;0;10;50;0,05%;R$ 20,00;80
Goiânia;Brasília;10;20;60;0,05%;R$ 20,00;80`;

  it("lê CSV e sugere mapeamento coerente", () => {
    const arq = parseCSV(csv);
    expect(arq.linhas.length).toBe(2);
    const mapa = sugerirMapeamento(arq.colunas);
    expect(mapa.find((m) => m.coluna === "Origem")!.destino).toBe("origem");
    expect(mapa.find((m) => m.coluna === "GRIS")!.modo).toBe("percentual");
    expect(mapa.find((m) => m.coluna === "Faixa Inicial")!.destino).toBe("faixa_min");
  });

  it("monta tabelas e regras com faixas, sem inventar unidade", () => {
    const arq = parseCSV(csv);
    const mapa = sugerirMapeamento(arq.colunas);
    const res = montarImportacao(arq, mapa);
    expect(res.problemas.filter((p) => p.nivel === "erro").length).toBe(0);
    expect(res.tabelas.length).toBe(1);
    const gris = res.tabelas[0]!.regras.find((x) => x.nome === "GRIS")!;
    expect(gris.valor).toBe(0.05);
    expect(gris.base_calculo).toBe("valor_nota");
    const frete = res.tabelas[0]!.regras.find((x) => x.nome === "Frete" && x.faixa_min === 0)!;
    expect(frete.faixa_max).toBe(10);
  });

  it("bloqueia percentual mapeado como valor fixo e valores inválidos", () => {
    const arq = parseJSONTabela(JSON.stringify([{ Taxa: "0,05%" }, { Taxa: "abc" }, { Taxa: "0" }]));
    const res = montarImportacao(arq, [
      { coluna: "Taxa", destino: "regra", nome: "Taxa", tipo: "taxa", modo: "valor_fixo", base_calculo: "nenhuma" },
    ]);
    expect(res.problemas.length).toBe(2);
    expect(res.totalRegras).toBe(1); // o zero é válido
  });
});
