"""Recursive text chunker.

Splits on the coarsest natural boundary that makes pieces fit (paragraph, then
line, then sentence, then word), then merges adjacent small pieces up to the
target size and carries a small overlap into the next chunk so facts that
straddle a boundary stay retrievable. Pure functions; no I/O.
"""

import re
from collections.abc import Callable

_SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")

# (splitter, joiner used to rebuild text when merging pieces)
_LEVELS: list[tuple[Callable[[str], list[str]], str]] = [
    (lambda t: re.split(r"\n\s*\n", t), "\n\n"),
    (lambda t: t.split("\n"), "\n"),
    (lambda t: _SENTENCE.split(t), " "),
    (lambda t: t.split(" "), " "),
]

Piece = tuple[str, str]  # (text, joiner placed before it when it is not first)


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, *, max_chars: int, overlap_chars: int) -> list[str]:
    if max_chars <= 0:
        raise ValueError("max_chars must be positive")
    if not 0 <= overlap_chars < max_chars:
        raise ValueError("overlap_chars must be >= 0 and < max_chars")
    text = normalize_text(text)
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    return _merge(_split(text, "", max_chars, 0), max_chars, overlap_chars)


def _split(text: str, joiner: str, max_chars: int, level: int) -> list[Piece]:
    if len(text) <= max_chars:
        return [(text, joiner)]
    if level >= len(_LEVELS):  # last resort: hard cut (e.g. a huge unbroken token)
        return [
            (text[i : i + max_chars], joiner if i == 0 else "")
            for i in range(0, len(text), max_chars)
        ]
    splitter, separator = _LEVELS[level]
    parts = [p.strip() for p in splitter(text)]
    parts = [p for p in parts if p]
    if len(parts) <= 1:
        return _split(text, joiner, max_chars, level + 1)
    pieces: list[Piece] = []
    for i, part in enumerate(parts):
        pieces.extend(_split(part, joiner if i == 0 else separator, max_chars, level + 1))
    return pieces


def _joined_length(pieces: list[Piece]) -> int:
    return sum(len(t) for t, _ in pieces) + sum(len(j) for _, j in pieces[1:])


def _join(pieces: list[Piece]) -> str:
    return "".join(
        text if i == 0 else joiner + text for i, (text, joiner) in enumerate(pieces)
    )


def _overlap_tail(pieces: list[Piece], overlap_chars: int) -> list[Piece]:
    tail: list[Piece] = []
    for piece in reversed(pieces):
        if _joined_length([piece, *tail]) > overlap_chars:
            break
        tail.insert(0, piece)
    return tail


def _merge(pieces: list[Piece], max_chars: int, overlap_chars: int) -> list[str]:
    chunks: list[str] = []
    current: list[Piece] = []
    for text, joiner in pieces:
        candidate = [*current, (text, joiner)]
        if current and _joined_length(candidate) > max_chars:
            chunks.append(_join(current))
            current = _overlap_tail(current, overlap_chars)
            while current and _joined_length([*current, (text, joiner)]) > max_chars:
                current.pop(0)
        current.append((text, joiner))
    if current:
        chunks.append(_join(current))
    return chunks
