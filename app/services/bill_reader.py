"""Read a supplier bill photo into structured lines with a vision model.

Providers:
  anthropic  Claude via the official SDK, with structured outputs (schema-valid JSON).
  groq       Groq's OpenAI-compatible chat API with JSON mode.
  demo       A fixed sample reading, for local UI testing only.

Returns a normalised dict:
  {supplier_name, bill_number, bill_date, subtotal, tax, total, readable, notes,
   lines: [{description, quantity, unit_price, amount}], reader}
"""
import base64
import json
import logging
import re

import anthropic
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5"
GROQ_DEFAULT_MODEL = "qwen/qwen3.8-27b"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class BillReaderError(Exception):
    """A reading failure with a message that is safe to show the user."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _nullable(t: str) -> dict:
    return {"anyOf": [{"type": t}, {"type": "null"}]}


EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "readable": {"type": "boolean"},
        "supplier_name": _nullable("string"),
        "bill_number": _nullable("string"),
        "bill_date": _nullable("string"),
        "lines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "quantity": _nullable("number"),
                    "unit_price": _nullable("number"),
                    "amount": _nullable("number"),
                },
                "required": ["description", "quantity", "unit_price", "amount"],
                "additionalProperties": False,
            },
        },
        "subtotal": _nullable("number"),
        "tax": _nullable("number"),
        "total": _nullable("number"),
        "notes": _nullable("string"),
    },
    "required": ["readable", "supplier_name", "bill_number", "bill_date", "lines", "subtotal", "tax", "total", "notes"],
    "additionalProperties": False,
}

PROMPT = """This is a photo of a supplier invoice or purchase bill for a shop in India. It may be printed or handwritten, and may mix English and Hindi.

Read every item line the shop bought and return JSON matching the schema:
- readable: false if this is not a bill or you cannot read the item lines; then leave lines empty and say why in notes.
- supplier_name: the seller's business name as printed (not the buyer).
- bill_number, bill_date: as printed; write the date as YYYY-MM-DD when you can tell the day, month and year.
- lines: one entry per product line, top to bottom. description = the product text exactly as written on the line (keep model numbers and sizes).
  quantity = units bought; unit_price = price per unit before tax; amount = the line total as printed.
  Skip rows that are only tax, discount, freight, round-off or totals.
- subtotal, tax, total: as printed. Numbers only: no currency symbols or thousands separators.
- Use null for anything you cannot read. Do not guess digits you cannot see; mention doubtful values in notes."""

GROQ_PROMPT = PROMPT + "\n\nReply with only a JSON object with keys: readable, supplier_name, bill_number, bill_date, lines (array of {description, quantity, unit_price, amount}), subtotal, tax, total, notes."


def active_provider() -> str | None:
    p = settings.BILL_AI_PROVIDER.strip().lower()
    if p:
        return p
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.GROQ_API_KEY:
        return "groq"
    return None


_NUM = re.compile(r"-?\d+(?:\.\d+)?")


def _num(v):
    """Accept 1,18,500 / '₹ 2,499.00' / 3 and return a float, or None."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = _NUM.search(str(v).replace(",", ""))
    return float(m.group()) if m else None


def _text(v):
    s = (str(v).strip() if v is not None else "")
    return s or None


def normalise(raw: dict, reader: str) -> dict:
    lines = []
    for item in raw.get("lines") or []:
        if not isinstance(item, dict):
            continue
        desc = _text(item.get("description"))
        if not desc:
            continue
        qty, price, amount = _num(item.get("quantity")), _num(item.get("unit_price")), _num(item.get("amount"))
        if qty is None and price and amount:
            qty = round(amount / price, 3)
        if price is None and qty and amount:
            price = round(amount / qty, 2)
        lines.append({"description": desc, "quantity": qty, "unit_price": price, "amount": amount})
    return {
        "readable": bool(raw.get("readable", True)) and bool(lines),
        "supplier_name": _text(raw.get("supplier_name")),
        "bill_number": _text(raw.get("bill_number")),
        "bill_date": _text(raw.get("bill_date")),
        "subtotal": _num(raw.get("subtotal")),
        "tax": _num(raw.get("tax")),
        "total": _num(raw.get("total")),
        "notes": _text(raw.get("notes")),
        "lines": lines,
        "reader": reader,
    }


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


