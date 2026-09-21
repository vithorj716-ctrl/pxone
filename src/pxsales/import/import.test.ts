// PXSales — testes da importação em massa de clientes (rodar com: bunx bun test src/pxsales/import)
import { describe, expect, test } from "bun:test";
import {
  chaveNome, chaveTag, classificarTemperatura, ehCelular, extrairCargo, extrairCep, extrairCidadeUf,
  extrairCnpjs, extrairConcorrente, extrairCpf, extrairDataMaisRecente, extrairEmails, extrairFrequencia,
  extrairInscricaoEstadual, extrairLogradouro, extrairNomeContato, extrairPrazoPagamento, extrairRotas,
  extrairSegmento, extrairTelefones, extrairTipoCarga, extrairValor, extrairVolumeMensal, hashTexto, titulo,
} from "./text-extract";
import { normalizarRegistro } from "./normalize";
import { consolidar } from "./consolidate";
import type { RegistroXml } from "./types";

function reg(campos: Record<string, string[]>, texto: string, id = "1", mensagens: string[] = []): RegistroXml {
  return { xmlId: id, campos, texto, mensagens, totalMensagens: mensagens.length };
}

describe("extração de texto livre", () => {
  test("1. encontra CNPJ formatado", () => {
    expect(extrairCnpjs("empresa 11.222.333/0001-81 aqui")).toEqual(["11222333000181"]);
  });
  test("2. encontra CNPJ sem formatação", () => {
    expect(extrairCnpjs("cnpj 11222333000181")).toEqual(["11222333000181"]);
  });
  test("3. descarta CNPJ com dígito verificador errado", () => {
    expect(extrairCnpjs("11.222.333/0001-99")).toEqual([]);
  });
  test("4. encontra vários CNPJs sem repetir", () => {
    const r = extrairCnpjs("matriz 11.222.333/0001-81 filial 11.222.333/0002-62 matriz 11222333000181");
    expect(r.length).toBe(2);
  });
  test("5. extrai CPF", () => {
    expect(extrairCpf("cpf 123.456.789-09")).toBe("12345678909");
  });
  test("6. extrai inscrição estadual", () => {
    expect(extrairInscricaoEstadual("IE: 123.456.789.110")).toBe("123.456.789.110");
  });
  test("7. extrai CEP", () => {
    expect(extrairCep("cep 01310-100 av paulista")).toBe("01310100");
  });
  test("8. extrai celular com DDD", () => {
    expect(extrairTelefones("whats (11) 98765-4321")).toContain("11987654321");
  });
  test("9. extrai fixo e remove +55", () => {
    expect(extrairTelefones("+55 11 3456-7890")).toContain("1134567890");
  });
  test("10. ignora sequências repetidas", () => {
    expect(extrairTelefones("00 0000-0000")).toEqual([]);
  });
  test("11. reconhece celular", () => {
    expect(ehCelular("11987654321")).toBe(true);
    expect(ehCelular("1134567890")).toBe(false);
  });
  test("12. extrai e-mails em minúsculo", () => {
    expect(extrairEmails("Contato: Compras@Empresa.COM.br,")).toEqual(["compras@empresa.com.br"]);
  });
  test("13. extrai cidade e UF", () => {
    expect(extrairCidadeUf("entrega em Ribeirão Preto/SP")).toEqual({ cidade: "Ribeirão Preto", uf: "SP" });
  });
  test("14. extrai logradouro, número e bairro", () => {
    const e = extrairLogradouro("Rua das Palmeiras, 450 - Centro");
    expect(e.numero).toBe("450");
    expect(e.logradouro).toContain("Rua");
  });
  test("15. extrai valor em reais", () => {
    expect(extrairValor("fatura de R$ 12.500,00 por mês")).toBe(12500);
  });
  test("16. entende valores em mil", () => {
    expect(extrairValor("uns 15 mil por mês")).toBe(15000);
  });
  test("17. extrai prazo de pagamento", () => {
    expect(extrairPrazoPagamento("paga em 28 dias")).toBe(28);
  });
  test("18. entende pagamento à vista", () => {
    expect(extrairPrazoPagamento("pagamento à vista")).toBe(0);
  });
  test("19. classifica frequência", () => {
    expect(extrairFrequencia("coleta semanal")).toBe("Semanal");
  });
  test("20. classifica tipo de carga", () => {
    expect(extrairTipoCarga("carga refrigerada")).toBe("Refrigerada");
  });
  test("21. classifica segmento", () => {
    expect(extrairSegmento("distribuidora de medicamentos")).toBe("Saúde e farma");
  });
  test("22. extrai rotas entre UFs", () => {
    expect(extrairRotas("rodam SP x RJ toda semana")).toContain("SP → RJ");
  });
  test("23. identifica concorrente atual", () => {
    expect(extrairConcorrente("hoje usa Jamef para entregas")).toContain("Jamef");
  });
  test("24. extrai volume mensal", () => {
    expect(extrairVolumeMensal("cerca de 3.000 kg por mês")).toContain("kg");
  });
  test("25. temperatura quente e fria", () => {
    expect(classificarTemperatura("cliente quer fechar agora")).toBe("quente");
    expect(classificarTemperatura("sem interesse no momento")).toBe("frio");
  });
  test("26. pega a data mais recente", () => {
    expect(extrairDataMaisRecente("visita 10/01/2024 e retorno 05/03/2025")).toBe("2025-03-05");
  });
  test("27. extrai nome do contato", () => {
    expect(extrairNomeContato("falei com Maria Silva na recepção")).toBe("Maria Silva");
  });
  test("28. extrai cargo", () => {
    expect(extrairCargo("conversei com o gerente de logística")).toBe("Gerente");
  });
  test("29. normaliza tag e título", () => {
    expect(chaveTag("Razão Social")).toBe("razao_social");
    expect(titulo("TRANSPORTES SAO PAULO")).toBe("Transportes Sao Paulo");
  });
  test("30. hash é estável e chave de nome ignora sufixos", () => {
    expect(hashTexto("abc")).toBe(hashTexto("abc"));
    expect(chaveNome("Alfa Transportes LTDA")).toBe(chaveNome("ALFA LTDA ME"));
  });
});

