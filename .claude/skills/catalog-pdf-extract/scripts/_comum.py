"""Helpers shared by the extraction toolkit (mapa → extrair → agrupar →
validar → enviar). No PyMuPDF here: this module is pure text handling."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

# --- Refs ---------------------------------------------------------------------

# A product reference: uppercase start, at least one digit, only the characters
# brand tables print inside a ref (lowercase too after the first two: Midea
# "MVi-252WV2RN1(B)", "MDV-V80WHN8(At)"). Combined refs ("A / B") are split before.
REF_RX = re.compile(r"^\d?[A-Z][A-Z0-9][A-Za-z0-9\-/.#()*]{2,}$")
EAN_RX = re.compile(r"^\d{13}$")
PRECO_RX = re.compile(r"^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?\s*€?$")
DIMENSOES_RX = re.compile(r"^\(?\d+(?:\+\d+)?\)?\s*[x×]\s*\(?\d+(?:\+\d+)?\)?\s*[x×]\s*\(?\d+(?:\+\d+)?\)?$")
TUBAGEM_RX = re.compile(r"^\(?\d(?:-\d)?/\d+\)?[”\"'’]*$")
TENSAO_RX = re.compile(r"^\d{3}V?-\d{3}V/\d{2,3}Hz$")
CLASSE_RX = re.compile(r"^(A\+{0,3}|[B-G])$")
REFRIGERANTE_RX = re.compile(r"^R-?(32|290|410A|407C|134A|454B|454C|1234ZE)$", re.I)
BTU_RX = re.compile(r"^\d{1,3}k$")
NUMERO_PT_RX = re.compile(r"^\d+(?:,\d+)?$")
INTERVALO_RX = re.compile(r"^\(?(\d+(?:,\d+)?)\s*-\s*(\d+(?:,\d+)?)\)?$")
MULTI_RX = re.compile(r"^(\d)[x×]1$")
SEM_DIGITOS_RX = re.compile(r"^[A-Z]{1,4}(?:-[A-Z]{1,4}){1,3}$")

COMPONENTE_TOKENS = {"UI", "UE", "INTERIOR", "EXTERIOR", "SPLIT", "INTEGRA"}


def e_ref(token: str) -> bool:
    """True when the token looks like a product reference."""
    t = token.strip()
    if not REF_RX.match(t):
        return False
    if not re.search(r"\d", t):
        # Panels and kits ("PE-QEA-LD", "HP-CB-NA"): short hyphenated codes.
        return bool(SEM_DIGITOS_RX.match(t))
    if EAN_RX.match(t) or PRECO_RX.match(t) or DIMENSOES_RX.match(t):
        return False
    if TUBAGEM_RX.match(t) or TENSAO_RX.match(t) or REFRIGERANTE_RX.match(t):
        return False
    if BTU_RX.match(t) or MULTI_RX.match(t) or CLASSE_RX.match(t):
        return False
    return True


def esqueleto(ref: str) -> str:
    """Series skeleton: digit runs → '#'. AUC105UR4RKC8 → AUC#UR#RKC#."""
    return re.sub(r"\d+", "#", ref.upper())


def prefixo_serie(ref: str) -> str:
    """Letters before the first digit (leading digits dropped): the series
    family of a ref. A ref without digits is its own family."""
    r = re.sub(r"^[\d×x]+", "", ref.upper())
    if not re.search(r"\d", r):
        return r
    m = re.match(r"[A-Z]+", r)
    return m.group(0) if m else r


# --- Numbers and prices -------------------------------------------------------

def parse_preco(texto: str) -> int | None:
    """'1.450 €' / '1455€' / '2.745,50 €' → integer cents; None otherwise."""
    m = PRECO_RX.match(texto.strip())
    if not m or "€" not in texto:
        return None
    inteiro = int(m.group(1).replace(".", ""))
    cent = int(m.group(2)) if m.group(2) else 0
    return inteiro * 100 + cent


def parse_numero_pt(texto: str) -> str | None:
    """'2,6' → '2.6', '80' → '80'; None when not a number."""
    t = texto.strip()
    if not NUMERO_PT_RX.match(t):
        return None
    return t.replace(",", ".")


# --- Slugs and group ids ------------------------------------------------------

def slug(texto: str) -> str:
    """Same rule as `slugGama` in convex/lib/stagedSku.ts."""
    sem_acentos = "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )
    s = re.sub(r"[^a-z0-9]+", "-", sem_acentos.lower())
    return s.strip("-")


def grupo_modelo(marca: str, gama: str | None, componente: str, ref: str | None = None) -> str:
    """Port of `grupoModeloDeterministico`: {marca}-{gama-slug}[-{componente}]."""
    serie = slug(gama or "") or slug(ref or "")
    if not serie:
        raise ValueError(f"grupoModelo: SKU sem gama nem ref utilizável (marca {marca}).")
    base = f"{slug(marca)}-{serie}"
    return base if componente == "conjunto" else f"{base}-{componente}"


# --- JSON and registry --------------------------------------------------------

def ler_json(caminho: Path | str) -> Any:
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def escrever_json(caminho: Path | str, dados: Any) -> None:
    Path(caminho).write_text(
        json.dumps(dados, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def raiz_repo(inicio: Path | str = ".") -> Path:
    p = Path(inicio).resolve()
    for cand in [p, *p.parents]:
        if (cand / "package.json").is_file() and (cand / "convex").is_dir():
            return cand
    return p


def carregar_registo(caminho: Path | str | None = None) -> dict:
    """spec-registry.json as written by `pnpm registry:json`."""
    if caminho is None:
        caminho = raiz_repo() / "product-scaffold" / "spec-registry.json"
    caminho = Path(caminho)
    if not caminho.is_file():
        raise FileNotFoundError(
            f"{caminho} não existe — corre `pnpm registry:json` na raiz do repo."
        )
    return ler_json(caminho)


def atributos_para_dict(atributos: list[dict]) -> dict[str, str]:
    return {a["chave"]: a["valor"] for a in atributos}


def dict_para_atributos(d: dict[str, str]) -> list[dict]:
    return [{"chave": k, "valor": v} for k, v in d.items() if v not in (None, "")]
