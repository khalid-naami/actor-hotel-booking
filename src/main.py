"""Apify Actor Entrypoint: Live Booking.com Hotel Search, Price Intelligence & OTA Data Extraction."""

import asyncio
import os
import datetime
import re
from apify import Actor
from src.hotels_database import HotelsManager, HOTELS_DATABASE
from src.booking_engine import BookingEngine
from src.currency_engine import CurrencyEngine
from src.booking_scraper import fetch_booking_hotels

async def main() -> None:
    async with Actor:
        actor_input = await Actor.get_input() or {}
        booking_url = actor_input.get("bookingUrl", "https://www.booking.com/city/fr/riom.fr.html")
        destination = actor_input.get("destination", "Riom")
        live_scrape = actor_input.get("liveScrape", True)
        max_price_usd = float(actor_input.get("maxPriceUsd", 2000))
        min_stars = int(actor_input.get("minStars", 3))
        property_type = actor_input.get("propertyType", "All Types")
        currency = actor_input.get("currency", "EUR (€)")
        checkin_offset = int(actor_input.get("checkinDaysFromNow", 7))
        stay_nights = int(actor_input.get("stayNights", 3))
        search_query = actor_input.get("searchQuery", "")
        api_key = actor_input.get("apiKey") or os.getenv("APIFY_TOKEN") or os.getenv("API_KEY", "")

        # Extract currency code for Booking.com (e.g. "EUR" from "EUR (€)")
        curr_code_match = re.search(r'([A-Z]{3})', currency)
        curr_code = curr_code_match.group(1) if curr_code_match else "EUR"

        Actor.log.info(
            f"Searching hotels for '{destination}' | Live Scrape: {live_scrape} | Currency: {currency} | Min Stars: {min_stars}*"
        )
        if api_key:
            Actor.log.info("API Key / Token authentication provided.")

        # If live scraping enabled, trigger Booking.com fetch
        if live_scrape:
            Actor.log.info(f"Connecting to Booking.com to scrape live hotel intelligence from: {booking_url or destination}...")
            try:
                live_hotels = HotelsManager.sync_live_booking(url_or_slug=booking_url or destination, currency=curr_code)
                Actor.log.info(f"Successfully scraped {len(live_hotels)} live hotels with HD images and ratings directly from Booking.com!")
            except Exception as e:
                Actor.log.warning(f"Live scrape fallback engaged due to: {e}")

        # Filter hotels matching criteria
        matching_hotels = HotelsManager.filter_hotels(
            destination=destination if destination != "All Destinations 🌍" else "All Destinations 🌍",
            max_price_usd=max_price_usd,
            min_stars=min_stars,
            property_type=property_type,
            search_query=search_query
        )

        # If no hotels found with strict filters, fallback to any available for destination
        if not matching_hotels and destination != "All Destinations 🌍":
            matching_hotels = [h for h in HOTELS_DATABASE if h.get("city", "").lower() == destination.lower()]

        Actor.log.info(f"Extracted {len(matching_hotels)} hotels matching criteria.")

        today = datetime.date.today()
        checkin = today + datetime.timedelta(days=checkin_offset)
        checkout = checkin + datetime.timedelta(days=stay_nights)

        records_to_push = []
        for hotel in matching_hotels:
            try:
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
                    "stars": hotel.get("stars", 3),
                    "property_type": hotel.get("property_type", "Hotel"),
                    "rating": hotel.get("rating"),
                    "review_count": hotel.get("review_count"),
                    "rating_badge": hotel.get("rating_badge"),
                    "address": hotel.get("address"),
                    "lat": hotel.get("lat"),
                    "lon": hotel.get("lon"),
                    "distance_center_km": hotel.get("distance_center_km"),
                    "amenities": hotel.get("amenities", []),
                    "base_price_usd_per_night": hotel.get("base_price_usd"),
                    "base_price_converted": CurrencyEngine.format_price(hotel.get("base_price_usd", 0), currency),
                    "image_url": hotel.get("image", ""),
                    "booking_url": hotel.get("booking_url", ""),
                    "description": hotel.get("description", ""),
                    "source": hotel.get("source", "Catalog"),
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
                    "sub_ratings": hotel.get("sub_ratings", {}),
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
            except Exception as item_err:
                Actor.log.warning(f"Error compiling hotel record for {hotel.get('name')}: {item_err}")

        if records_to_push:
            await Actor.push_data(records_to_push)
            Actor.log.info(f"Successfully pushed {len(records_to_push)} hotel records to Apify dataset.")

        # Save executive summary in Key-Value store for MCP tools & instant API payloads
        summary_payload = {
            "destination": destination,
            "totalMatchingHotels": len(records_to_push),
            "currency": currency,
            "bookingUrl": booking_url,
            "hotelOverview": [
                {
                    "name": h.get("name"),
                    "city": h.get("city"),
                    "stars": h.get("stars"),
                    "rating": h.get("rating"),
                    "pricePerNight": h.get("base_price_converted"),
                    "bookingUrl": h.get("booking_url")
                }
                for h in records_to_push[:12]
            ]
        }
        await Actor.set_value("OUTPUT", summary_payload)
        Actor.log.info("Stored summary OUTPUT in Key-Value store.")

if __name__ == "__main__":
    asyncio.run(main())