describe("normalização de registro", () => {
  test("31. monta cliente completo a partir de campos e texto", () => {
    const r = normalizarRegistro(
      reg(
        { empresa: ["Alfa Distribuidora LTDA"], cnpj: ["11.222.333/0001-81"], cidade: ["Campinas"], uf: ["SP"] },
        "Visita em 12/05/2025. Falei com João Souza, comprador. Tel (19) 99888-7766, email compras@alfa.com.br. Carga paletizada, coleta semanal, paga em 30 dias. Hoje usa Braspress.",
      ),
    );
    expect(r.cnpj).toBe("11222333000181");
    expect(r.endereco?.cidade).toBe("Campinas");
    expect(r.telefones[0]).toBe("19998887766");
    expect(r.emails[0]).toBe("compras@alfa.com.br");
    expect(r.prazoPagamento).toBe(30);
    expect(r.tipoCarga).toBe("Paletizada");
    expect(r.contatos[0]?.is_principal).toBe(true);
    expect(r.acaoSugerida).toBe("criar");
    expect(r.score).toBeGreaterThan(70);
  });

  test("32. registro sem CNPJ vira lead", () => {
    const r = normalizarRegistro(reg({ empresa: ["Beta Comercio"] }, "contato 11 98888-1111"));
    expect(r.cnpj).toBeNull();
    expect(r.acaoSugerida).toBe("lead");
  });

  test("33. registro vazio vai para revisão", () => {
    const r = normalizarRegistro(reg({}, "visita sem dados"));
    expect(r.acaoSugerida).toBe("revisao");
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  test("34. guarda CNPJs adicionais como filiais", () => {
    const r = normalizarRegistro(reg({ empresa: ["Gama"] }, "matriz 11.222.333/0001-81 filial 11.222.333/0002-62"));
    expect(r.cnpjsAdicionais).toEqual(["11222333000262"]);
  });

  test("35. campos desconhecidos do XML são preservados em extras", () => {
    const r = normalizarRegistro(reg({ codigo_interno: ["A-99"], empresa: ["Delta"] }, "Delta"));
    expect(r.extras["codigo_interno"]).toEqual(["A-99"]);
  });

  test("36. mensagens da conversa entram nas observações", () => {
    const r = normalizarRegistro(reg({ empresa: ["Eps"] }, "Eps", "7", ["bom dia", "precisamos de cotação"]));
    expect(r.observacoes).toContain("cotação");
    expect(r.totalMensagens).toBe(2);
  });
});

describe("consolidação do arquivo", () => {
  const base = (id: string, campos: Record<string, string[]>, texto: string) =>
    normalizarRegistro(reg(campos, texto, id));

  test("37. junta visitas da mesma empresa pelo CNPJ", () => {
    const out = consolidar([
      base("1", { empresa: ["Alfa"], cnpj: ["11.222.333/0001-81"] }, "primeira visita 01/02/2025 tel 19 99888-7766"),
      base("2", { empresa: ["Alfa LTDA"], cnpj: ["11222333000181"] }, "segunda visita 05/03/2025 email a@alfa.com"),
    ]);
    expect(out.length).toBe(1);
    expect(out[0]?.xmlIds.length).toBe(2);
    expect(out[0]?.ultimaVisita).toBe("2025-03-05");
    expect(out[0]?.emails).toContain("a@alfa.com");
  });

  test("38. junta pelo telefone quando não há CNPJ", () => {
    const out = consolidar([
      base("1", { empresa: ["Beta"] }, "tel (11) 98888-1111"),
      base("2", { empresa: ["Beta Comercial"] }, "tel (11) 98888-1111 email b@beta.com"),
    ]);
    expect(out.length).toBe(1);
  });

  test("39. mantém empresas diferentes separadas", () => {
    const out = consolidar([
      base("1", { empresa: ["Alfa"], cnpj: ["11.222.333/0001-81"] }, "tel 11 98888-1111"),
      base("2", { empresa: ["Zeta"], cnpj: ["11.444.777/0001-61"] }, "tel 11 97777-2222"),
    ]);
    expect(out.length).toBe(2);
  });

  test("40. soma visitas e avisa sobre a consolidação", () => {
    const out = consolidar([
      base("1", { empresa: ["Alfa"], cnpj: ["11.222.333/0001-81"] }, "visita"),
      base("2", { empresa: ["Alfa"], cnpj: ["11.222.333/0001-81"] }, "visita"),
    ]);
    expect(out[0]?.avisos.join(" ")).toContain("consolidadas");
  });
});
