import { describe, it, expect } from "vitest";
import { calcularTabela, type Componente, type VersaoCalculo } from "./tabela-engine";
import { cubagemDeVolumes, pesoTaxavel } from "./calc-kernel";

const comp = (c: Partial<Componente> & { codigo: string; tipo: string }): Componente => ({
  nome: c.codigo,
  ativo: true,
  ordem: 10,
  config: {},
  ...c,
} as Componente);

const versao = (componentes: Componente[]): VersaoCalculo => ({ componentes });

const cubagem300 = comp({ codigo: "cubagem", tipo: "cubagem", config: { fator: 300, regra: "maior" } });
const fretePorKg = (valor: number) =>
  comp({ codigo: "frete_base", tipo: "frete_base", nome: "Frete base", config: { modo: "por_kg", valor } });
const minimoFixo = (valor: number) =>
  comp({ codigo: "frete_minimo", tipo: "frete_minimo", nome: "Frete mínimo", config: { modo: "fixo", valor } });

describe("cubagem a partir das dimensões", () => {
  it("soma grupos de volumes em m³", () => {
    const { cubagem, volumes } = cubagemDeVolumes([{ qtd: 3, comprimento: 1.2, largura: 0.8, altura: 0.6 }]);
    expect(cubagem).toBe(1.728);
    expect(volumes).toBe(3);
  });

  it("aceita centímetros e soma tipos diferentes de volume", () => {
    const { cubagem, volumes } = cubagemDeVolumes([
      { qtd: 2, comprimento: 100, largura: 50, altura: 50, unidade: "cm" },
      { qtd: 1, comprimento: 1, largura: 1, altura: 1 },
    ]);
    expect(cubagem).toBe(1.5);
    expect(volumes).toBe(3);
  });

  it("peso taxado é o maior entre real e cubado", () => {
    expect(pesoTaxavel(100, 1, 300).peso_taxado).toBe(300);
    expect(pesoTaxavel(500, 1, 300).peso_taxado).toBe(500);
    expect(pesoTaxavel(500, 1, 300, "cubado").peso_taxado).toBe(300);
  });

  it("a cotação calcula a cubagem pelas dimensões, sem pedir m³", () => {
    const res = calcularTabela(versao([cubagem300, fretePorKg(1)]), {
      peso: 100,
      qtd_volumes: 0,
      valor_mercadoria: 0,
      volumes_dim: [{ qtd: 1, comprimento: 1, largura: 1, altura: 1 }],
    });
    expect(res.cubagem).toBe(1);
    expect(res.peso_cubado).toBe(300);
    expect(res.peso_taxado).toBe(300);
    expect(res.total).toBe(300);
  });
});

describe("frete mínimo como piso real", () => {
  const v = versao([cubagem300, fretePorKg(0.8), minimoFixo(150)]);

  it("aplica o piso quando o calculado é menor", () => {
    const res = calcularTabela(v, { peso: 100, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0 });
    expect(res.frete_calculado).toBe(80);
    expect(res.frete_minimo).toBe(150);
    expect(res.frete_aplicado).toBe(150);
    expect(res.total).toBe(150);
    expect(res.minimo_motivo).toContain("menor que o mínimo");
  });

  it("não interfere quando o calculado é maior", () => {
    const res = calcularTabela(v, { peso: 500, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0 });
    expect(res.frete_calculado).toBe(400);
    expect(res.frete_aplicado).toBe(400);
    expect(res.minimo_aplicado).toBeNull();
    expect(res.total).toBe(400);
  });

  it("suporta mínimo por kg", () => {
    const res = calcularTabela(
      versao([cubagem300, fretePorKg(0.5), comp({ codigo: "frete_minimo", tipo: "frete_minimo", nome: "Mínimo", config: { modo: "por_kg", valor: 1.5 } })]),
      { peso: 100, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0 },
    );
    expect(res.frete_minimo).toBe(150);
    expect(res.total).toBe(150);
  });

  it("suporta mínimo por faixa de peso", () => {
    const min = comp({
      codigo: "frete_minimo",
      tipo: "frete_minimo",
      nome: "Mínimo por faixa",
      config: { modo: "faixa" },
      faixas: [
        { peso_min: 0, peso_max: 100, tipo_valor: "fixo", valor: 50, valor_minimo: 0 },
        { peso_min: 100, peso_max: 500, tipo_valor: "fixo", valor: 180, valor_minimo: 0 },
      ],
    });
    const res = calcularTabela(versao([cubagem300, fretePorKg(0.2), min]), {
      peso: 250, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0,
    });
    expect(res.frete_calculado).toBe(50);
    expect(res.total).toBe(180);
  });
});

