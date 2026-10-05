"""Currency Conversion Engine for Worldwide Hotel Pricing."""

from typing import Dict, Any

EXCHANGE_RATES: Dict[str, Dict[str, Any]] = {
    "USD ($)": {"code": "USD", "symbol": "$", "rate_to_usd": 1.0, "format": "${:,.0f}"},
    "EUR (€)": {"code": "EUR", "symbol": "€", "rate_to_usd": 0.92, "format": "€{:,.0f}"},
    "MAD (د.م.)": {"code": "MAD", "symbol": "MAD ", "rate_to_usd": 10.15, "format": "{:,.0f} MAD"},
    "SAR (ر.س)": {"code": "SAR", "symbol": "SAR ", "rate_to_usd": 3.75, "format": "{:,.0f} SAR"},
    "AED (د.إ)": {"code": "AED", "symbol": "AED ", "rate_to_usd": 3.67, "format": "{:,.0f} AED"},
    "GBP (£)": {"code": "GBP", "symbol": "£", "rate_to_usd": 0.79, "format": "£{:,.0f}"},
    "JPY (¥)": {"code": "JPY", "symbol": "¥", "rate_to_usd": 152.0, "format": "¥{:,.0f}"}
}

class CurrencyEngine:
    """Handles multi-currency conversions and localized price formatting."""

    @staticmethod
    def get_supported_currencies() -> list:
        return list(EXCHANGE_RATES.keys())

    @staticmethod
    def convert_amount(amount_usd: float, currency_label: str) -> float:
        """Convert a USD base price into the target currency value."""
        rate_info = EXCHANGE_RATES.get(currency_label, EXCHANGE_RATES["USD ($)"])
        return amount_usd * rate_info["rate_to_usd"]

    @staticmethod
    def format_price(amount_usd: float, currency_label: str) -> str:
        """Convert and format a USD base price with target currency symbol."""
        rate_info = EXCHANGE_RATES.get(currency_label, EXCHANGE_RATES["USD ($)"])
        converted = amount_usd * rate_info["rate_to_usd"]
        return rate_info["format"].format(converted)
