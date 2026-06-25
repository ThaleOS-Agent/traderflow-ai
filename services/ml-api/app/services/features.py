from math import sqrt


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def build_feature_summary(prices: list[float], volumes: list[float] | None = None) -> dict:
    if len(prices) < 2:
        return {
            "returns": 0.0,
            "momentum": 0.0,
            "volatility": 0.0,
            "avgVolume": average(volumes or []),
        }

    first_price = prices[0]
    last_price = prices[-1]
    returns = (last_price - first_price) / first_price if first_price else 0.0

    deltas = [
        (prices[index] - prices[index - 1]) / prices[index - 1]
        for index in range(1, len(prices))
        if prices[index - 1]
    ]
    mean_delta = average(deltas)
    variance = average([(delta - mean_delta) ** 2 for delta in deltas])

    return {
        "returns": returns,
        "momentum": average(prices[-5:]) - average(prices[-10:-5] or prices[-5:]),
        "volatility": sqrt(variance) if variance > 0 else 0.0,
        "avgVolume": average(volumes or []),
    }
