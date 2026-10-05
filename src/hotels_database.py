"""Global Hotel and Resort Database with Luxury Riads, Villas and City Suites."""

from typing import Dict, List, Any, Optional
import pandas as pd

HOTELS_DATABASE: List[Dict[str, Any]] = [
    # 🇲🇦 Marrakech, Morocco
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
        "base_price_usd": 680,
        "discount_pct": 15,
        "original_price_usd": 800,
        "lat": 31.6218,
        "lon": -7.9984,
        "address": "Avenue Bab Jdid, Medina, Marrakech",
        "distance_center_km": 0.8,
        "distance_airport_km": 4.5,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Free Breakfast 🥐", "Fitness Center 🏋️", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Classic Hivernage King Room", "size_sqm": 35, "bed": "1 King Bed", "price_multiplier": 1.0, "cancellation": "Free cancellation until 48h before"},
            {"name": "Park View Deluxe Room", "size_sqm": 45, "bed": "1 King Bed or 2 Twin Beds", "price_multiplier": 1.25, "cancellation": "Free cancellation"},
            {"name": "Prestige Arab-Andalusian Suite", "size_sqm": 75, "bed": "1 King Bed + Lounge", "price_multiplier": 1.80, "cancellation": "Free cancellation"},
            {"name": "Royal Private Riad Villa", "size_sqm": 700, "bed": "3 King Beds + Private Pool", "price_multiplier": 4.50, "cancellation": "Non-refundable deal"}
        ],
        "sub_ratings": {"Cleanliness": 9.8, "Location": 9.9, "Staff": 9.8, "Comfort": 9.7, "Value for Money": 9.2},
        "seasonal_rates": {"High_Season": 850, "Low_Season": 520, "Current": 680}
    },
    {
        "id": "RAK-002",
        "name": "Royal Mansour Marrakech",
        "city": "Marrakech",
        "country": "Morocco 🇲🇦",
        "stars": 5,
        "property_type": "Boutique Riad",
        "rating": 9.9,
        "review_count": 1850,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 1250,
        "discount_pct": 10,
        "original_price_usd": 1390,
        "lat": 31.6264,
        "lon": -8.0022,
        "address": "Rue Abou Abbas El Sebti, Medina, Marrakech",
        "distance_center_km": 0.5,
        "distance_airport_km": 5.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Airport Shuttle 🚐", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Superior One-Bedroom Private Riad", "size_sqm": 140, "bed": "1 King Bed + Private Plunge Pool", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Premier Two-Bedroom Private Riad", "size_sqm": 430, "bed": "2 King Beds + Rooftop Terrace", "price_multiplier": 1.90, "cancellation": "Free cancellation"},
            {"name": "Grand Riad of the King", "size_sqm": 1800, "bed": "4 Royal Suites + Butler + Hammam", "price_multiplier": 6.50, "cancellation": "Special VIP Terms"}
        ],
        "sub_ratings": {"Cleanliness": 9.9, "Location": 9.9, "Staff": 10.0, "Comfort": 9.9, "Value for Money": 9.4},
        "seasonal_rates": {"High_Season": 1600, "Low_Season": 1100, "Current": 1250}
    },

    # 🇲🇦 Casablanca, Morocco
    {
        "id": "CMN-001",
        "name": "Four Seasons Hotel Casablanca",
        "city": "Casablanca",
        "country": "Morocco 🇲🇦",
        "stars": 5,
        "property_type": "Luxury Resort",
        "rating": 9.3,
        "review_count": 2100,
        "rating_badge": "Superb ✨",
        "base_price_usd": 380,
        "discount_pct": 20,
        "original_price_usd": 475,
        "lat": 33.5982,
        "lon": -7.6710,
        "address": "Boulevard de la Corniche, Anfa, Casablanca",
        "distance_center_km": 3.5,
        "distance_airport_km": 28.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Free Breakfast 🥐", "Fitness Center 🏋️"],
        "room_types": [
            {"name": "Superior King Room (Garden View)", "size_sqm": 47, "bed": "1 King Bed", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Premier Oceanfront Room", "size_sqm": 50, "bed": "1 King Bed + Balcony", "price_multiplier": 1.35, "cancellation": "Free cancellation"},
            {"name": "Four Seasons Executive Ocean Suite", "size_sqm": 90, "bed": "1 King Bed + Living Area", "price_multiplier": 2.10, "cancellation": "Free cancellation"}
        ],
        "sub_ratings": {"Cleanliness": 9.5, "Location": 9.4, "Staff": 9.4, "Comfort": 9.4, "Value for Money": 8.9},
        "seasonal_rates": {"High_Season": 480, "Low_Season": 310, "Current": 380}
    },

    # 🇦🇪 Dubai, UAE
    {
        "id": "DXB-001",
        "name": "Burj Al Arab Jumeirah",
        "city": "Dubai",
        "country": "United Arab Emirates 🇦🇪",
        "stars": 5,
        "property_type": "Luxury Resort",
        "rating": 9.8,
        "review_count": 4890,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 1550,
        "discount_pct": 12,
        "original_price_usd": 1760,
        "lat": 25.1412,
        "lon": 55.1852,
        "address": "Jumeirah Beach Road, Umm Suqeim 3, Dubai",
        "distance_center_km": 12.0,
        "distance_airport_km": 21.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Airport Shuttle 🚐", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "One-Bedroom Deluxe Duplex Suite", "size_sqm": 170, "bed": "1 King Bed + Arabian Sea View", "price_multiplier": 1.0, "cancellation": "Free cancellation until 72h"},
            {"name": "Panoramic Oceanfront Suite", "size_sqm": 225, "bed": "1 King Bed + 360 Floor-to-Ceiling Windows", "price_multiplier": 1.45, "cancellation": "Free cancellation"},
            {"name": "Royal Two-Bedroom Presidential Suite", "size_sqm": 780, "bed": "2 Master Beds + Private Cinema & Elevator", "price_multiplier": 4.80, "cancellation": "Non-refundable VIP"}
        ],
        "sub_ratings": {"Cleanliness": 9.9, "Location": 9.7, "Staff": 9.9, "Comfort": 9.9, "Value for Money": 9.3},
        "seasonal_rates": {"High_Season": 2100, "Low_Season": 1200, "Current": 1550}
    },
    {
        "id": "DXB-002",
        "name": "Atlantis The Royal Palm",
        "city": "Dubai",
        "country": "United Arab Emirates 🇦🇪",
        "stars": 5,
        "property_type": "Luxury Resort",
        "rating": 9.6,
        "review_count": 3120,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 850,
        "discount_pct": 18,
        "original_price_usd": 1035,
        "lat": 25.1385,
        "lon": 55.1270,
        "address": "Crescent Road, Palm Jumeirah, Dubai",
        "distance_center_km": 18.0,
        "distance_airport_km": 34.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Seascape King Room", "size_sqm": 55, "bed": "1 King Bed + Balcony", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Sky Pool Villa Suite", "size_sqm": 118, "bed": "1 King Bed + Private Infinity Pool", "price_multiplier": 2.20, "cancellation": "Free cancellation"}
        ],
        "sub_ratings": {"Cleanliness": 9.7, "Location": 9.6, "Staff": 9.6, "Comfort": 9.7, "Value for Money": 9.1},
        "seasonal_rates": {"High_Season": 1200, "Low_Season": 650, "Current": 850}
    },

    # 🇸🇦 Riyadh, Saudi Arabia
    {
        "id": "RUH-001",
        "name": "The Ritz-Carlton, Riyadh",
        "city": "Riyadh",
        "country": "Saudi Arabia 🇸🇦",
        "stars": 5,
        "property_type": "Historic Palace",
        "rating": 9.5,
        "review_count": 2840,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 490,
        "discount_pct": 15,
        "original_price_usd": 575,
        "lat": 24.6658,
        "lon": 46.6300,
        "address": "Al Hada District, Makkah Road, Riyadh",
        "distance_center_km": 6.0,
        "distance_airport_km": 42.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Free Breakfast 🥐", "Fitness Center 🏋️", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Deluxe King Room", "size_sqm": 42, "bed": "1 King Bed", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Executive Club Suite", "size_sqm": 95, "bed": "1 King Bed + Club Lounge Access", "price_multiplier": 1.70, "cancellation": "Free cancellation"},
            {"name": "Royal Two-Bedroom Palace Suite", "size_sqm": 400, "bed": "2 King Beds + Dining Hall", "price_multiplier": 4.20, "cancellation": "Special Policy"}
        ],
        "sub_ratings": {"Cleanliness": 9.7, "Location": 9.4, "Staff": 9.6, "Comfort": 9.6, "Value for Money": 9.0},
        "seasonal_rates": {"High_Season": 680, "Low_Season": 380, "Current": 490}
    },

    # 🇫🇷 Paris, France
    {
        "id": "PAR-001",
        "name": "The Ritz Paris",
        "city": "Paris",
        "country": "France 🇫🇷",
        "stars": 5,
        "property_type": "Historic Palace",
        "rating": 9.8,
        "review_count": 2980,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 1420,
        "discount_pct": 8,
        "original_price_usd": 1540,
        "lat": 48.8683,
        "lon": 2.3292,
        "address": "15 Place Vendôme, 1st arr., Paris",
        "distance_center_km": 0.3,
        "distance_airport_km": 24.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Superior Vendôme King Room", "size_sqm": 40, "bed": "1 King Bed", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Deluxe Suite with Garden View", "size_sqm": 70, "bed": "1 King Bed + Salon", "price_multiplier": 1.85, "cancellation": "Free cancellation"},
            {"name": "Prestige Suite Coco Chanel", "size_sqm": 128, "bed": "1 King Bed + Direct Vendôme View", "price_multiplier": 3.60, "cancellation": "Non-refundable"}
        ],
        "sub_ratings": {"Cleanliness": 9.9, "Location": 10.0, "Staff": 9.8, "Comfort": 9.8, "Value for Money": 9.1},
        "seasonal_rates": {"High_Season": 1850, "Low_Season": 1200, "Current": 1420}
    },

    # 🇬🇧 London, UK
    {
        "id": "LON-001",
        "name": "The Savoy Hotel London",
        "city": "London",
        "country": "United Kingdom 🇬🇧",
        "stars": 5,
        "property_type": "Historic Palace",
        "rating": 9.5,
        "review_count": 3890,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 890,
        "discount_pct": 14,
        "original_price_usd": 1035,
        "lat": 51.5103,
        "lon": -0.1205,
        "address": "Strand, Covent Garden, London",
        "distance_center_km": 0.2,
        "distance_airport_km": 26.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Superior Queen Room", "size_sqm": 32, "bed": "1 Queen Bed", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Thames River View Deluxe Room", "size_sqm": 45, "bed": "1 King Bed + River View", "price_multiplier": 1.40, "cancellation": "Free cancellation"},
            {"name": "Edwardian Riverfront Suite", "size_sqm": 85, "bed": "1 King Bed + Butler Service", "price_multiplier": 2.50, "cancellation": "Free cancellation"}
        ],
        "sub_ratings": {"Cleanliness": 9.6, "Location": 9.9, "Staff": 9.6, "Comfort": 9.6, "Value for Money": 8.9},
        "seasonal_rates": {"High_Season": 1150, "Low_Season": 720, "Current": 890}
    },

    # 🇺🇸 New York, USA
    {
        "id": "NYC-001",
        "name": "The Plaza Hotel",
        "city": "New York",
        "country": "United States 🇺🇸",
        "stars": 5,
        "property_type": "Historic Palace",
        "rating": 9.3,
        "review_count": 4120,
        "rating_badge": "Superb ✨",
        "base_price_usd": 780,
        "discount_pct": 10,
        "original_price_usd": 865,
        "lat": 40.7644,
        "lon": -73.9744,
        "address": "768 5th Ave, Central Park South, New York",
        "distance_center_km": 0.1,
        "distance_airport_km": 22.0,
        "amenities": ["Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Fitness Center 🏋️", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Plaza King Room", "size_sqm": 44, "bed": "1 King Bed", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Central Park View Deluxe Suite", "size_sqm": 80, "bed": "1 King Bed + Central Park View", "price_multiplier": 1.80, "cancellation": "Free cancellation"}
        ],
        "sub_ratings": {"Cleanliness": 9.4, "Location": 9.9, "Staff": 9.3, "Comfort": 9.3, "Value for Money": 8.6},
        "seasonal_rates": {"High_Season": 1050, "Low_Season": 620, "Current": 780}
    },

    # 🇯🇵 Tokyo, Japan
    {
        "id": "TYO-001",
        "name": "Aman Tokyo",
        "city": "Tokyo",
        "country": "Japan 🇯🇵",
        "stars": 5,
        "property_type": "Luxury Resort",
        "rating": 9.7,
        "review_count": 1640,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 1100,
        "discount_pct": 10,
        "original_price_usd": 1220,
        "lat": 35.6865,
        "lon": 139.7640,
        "address": "Otemachi Tower, 1-5-6 Otemachi, Chiyoda, Tokyo",
        "distance_center_km": 0.5,
        "distance_airport_km": 18.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Deluxe King Premier Room", "size_sqm": 71, "bed": "1 King Bed + City Sky View", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Aman Panoramic Suite with Mt Fuji View", "size_sqm": 141, "bed": "1 King Bed + Living + Furo Bath", "price_multiplier": 2.10, "cancellation": "Free cancellation"}
        ],
        "sub_ratings": {"Cleanliness": 9.9, "Location": 9.8, "Staff": 9.9, "Comfort": 9.8, "Value for Money": 9.2},
        "seasonal_rates": {"High_Season": 1450, "Low_Season": 920, "Current": 1100}
    },

    # 🇲🇻 Maldives
    {
        "id": "MLE-001",
        "name": "Soneva Jani Overwater Resort",
        "city": "Maldives",
        "country": "Maldives 🇲🇻",
        "stars": 5,
        "property_type": "Overwater Villa",
        "rating": 9.9,
        "review_count": 1240,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 1850,
        "discount_pct": 20,
        "original_price_usd": 2300,
        "lat": 5.6888,
        "lon": 73.3421,
        "address": "Medhufaru Island, Noonu Atoll, Maldives",
        "distance_center_km": 0.0,
        "distance_airport_km": 40.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Airport Shuttle 🚐", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "1-Bedroom Water Retreat with Private Water Slide", "size_sqm": 411, "bed": "1 King Bed + Retractable Roof + Slide", "price_multiplier": 1.0, "cancellation": "Free cancellation until 14 days"},
            {"name": "2-Bedroom Water Reserve with Lagoon Slide", "size_sqm": 772, "bed": "2 King Beds + Catamaran Netting", "price_multiplier": 2.10, "cancellation": "Special Villa Terms"}
        ],
        "sub_ratings": {"Cleanliness": 9.9, "Location": 10.0, "Staff": 9.9, "Comfort": 10.0, "Value for Money": 9.5},
        "seasonal_rates": {"High_Season": 2600, "Low_Season": 1500, "Current": 1850}
    },

    # 🇹🇷 Istanbul, Turkey
    {
        "id": "IST-001",
        "name": "Çırağan Palace Kempinski",
        "city": "Istanbul",
        "country": "Turkey 🇹🇷",
        "stars": 5,
        "property_type": "Historic Palace",
        "rating": 9.5,
        "review_count": 3200,
        "rating_badge": "Exceptional 🌟",
        "base_price_usd": 540,
        "discount_pct": 15,
        "original_price_usd": 635,
        "lat": 41.0435,
        "lon": 29.0163,
        "address": "Çırağan Cd. No:32, Beşiktaş, Istanbul",
        "distance_center_km": 3.0,
        "distance_airport_km": 38.0,
        "amenities": ["Pool 🏊", "Spa & Wellness 🧖", "Free WiFi 📶", "Ocean / Landmark View 🌅", "Free Breakfast 🥐", "Fine Dining 🍽️"],
        "room_types": [
            {"name": "Superior Bosphorus View Room", "size_sqm": 38, "bed": "1 King Bed + Balcony", "price_multiplier": 1.0, "cancellation": "Free cancellation"},
            {"name": "Palace Suite with Private Butler", "size_sqm": 90, "bed": "1 King Bed + Historic Wing", "price_multiplier": 2.20, "cancellation": "Free cancellation"}
        ],
        "sub_ratings": {"Cleanliness": 9.6, "Location": 9.8, "Staff": 9.5, "Comfort": 9.6, "Value for Money": 9.1},
        "seasonal_rates": {"High_Season": 750, "Low_Season": 410, "Current": 540}
    }
]

