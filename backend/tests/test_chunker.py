import pytest

from app.adapters.chunker import chunk_text

MAX = 200
OVERLAP = 40


def chunks_of(text: str) -> list[str]:
    return chunk_text(text, max_chars=MAX, overlap_chars=OVERLAP)


def test_empty_and_whitespace_give_no_chunks():
    assert chunks_of("") == []
    assert chunks_of("  \n\n  ") == []


def test_short_text_is_a_single_chunk():
    assert chunks_of("A short note.") == ["A short note."]


def test_every_chunk_respects_max_size():
    text = ("This is a sentence about retrieval. " * 40).strip()
    result = chunks_of(text)
    assert len(result) > 1
    assert all(len(c) <= MAX for c in result)


def test_prefers_paragraph_boundaries():
    paragraphs = ["Alpha " * 20, "Bravo " * 20, "Charlie " * 20]
    result = chunk_text("\n\n".join(p.strip() for p in paragraphs), max_chars=150, overlap_chars=0)
    assert len(result) == 3
    assert result[0].startswith("Alpha") and "Bravo" not in result[0]
    assert result[1].startswith("Bravo")


def test_small_paragraphs_are_merged_not_emitted_one_by_one():
    text = "\n\n".join(f"Tiny paragraph {i}." for i in range(8))
    result = chunks_of(text)
    assert len(result) < 8
    assert "Tiny paragraph 0." in result[0] and "Tiny paragraph 1." in result[0]


def test_consecutive_chunks_overlap():
    sentences = [f"Sentence number {i} has a few words in it." for i in range(30)]
    result = chunks_of(" ".join(sentences))
    assert len(result) > 2
    for previous, current in zip(result, result[1:]):
        assert previous.split()[-1] in current, "next chunk should repeat the tail of the previous one"


def test_no_empty_chunks():
    text = "\n\n\n".join(["Some text here. " * 15] * 5)
    assert all(c.strip() for c in chunks_of(text))


def test_oversized_unbroken_token_is_hard_cut():
    result = chunks_of("x" * 450)
    assert all(len(c) <= MAX for c in result)
    assert "".join(result).count("x") >= 450


def test_paragraph_breaks_are_preserved_inside_a_chunk():
    result = chunk_text("First paragraph.\n\nSecond paragraph.", max_chars=500, overlap_chars=0)
    assert result == ["First paragraph.\n\nSecond paragraph."]


def test_invalid_parameters_rejected():
    with pytest.raises(ValueError):
        chunk_text("x", max_chars=0, overlap_chars=0)
    with pytest.raises(ValueError):
        chunk_text("x", max_chars=10, overlap_chars=10)
