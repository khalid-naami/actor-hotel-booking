"""Apify Actor Entrypoint: Hotel Booking & Luxury Stay Intelligence."""

import asyncio
import os
import datetime
from apify import Actor
from src.hotels_database import HotelsManager, HOTELS_DATABASE
from src.booking_engine import BookingEngine
from src.currency_engine import CurrencyEngine

async def main() -> None:
    async with Actor:
        actor_input = await Actor.get_input() or {}
        destination = actor_input.get("destination", "All Destinations 🌍")
        max_price_usd = float(actor_input.get("maxPriceUsd", 2000))
        min_stars = int(actor_input.get("minStars", 4))
        property_type = actor_input.get("propertyType", "All Types")
        currency = actor_input.get("currency", "USD ($)")
        checkin_offset = int(actor_input.get("checkinDaysFromNow", 7))
        stay_nights = int(actor_input.get("stayNights", 3))
        search_query = actor_input.get("searchQuery", "")
        api_key = actor_input.get("apiKey") or os.getenv("APIFY_TOKEN") or os.getenv("API_KEY", "")

        Actor.log.info(
            f"Searching hotels in '{destination}' | Max Price: ${max_price_usd} | Min Stars: {min_stars}* | Currency: {currency}"
        )
        if api_key:
            Actor.log.info("API Key / Token authentication provided.")

        # Filter hotels matching criteria
        matching_hotels = HotelsManager.filter_hotels(
            destination=destination,
            max_price_usd=max_price_usd,
            min_stars=min_stars,
            property_type=property_type,
            search_query=search_query
        )

        Actor.log.info(f"Found {len(matching_hotels)} hotels matching criteria.")

        today = datetime.date.today()
        checkin = today + datetime.timedelta(days=checkin_offset)
        checkout = checkin + datetime.timedelta(days=stay_nights)

        records_to_push = []
        for hotel in matching_hotels:
            # Calculate quote for the primary room type
            primary_quote = BookingEngine.calculate_stay_quote(
                hotel=hotel,
                room_type_idx=0,
                checkin_date=checkin,
                checkout_date=checkout,
                num_rooms=1,
                currency_label=currency
            )

            # Build comprehensive output object
            record = {
                "id": hotel.get("id"),
                "name": hotel.get("name"),
                "city": hotel.get("city"),
                "country": hotel.get("country"),
                "stars": hotel.get("stars"),
                "property_type": hotel.get("property_type"),
                "rating": hotel.get("rating"),
                "review_count": hotel.get("review_count"),
                "rating_badge": hotel.get("rating_badge"),
                "address": hotel.get("address"),
                "lat": hotel.get("lat"),
                "lon": hotel.get("lon"),
                "distance_center_km": hotel.get("distance_center_km"),
                "amenities": hotel.get("amenities"),
                "base_price_usd_per_night": hotel.get("base_price_usd"),
                "base_price_converted": CurrencyEngine.format_price(hotel.get("base_price_usd", 0), currency),
                "room_types_available": [
                    {
                        "name": r.get("name"),
                        "size_sqm": r.get("size_sqm"),
                        "bed": r.get("bed"),
                        "cancellation": r.get("cancellation"),
                        "nightly_rate": CurrencyEngine.format_price(hotel.get("base_price_usd", 0) * r.get("price_multiplier", 1.0), currency)
                    }
                    for r in hotel.get("room_types", [])
                ],
                "sub_ratings": hotel.get("sub_ratings"),
                "sample_quote": {
                    "checkin": checkin.isoformat(),
                    "checkout": checkout.isoformat(),
                    "nights": stay_nights,
                    "room_name": primary_quote["selected_room_name"],
                    "nightly_rate": primary_quote["rate_per_night_formatted"],
                    "subtotal": primary_quote["subtotal_formatted"],
                    "taxes_and_fees": primary_quote["total_taxes_formatted"],
                    "grand_total": primary_quote["grand_total_formatted"],
                    "currency": currency
                }
            }
            records_to_push.append(record)

        if records_to_push:
            await Actor.push_data(records_to_push)
            Actor.log.info(f"Successfully pushed {len(records_to_push)} hotel records to Apify dataset.")

        # Save executive summary in Key-Value store for MCP tools & instant API payloads
        summary_payload = {
            "destination": destination,
            "totalMatchingHotels": len(matching_hotels),
            "currency": currency,
            "hotelOverview": [
                {
                    "name": h.get("name"),
                    "city": h.get("city"),
                    "stars": h.get("stars"),
                    "rating": h.get("rating"),
                    "pricePerNight": CurrencyEngine.format_price(h.get("base_price_usd", 0), currency)
                }
                for h in matching_hotels[:10]
            ]
        }
        await Actor.set_value("OUTPUT", summary_payload)
        Actor.log.info("Stored summary OUTPUT in Key-Value store.")

if __name__ == "__main__":
    asyncio.run(main())