class HotelsManager:
    """Queries, filters, and searches the global hotel catalog."""

    @staticmethod
    def get_destinations() -> List[str]:
        """Get unique destination cities."""
        cities = sorted(list(set(h["city"] for h in HOTELS_DATABASE)))
        return ["All Destinations 🌍"] + cities

    @staticmethod
    def filter_hotels(
        destination: str = "All Destinations 🌍",
        max_price_usd: float = 3000.0,
        min_stars: int = 4,
        property_type: str = "All Types",
        required_amenity: Optional[str] = None,
        search_query: str = ""
    ) -> List[Dict[str, Any]]:
        """Filter hotels by multiple criteria."""
        results = []
        q = search_query.strip().lower()

        for h in HOTELS_DATABASE:
            if destination != "All Destinations 🌍" and h["city"] != destination:
                continue
            if h["base_price_usd"] > max_price_usd:
                continue
            if h["stars"] < min_stars:
                continue
            if property_type != "All Types" and h["property_type"] != property_type:
                continue
            if required_amenity and required_amenity != "All Amenities" and required_amenity not in h["amenities"]:
                continue
            if q:
                search_text = f"{h['name']} {h['city']} {h['country']} {h['property_type']}".lower()
                if q not in search_text:
                    continue
            results.append(h)
        return results

    @staticmethod
    def get_hotel_by_id(hotel_id: str) -> Optional[Dict[str, Any]]:
        for h in HOTELS_DATABASE:
            if h["id"] == hotel_id:
                return h
        return None
