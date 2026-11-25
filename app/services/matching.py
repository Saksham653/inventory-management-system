"""Match product text from a supplier bill to the shop's products.

Scoring mixes three signals so abbreviations and typos still land:
  - how many of the product's name tokens appear on the bill line (exact, prefix or near-spelling)
  - how much of the bill line is explained by the product
  - overall string similarity
A different model number (iPhone 14 vs 15) is penalised hard. Confirmed matches are
remembered as aliases, which win outright next time.
"""
import re
from difflib import SequenceMatcher

MATCHED = 0.80   # confident: pre-select the product
CHECK = 0.55     # plausible: pre-select but ask the manager to check

NOISE = {"pcs", "pc", "nos", "no", "qty", "unit", "units", "box", "set", "the", "and", "with", "for", "new"}


def normalise(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])", " ", text)  # "iphone15" -> "iphone 15", "7in1" -> "7 in 1"
    text = re.sub(r"\b(\d+)\s+(gb|tb|mb|w|mah|ml|kg|g|l)\b", r"\1\2", text)  # but keep "128gb" together
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str) -> list[str]:
    return [t for t in normalise(text).split() if t not in NOISE]


def _token_match(a: str, b: str) -> bool:
    if a == b:
        return True
    if a.isdigit() or b.isdigit():
        return False  # numbers must match exactly
    if len(a) >= 3 and len(b) >= 3 and (a.startswith(b) or b.startswith(a)):
        return True  # "adptr" vs "adapter" is handled below; "galax" vs "galaxy" here
    return len(a) >= 4 and len(b) >= 4 and SequenceMatcher(None, a, b).ratio() >= 0.75


def score(raw: str, name: str, sku: str | None = None) -> float:
    raw_n, name_n = normalise(raw), normalise(name)
    if not raw_n or not name_n:
        return 0.0
    sku_n = normalise(sku) if sku else ""
    if sku_n and f" {sku_n} " in f" {raw_n} ":
        return 0.97
    rt, pt = tokens(raw), tokens(name)
    if not rt or not pt:
        return SequenceMatcher(None, raw_n, name_n).ratio()
    matched_p = sum(1 for p in pt if any(_token_match(p, r) for r in rt))
    matched_r = sum(1 for r in rt if any(_token_match(r, p) for p in pt))
    coverage = matched_p / len(pt)
    explained = matched_r / len(rt)
    seq = SequenceMatcher(None, raw_n, name_n).ratio()
    s = 0.55 * coverage + 0.25 * explained + 0.20 * seq
    # A model number on both sides that disagrees (iPhone 14 vs iPhone 15) is a different product.
    raw_nums = {t for t in rt if t.isdigit()}
    name_nums = {t for t in pt if t.isdigit()}
    if raw_nums and name_nums and not (raw_nums & name_nums):
        s *= 0.5
    return round(min(s, 1.0), 3)


def query_coverage(query: str, name: str, sku: str | None = None) -> float:
    """Share of the typed words found in this product's name or SKU. "iPhones" fully covers "iPhone 15 Pro"."""
    qt = tokens(query)
    pt = tokens(name) + tokens(sku or "")
    if not qt or not pt:
        return 0.0
    return sum(1 for q in qt if any(_token_match(q, p) for p in pt)) / len(qt)


def rank(raw: str, products: list, aliases: dict[str, int] | None = None, limit: int = 3) -> list[dict]:
    """Best product candidates for one bill line: [{product_id, name, score, via}]."""
    key = normalise(raw)
    out = []
    alias_pid = (aliases or {}).get(key)
    if alias_pid:
        p = next((p for p in products if p.id == alias_pid), None)
        if p:
            out.append({"product_id": p.id, "name": p.name, "score": 1.0, "via": "remembered"})
    scored = sorted(((score(raw, p.name, p.sku), p) for p in products if p.id != alias_pid), key=lambda x: -x[0])
    for s, p in scored[: limit - len(out)]:
        if s > 0.2:
            out.append({"product_id": p.id, "name": p.name, "score": s, "via": "name"})
    return out


def best_supplier(raw_name: str | None, suppliers: list):
    if not raw_name:
        return None, 0.0
    best, best_s = None, 0.0
    for s in suppliers:
        sc = score(raw_name, s.name)
        if query_coverage(raw_name, s.name) == 1.0:
            sc = max(sc, 0.8)  # "apple" fully names "Apple Pvt Ltd"
        if sc > best_s:
            best, best_s = s, sc
    return (best, best_s) if best_s >= CHECK else (None, best_s)


def suggest_sku(name: str, taken: set[str]) -> str:
    words = tokens(name) or ["item"]
    head = words[0][:3].upper()
    tail = "".join(w[:4].upper() if w.isdigit() or any(c.isdigit() for c in w) else w[0].upper() for w in words[1:4])
    base = f"{head}-{tail}" if tail else head
    sku, n = base, 2
    while sku in taken:
        sku, n = f"{base}-{n}", n + 1
    return sku
