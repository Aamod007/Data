"""Secret/PII redaction — runs BEFORE logs are stored or sent to any LLM."""
import math
import re
from collections import Counter

# Each rule: (name, compiled pattern, replacement)
_RULES: list[tuple[str, re.Pattern, str]] = [
    (
        "connection_string",
        re.compile(
            r"(?i)((?:postgres(?:ql)?|mysql|mssql|jdbc:[\w:]+|mongodb(?:\+srv)?|redis|amqp)://)[^\s'\"]+"
        ),
        r"\1[REDACTED]",
    ),
    (
        "aws_access_key",
        re.compile(r"\b(A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b"),
        "[REDACTED_AWS_KEY]",
    ),
    (
        "private_key_block",
        re.compile(
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
            re.DOTALL,
        ),
        "[REDACTED_PRIVATE_KEY]",
    ),
    (
        "bearer_token",
        re.compile(r"(?i)\b(bearer|token|authorization)[\s:=]+[\"']?([A-Za-z0-9\-._~+/]{16,}=*)"),
        r"\1: [REDACTED]",
    ),
    (
        "kv_secret",
        re.compile(
            r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|client[_-]?secret|"
            r"sas[_-]?token|account[_-]?key|private[_-]?key)\b(\s*[:=]\s*)[\"']?([^\s\"',;&]{4,})"
        ),
        r"\1\2[REDACTED]",
    ),
    (
        "url_credentials",
        re.compile(r"://([^/\s:@]+):([^/\s@]+)@"),
        r"://\1:[REDACTED]@",
    ),
    (
        "email",
        re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"),
        "[REDACTED_EMAIL]",
    ),
]

# High-entropy detector for opaque tokens the regexes miss (e.g. random 40-char
# hex secrets). Applied only to long unbroken strings to avoid false positives
# on ordinary words/paths.
_CANDIDATE = re.compile(r"\b[A-Za-z0-9+/_\-]{32,}\b")
# Tokens matching these shapes are infra identifiers, not secrets.
_SAFE_TOKEN = re.compile(
    r"^(?:[0-9a-f]{32,64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$",
    re.IGNORECASE,
)


def _shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in Counter(s).values())


def redact(text: str) -> tuple[str, int]:
    """Redact secrets/PII. Returns (redacted_text, redaction_count)."""
    count = 0
    for _name, pattern, repl in _RULES:
        text, n = pattern.subn(repl, text)
        count += n

    def _entropy_sub(m: re.Match) -> str:
        nonlocal count
        token = m.group(0)
        # run ids / request ids / hashes look random but are safe & useful
        if _SAFE_TOKEN.match(token):
            return token
        if _shannon_entropy(token) >= 4.5:
            count += 1
            return "[REDACTED_HIGH_ENTROPY]"
        return token

    text = _CANDIDATE.sub(_entropy_sub, text)
    return text, count