describe("faixas, adicionais e transparência", () => {
  const faixa = comp({
    codigo: "faixa_peso",
    tipo: "faixa_peso",
    nome: "Faixas de peso",
    faixas: [
      { peso_min: 0, peso_max: 100, tipo_valor: "fixo", valor: 50, valor_minimo: 0 },
      { peso_min: 100, peso_max: 200, tipo_valor: "fixo", valor: 80, valor_minimo: 0 },
    ],
  });

  it("limite de faixa é exclusivo no topo", () => {
    const base = { cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0 };
    expect(calcularTabela(versao([cubagem300, faixa]), { ...base, peso: 99 }).total).toBe(50);
    expect(calcularTabela(versao([cubagem300, faixa]), { ...base, peso: 100 }).total).toBe(80);
    const fora = calcularTabela(versao([cubagem300, faixa]), { ...base, peso: 900 });
    expect(fora.total).toBe(0);
    expect(fora.avisos.join(" ")).toContain("nenhuma faixa");
  });

  it("GRIS e Ad Valorem são percentuais sobre a base configurada", () => {
    const res = calcularTabela(
      versao([
        cubagem300,
        fretePorKg(1),
        comp({ codigo: "gris", tipo: "gris", nome: "GRIS", config: { percentual: 1, base: "mercadoria" } }),
        comp({ codigo: "advalorem", tipo: "advalorem", nome: "Ad Valorem", config: { percentual: 0.5, base: "mercadoria" } }),
      ]),
      { peso: 250, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 10000 },
    );
    expect(res.frete_calculado).toBe(250);
    expect(res.linhas.find((l) => l.codigo === "gris")!.valor).toBe(100);
    expect(res.linhas.find((l) => l.codigo === "advalorem")!.valor).toBe(50);
    expect(res.total).toBe(400);
  });

  it("componente sem valor configurado avisa em vez de virar R$ 0,00", () => {
    const res = calcularTabela(
      versao([cubagem300, comp({ codigo: "taxa_coleta", tipo: "taxa_coleta", nome: "Taxa de coleta", config: { modo: "fixo" } })]),
      { peso: 10, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0 },
    );
    expect(res.linhas.length).toBe(0);
    expect(res.avisos.join(" ")).toContain("sem valor configurado");
  });

  it("combina frete, pedágio por eixo, taxas condicionais e desconto", () => {
    const res = calcularTabela(
      versao([
        cubagem300,
        fretePorKg(1),
        comp({ codigo: "pedagio", tipo: "pedagio", nome: "Pedágio", config: { modo: "por_eixo", valor: 10 } }),
        comp({ codigo: "taxa_area_risco", tipo: "taxa_area_risco", nome: "Área de risco", config: { modo: "fixo", valor: 30 } }),
        comp({ codigo: "taxa_reentrega", tipo: "taxa_reentrega", nome: "Reentrega", config: { modo: "fixo", valor: 40 } }),
      ]),
      { peso: 250, cubagem: 0, qtd_volumes: 1, valor_mercadoria: 0, eixos: 3, area_risco: true, desconto_percentual: 10 },
    );
    expect(res.linhas.find((l) => l.codigo === "pedagio")!.valor).toBe(30);
    expect(res.linhas.find((l) => l.codigo === "taxa_reentrega")).toBeUndefined();
    expect(res.subtotal).toBe(310);
    expect(res.desconto).toBe(31);
    expect(res.total).toBe(279);
  });
});
