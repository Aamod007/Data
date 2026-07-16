"""Error fingerprinting: normalize volatile tokens out of error text and hash
the remaining template. Two occurrences of the same underlying failure produce
the same fingerprint even if timestamps, ids, and row counts differ.
"""
import hashlib
import re

_VOLATILE = [
    # ISO timestamps / dates / times
    (re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?"), "<TS>"),
    (re.compile(r"\d{4}-\d{2}-\d{2}"), "<DATE>"),
    (re.compile(r"\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b"), "<TIME>"),
    # UUIDs and long hex ids
    (re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I), "<UUID>"),
    (re.compile(r"\b[0-9a-f]{16,64}\b", re.I), "<HEX>"),
    # IPs, ports in URLs, memory addresses
    (re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b"), "<IP>"),
    (re.compile(r"0x[0-9a-fA-F]+"), "<ADDR>"),
    # temp/attempt paths and python line numbers
    (re.compile(r"line \d+"), "line <N>"),
    (re.compile(r"attempt[= ]\d+", re.I), "attempt=<N>"),
    # any remaining bare numbers (row counts, durations, pids, sizes)
    (re.compile(r"\b\d+(?:\.\d+)?\b"), "<N>"),
]

_ERROR_LINE = re.compile(
    r"(?i)^.*\b(error|exception|failed|failure|fatal|traceback|denied|timeout|timed out|"
    r"refused|cannot|could not|not found|does not exist|out of memory|oom)\b.*$",
    re.MULTILINE,
)


def extract_error_lines(log: str, max_lines: int = 40) -> list[str]:
    """Pull the lines most likely to describe the failure."""
    lines = [m.group(0).strip() for m in _ERROR_LINE.finditer(log)]
    # de-dup while preserving order
    seen: set[str] = set()
    out = []
    for ln in lines:
        key = ln[:200]
        if key not in seen:
            seen.add(key)
            out.append(ln)
        if len(out) >= max_lines:
            break
    return out


def normalize(text: str) -> str:
    for pattern, repl in _VOLATILE:
        text = pattern.sub(repl, text)
    # collapse whitespace so formatting differences don't change the hash
    return re.sub(r"\s+", " ", text).strip().lower()


def fingerprint(log: str, pipeline_external_id: str = "", node_type: str = "") -> str:
    """Stable signature of a failure: pipeline + node type + normalized error template."""
    error_lines = extract_error_lines(log)
    basis = "|".join([pipeline_external_id, node_type, normalize("\n".join(error_lines[:10]))])
    return hashlib.sha256(basis.encode()).hexdigest()[:32]


def truncate_log(log: str, budget: int = 24000) -> str:
    """Smart truncation for LLM context: keep head, tail, and the window
    around the first error line; drop the noisy middle."""
    if len(log) <= budget:
        return log

    head_size = budget // 4
    tail_size = budget // 4
    error_window = budget // 2

    head = log[:head_size]
    tail = log[-tail_size:]

    m = _ERROR_LINE.search(log)
    middle = ""
    if m:
        start = max(0, m.start() - error_window // 4)
        middle = log[start : start + error_window]

    marker = "\n... [log truncated] ...\n"
    return head + marker + middle + marker + tail
