// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cobertura, coberturaMarkdown, lerManifesto, prepararFicheiro } from "./candidatas.mjs";

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

  it("respects word boundaries for ui/ue detection", () => {
    const c = cobertura(alvos, [
      // outdoor-unit.jpg should not match ue word boundary, soInterior should be false
      { grupoModelo: "hisense-air-master-unidade-exterior", marca: "hisense", ficheiro: "outdoor-unit.jpg", fonte: "pdf" },
    ]);
    const ueOutdoor = c.porGrupo.find((g) => g.grupoModelo === "hisense-air-master-unidade-exterior");
    expect(ueOutdoor).toMatchObject({ pdf: 1, soInterior: false });

    // 01-ui.png should match ui word boundary, soInterior should be true
    const c2 = cobertura(alvos, [
      { grupoModelo: "hisense-air-master-unidade-exterior", marca: "hisense", ficheiro: "01-ui.png", fonte: "pdf" },
    ]);
    const ueUi = c2.porGrupo.find((g) => g.grupoModelo === "hisense-air-master-unidade-exterior");
    expect(ueUi).toMatchObject({ pdf: 1, soInterior: true });

    // queue.jpg should not match ue, ui-front.jpg matches ui, soInterior should be true
    const c3 = cobertura(alvos, [
      { grupoModelo: "hisense-air-master-unidade-exterior", marca: "hisense", ficheiro: "ui-front.jpg", fonte: "pdf" },
      { grupoModelo: "hisense-air-master-unidade-exterior", marca: "hisense", ficheiro: "queue.jpg", fonte: "pdf" },
    ]);
    const ueMultiple = c3.porGrupo.find((g) => g.grupoModelo === "hisense-air-master-unidade-exterior");
    expect(ueMultiple).toMatchObject({ pdf: 2, soInterior: true });
  });
});

describe("prepararFicheiro", () => {
  it("resizes to 1600 px max, keeps alpha as PNG, hashes the output", async () => {
    const grande = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const r = await prepararFicheiro(grande);
    expect([r.largura, r.altura]).toEqual([1600, 800]);
    expect(r.contentType).toBe("image/jpeg");
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    const alfa = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    expect((await prepararFicheiro(alfa)).contentType).toBe("image/png");
  });
});
