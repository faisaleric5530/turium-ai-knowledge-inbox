from types import SimpleNamespace

import httpx
import openai
import pytest

from app.adapters.llm import LlmResult, OpenRouterLlm
from app.errors import ServiceUnavailableError, UpstreamError


def status_error(status: int) -> openai.APIStatusError:
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    response = httpx.Response(status, request=request, json={"error": {"message": "x"}})
    return openai.APIStatusError("boom", response=response, body=None)


def completion(content: str | None):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class FakeClient:
    """Scripted OpenAI client: behaviours maps model -> exception or content."""

    def __init__(self, behaviours: dict):
        self.behaviours = behaviours
        self.calls: list[str] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, *, model, **_kwargs):
        self.calls.append(model)
        outcome = self.behaviours[model]
        if isinstance(outcome, Exception):
            raise outcome
        return completion(outcome)


def make_llm(behaviours: dict, models: list[str]) -> tuple[OpenRouterLlm, FakeClient]:
    llm = OpenRouterLlm(
        api_key="k", base_url="http://x", model=models[0], fallback_models=models[1:],
        timeout_s=5, temperature=0,
    )
    client = FakeClient(behaviours)
    llm._client = client
    return llm, client


def test_primary_success_does_not_touch_fallbacks():
    llm, client = make_llm({"a": "hello", "b": "unused"}, ["a", "b"])
    assert llm.complete("s", "u") == LlmResult(text="hello", model="a")
    assert client.calls == ["a"]


def test_rate_limited_primary_falls_back_and_reports_the_model_that_answered():
    llm, client = make_llm({"a": status_error(429), "b": "from b"}, ["a", "b"])
    result = llm.complete("s", "u")
    assert result == LlmResult(text="from b", model="b")
    assert client.calls == ["a", "b"]


def test_empty_response_falls_back():
    llm, _ = make_llm({"a": "   ", "b": "from b"}, ["a", "b"])
    assert llm.complete("s", "u").model == "b"


def test_server_error_falls_back():
    llm, _ = make_llm({"a": status_error(503), "b": "from b"}, ["a", "b"])
    assert llm.complete("s", "u").text == "from b"


def test_all_models_rate_limited_gives_a_clear_message():
    llm, client = make_llm({"a": status_error(429), "b": status_error(429)}, ["a", "b"])
    with pytest.raises(UpstreamError, match="rate-limited right now"):
        llm.complete("s", "u")
    assert client.calls == ["a", "b"]


def test_mixed_failures_list_each_model():
    llm, _ = make_llm({"a": status_error(429), "b": status_error(503)}, ["a", "b"])
    with pytest.raises(UpstreamError) as info:
        llm.complete("s", "u")
    assert "a: HTTP 429" in info.value.message and "b: HTTP 503" in info.value.message


@pytest.mark.parametrize("status, text", [(401, "API key"), (402, "credits"), (403, "refused")])
def test_auth_and_credit_errors_fail_fast_without_fallback(status, text):
    llm, client = make_llm({"a": status_error(status), "b": "never"}, ["a", "b"])
    with pytest.raises(UpstreamError, match=text):
        llm.complete("s", "u")
    assert client.calls == ["a"]


def test_fallback_list_ignores_blanks_and_duplicates_of_primary():
    llm = OpenRouterLlm(
        api_key="k", base_url="http://x", model="a", fallback_models=["a", "", "b"],
        timeout_s=5, temperature=0,
    )
    assert llm.models == ["a", "b"]


def test_not_configured_is_service_unavailable():
    llm = OpenRouterLlm(api_key="", base_url="http://x", model="", timeout_s=5, temperature=0)
    with pytest.raises(ServiceUnavailableError, match="not configured"):
        llm.complete("s", "u")
