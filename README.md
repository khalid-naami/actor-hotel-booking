# Apify Actor: Global Hotel & Luxury Resort Intelligence 🏨✨

A luxury accommodations & hotel booking engine Actor providing verified pricing, amenities, room specifications, review analytics, and automated multi-currency quotation breakdowns (including VAT, city tourism taxes, and service charges).

---

## 🌟 Key Features

1. **Curated Luxury & Boutique Portfolio**: Detailed records for world-famous palaces, riads, 5-star resorts, and urban luxury suites across Marrakech, Paris, Tokyo, Dubai, Rome, New York, Bali, etc.
2. **Multi-Currency Quote Breakdown**: Real-time conversions in USD ($), EUR (€), MAD (د.م.), SAR (ر.س), AED (د.إ), GBP (£), and JPY (¥).
3. **Transparent Tax & Fee Calculation**: Calculates subtotal, 10% VAT, 3% service charges, and per-room nightly municipal tourism taxes.
4. **Room Inventory & Cancellation Policies**: Scrapes individual room classes, square footage, bed configuration, and refund/cancellation terms.
5. **Distance & Location Metrics**: Exact GPS coordinates, distance to city center, and transit distance to nearest international airport.

---

## 📥 Input Schema

| Field | Type | Default | Description |
|---|---|---|---|
| `destination` | String | `"All Destinations 🌍"` | Target city (e.g. Marrakech, Paris, Tokyo, Dubai, or all). |
| `maxPriceUsd` | Integer | `2000` | Maximum base rate per night in USD. |
| `minStars` | Integer | `4` | Minimum star threshold (1 - 5). |
| `propertyType` | Select | `"All Types"` | Accommodation style (`Historic Palace`, `Boutique Riad`, `Luxury Resort`, etc.). |
| `currency` | Select | `"USD ($)"` | Output currency for pricing calculations. |
| `checkinDaysFromNow` | Integer | `7` | Days offset from today for quote simulation. |
| `stayNights` | Integer | `3` | Total nights of stay. |
| `searchQuery` | String | `""` | Optional text filter on hotel name or features. |

---

## 📤 Output Dataset Format

```json
{
  "id": "RAK-001",
  "name": "La Mamounia Palace Hotel",
  "city": "Marrakech",
  "country": "Morocco 🇲🇦",
  "stars": 5,
  "property_type": "Historic Palace",
  "rating": 9.7,
  "review_count": 3420,
  "rating_badge": "Exceptional 🌟",
  "base_price_usd_per_night": 680,
  "base_price_converted": "$680",
  "room_types_available": [
    {
      "name": "Classic Hivernage King Room",
      "size_sqm": 35,
      "bed": "1 King Bed",
      "cancellation": "Free cancellation until 48h before",
      "nightly_rate": "$680"
    }
  ],
  "sample_quote": {
    "checkin": "2026-10-10",
    "checkout": "2026-10-13",
    "nights": 3,
    "room_name": "Classic Hivernage King Room",
    "nightly_rate": "$680",
    "subtotal": "$2,040",
    "taxes_and_fees": "$280",
    "grand_total": "$2,320",
    "currency": "USD ($)"
  }
}
```

---

## 🚀 How to Run Locally

```bash
cd actor-hotel-booking
pip install -r requirements.txt
python -m src.main
```