async def _read_anthropic(image: bytes, mime: str) -> dict:
    model = settings.BILL_AI_MODEL or ANTHROPIC_DEFAULT_MODEL
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY or None, timeout=90.0, max_retries=1)
    try:
        response = await client.beta.messages.create(
            model=model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": settings.BILL_AI_EFFORT or "low",
                           "format": {"type": "json_schema", "schema": EXTRACTION_SCHEMA}},
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime,
                                                 "data": base64.standard_b64encode(image).decode("ascii")}},
                    {"type": "text", "text": PROMPT},
                ],
            }],
        )
    except anthropic.AuthenticationError:
        raise BillReaderError("The Anthropic API key on the server is invalid.", 503)
    except anthropic.RateLimitError:
        raise BillReaderError("The bill reader is busy right now. Try again in a minute.", 429)
    except anthropic.BadRequestError as e:
        logger.error("Anthropic rejected bill request: %s", e.message)
        raise BillReaderError("The photo couldn't be read. Try a clearer JPEG or PNG under 5 MB.", 422)
    except anthropic.APIStatusError as e:
        logger.error("Anthropic error %s: %s", e.status_code, e.message)
        raise BillReaderError("The bill reader had a problem. Try again.", 502)
    except anthropic.APIConnectionError:
        raise BillReaderError("Couldn't reach the bill reader. Check the server's internet connection.", 502)

    if response.stop_reason == "refusal":
        raise BillReaderError("The bill reader declined this image. Try a photo of just the bill.", 422)
    if response.stop_reason == "max_tokens":
        raise BillReaderError("This bill is too long to read in one go. Photograph it in parts.", 422)
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        data = _parse_json(text)
    except json.JSONDecodeError:
        raise BillReaderError("The bill reader returned something unexpected. Try again.", 502)
    return normalise(data, f"anthropic:{response.model}")


async def _read_groq(image: bytes, mime: str) -> dict:
    model = settings.BILL_AI_MODEL or GROQ_DEFAULT_MODEL
    data_url = f"data:{mime};base64,{base64.standard_b64encode(image).decode('ascii')}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}"},
                json={
                    "model": model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": GROQ_PROMPT},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }],
                },
            )
    except httpx.HTTPError:
        raise BillReaderError("Couldn't reach the bill reader. Check the server's internet connection.", 502)
    if r.status_code == 401:
        raise BillReaderError("The Groq API key on the server is invalid.", 503)
    if r.status_code == 429:
        raise BillReaderError("The bill reader is busy right now. Try again in a minute.", 429)
    if r.status_code >= 400:
        logger.error("Groq error %s: %s", r.status_code, r.text[:500])
        raise BillReaderError("The photo couldn't be read. Try a clearer JPEG or PNG.", 422 if r.status_code < 500 else 502)
    try:
        content = r.json()["choices"][0]["message"]["content"]
        data = _parse_json(content)
    except (KeyError, IndexError, ValueError):
        raise BillReaderError("The bill reader returned something unexpected. Try again.", 502)
    return normalise(data, f"groq:{model}")


DEMO_READING = {
    "readable": True, "supplier_name": "Apple Pvt Ltd", "bill_number": "INV-2291", "bill_date": "2026-11-24",
    "lines": [
        {"description": "iPhone 15 Pro 128GB", "quantity": 12, "unit_price": 118500, "amount": 1422000},
        {"description": "iPad Air 5 Wi-Fi", "quantity": 5, "unit_price": 51200, "amount": 256000},
        {"description": "Apple 20W adptr", "quantity": 20, "unit_price": 1450, "amount": 29000},
    ],
    "subtotal": 1707000, "tax": 307260, "total": 2014260, "notes": None,
}


async def read_bill(image: bytes, mime: str) -> dict:
    provider = active_provider()
    if provider is None:
        raise BillReaderError(
            "Bill scanning needs an AI key on the server. Add ANTHROPIC_API_KEY or GROQ_API_KEY to the API service.", 503)
    if provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise BillReaderError("BILL_AI_PROVIDER is anthropic but ANTHROPIC_API_KEY is not set.", 503)
        return await _read_anthropic(image, mime)
    if provider == "groq":
        if not settings.GROQ_API_KEY:
            raise BillReaderError("BILL_AI_PROVIDER is groq but GROQ_API_KEY is not set.", 503)
        return await _read_groq(image, mime)
    if provider == "demo":
        return normalise(DEMO_READING, "demo")
    raise BillReaderError(f"Unknown BILL_AI_PROVIDER: {provider}", 503)
