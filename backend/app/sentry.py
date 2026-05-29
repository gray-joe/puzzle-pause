import os


def _sample_rate(default: float) -> float:
    raw = os.environ.get("SENTRY_TRACES_SAMPLE_RATE")
    if raw is None:
        return default
    try:
        rate = float(raw)
    except ValueError:
        return default
    return min(max(rate, 0.0), 1.0)


def init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return

    import sentry_sdk

    environment = os.environ.get("SENTRY_ENVIRONMENT") or os.environ.get(
        "PUZZLE_ENV", "dev"
    )
    default_traces_sample_rate = (
        0.1 if environment in {"prod", "production"} else 1.0
    )

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=os.environ.get("SENTRY_RELEASE") or None,
        traces_sample_rate=_sample_rate(default_traces_sample_rate),
        send_default_pii=False,
    )
