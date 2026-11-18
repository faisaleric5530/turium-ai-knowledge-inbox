"""Chat completion client for OpenRouter via the OpenAI-compatible SDK.

Free OpenRouter models share upstream rate limits and are often throttled (HTTP
429), so the client tries a primary model and then optional fallback models.
Auth/credit problems (401/402/403) fail immediately: another model cannot fix them.
"""

from dataclasses import dataclass
from typing import Protocol

import openai
import structlog

from app.errors import ServiceUnavailableError, UpstreamError

log = structlog.get_logger(__name__)

# HTTP statuses where trying another model can help (throttled, overloaded, model-specific).
_FAILOVER_STATUSES = frozenset({400, 404, 408, 409, 429, 500, 502, 503, 504})
_AUTH_MESSAGES = {
    401: "OpenRouter rejected the API key (HTTP 401). Check OPENROUTER_API_KEY in backend/.env.",
    402: "The OpenRouter account has insufficient credits for this model (HTTP 402).",
    403: "OpenRouter refused the request (HTTP 403). Check the key's permissions and the model's access.",
}


@dataclass(frozen=True)
class LlmResult:
    text: str
    model: str  # the model that actually produced the answer


class LlmClient(Protocol):
    model: str

    def complete(self, system: str, user: str) -> LlmResult: ...


class _ModelFailed(Exception):
    def __init__(self, model: str, status: int | None, reason: str) -> None:
        super().__init__(reason)
        self.model = model
        self.status = status
        self.reason = reason


class OpenRouterLlm:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        fallback_models: list[str] | None = None,
        timeout_s: float,
        temperature: float,
    ) -> None:
        self.model = model
        self.models = [model, *[m for m in (fallback_models or []) if m and m != model]]
        self._temperature = temperature
        self._client = (
            openai.OpenAI(api_key=api_key, base_url=base_url, timeout=timeout_s, max_retries=1)
            if api_key and model
            else None
        )

    def complete(self, system: str, user: str) -> LlmResult:
        if self._client is None:
            raise ServiceUnavailableError(
                "The answer model is not configured. Set OPENROUTER_API_KEY and LLM_MODEL in backend/.env."
            )
        failures: list[_ModelFailed] = []
        for model in self.models:
            try:
                text = self._call(model, system, user)
            except _ModelFailed as failure:
                failures.append(failure)
                log.warning(
                    "llm_model_failed",
                    model=model,
                    status=failure.status,
                    reason=failure.reason,
                    will_try_next=model != self.models[-1],
                )
                if failure.status in _AUTH_MESSAGES:
                    raise UpstreamError(_AUTH_MESSAGES[failure.status]) from None
                continue
            if failures:
                log.info("llm_fallback_used", model=model, failed=[f.model for f in failures])
            return LlmResult(text=text, model=model)
        raise UpstreamError(_summarise(failures))

    def _call(self, model: str, system: str, user: str) -> str:
        assert self._client is not None
        try:
            response = self._client.chat.completions.create(
                model=model,
                temperature=self._temperature,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except openai.APIStatusError as exc:
            status = exc.status_code
            if status in _AUTH_MESSAGES or status in _FAILOVER_STATUSES:
                raise _ModelFailed(model, status, f"HTTP {status}") from None
            raise UpstreamError(f"The answer model returned an error (HTTP {status}).") from exc
        except openai.APIError as exc:  # connection errors, timeouts
            raise _ModelFailed(model, None, type(exc).__name__) from None
        content = response.choices[0].message.content if response.choices else None
        if not content or not content.strip():
            raise _ModelFailed(model, None, "empty response")
        return content.strip()


def _summarise(failures: list[_ModelFailed]) -> str:
    statuses = {f.status for f in failures}
    if statuses == {429}:
        return (
            "The answer model is rate-limited right now (free OpenRouter models share limits). "
            "Wait a few seconds and try again, or set a paid LLM_MODEL in backend/.env."
        )
    detail = ", ".join(f"{f.model}: {f.reason}" for f in failures)
    return f"The answer model could not respond ({detail}). Try again shortly."
