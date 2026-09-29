// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cobertura, coberturaMarkdown, lerManifesto } from "./candidatas.mjs";

const alvos = {
  marca: "hisense",
  grupos: [
    { grupoModelo: "hisense-air-master", nomeGrupo: "Mural Air Master", refs: ["QK25WM0A", "QK25WM0B"],
      componente: "conjunto", cores: ["branco", "preto"], acessorio: false },
    { grupoModelo: "hisense-air-master-unidade-exterior", nomeGrupo: "Mural Air Master | UE", refs: ["AS25WM00W"],
      componente: "unidade-exterior", cores: [], acessorio: false },
    { grupoModelo: "hisense-yxe-c01u1-comando", nomeGrupo: "Comando", refs: ["YXE-C01U1"],
      componente: "comando", cores: [], acessorio: true },
  ],
};

describe("lerManifesto", () => {
  it("flattens the manifest and validates group and fonte", () => {
    const entradas = lerManifesto({
      "hisense-air-master": [{ ficheiro: "a.jpg", fonte: "site", origemUrl: "https://x", cor: "branco" }],
    }, alvos);
    expect(entradas).toEqual([{ grupoModelo: "hisense-air-master", marca: "hisense", ficheiro: "a.jpg",
      fonte: "site", origemUrl: "https://x", cor: "branco" }]);
    expect(() => lerManifesto({ "nao-existe": [] }, alvos)).toThrow(/nao-existe/);
    expect(() => lerManifesto({ "hisense-air-master": [{ ficheiro: "a", fonte: "bing" }] }, alvos)).toThrow(/fonte/);
  });
});

describe("cobertura", () => {
  it("counts by source, flags missing colours, indoor-only UE and equipment without site/megaclima", () => {
    const c = cobertura(alvos, [
      { grupoModelo: "hisense-air-master", marca: "hisense", ficheiro: "a.jpg", fonte: "site", cor: "branco" },
      { grupoModelo: "hisense-air-master-unidade-exterior", marca: "hisense", ficheiro: "ui-front.jpg", fonte: "pdf" },
    ]);
    const am = c.porGrupo.find((g) => g.grupoModelo === "hisense-air-master");
    expect(am).toMatchObject({ site: 1, pdf: 0, coresEmFalta: ["preto"] });
    const ue = c.porGrupo.find((g) => g.grupoModelo === "hisense-air-master-unidade-exterior");
    expect(ue).toMatchObject({ pdf: 1, soInterior: true });
    expect(c.semCandidatas).toEqual([]); // accessories without candidates are not listed
    expect(c.equipamentoSemSiteNemMegaclima).toEqual(["hisense-air-master-unidade-exterior"]);
    expect(coberturaMarkdown(c)).toContain("hisense-air-master-unidade-exterior");
  });
});
