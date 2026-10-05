"""Booking Calculation Engine, Tax Computation & Instant Confirmation Voucher Generator."""

import random
import datetime
from typing import Dict, Any, List
from src.currency_engine import CurrencyEngine

class BookingEngine:
    """Calculates reservations, taxes, room pricing, and produces confirmation vouchers."""

    @staticmethod
    def calculate_stay_quote(
        hotel: Dict[str, Any],
        room_type_idx: int,
        checkin_date: datetime.date,
        checkout_date: datetime.date,
        num_rooms: int = 1,
        currency_label: str = "USD ($)"
    ) -> Dict[str, Any]:
        """Compute comprehensive quote breakdown with nights, taxes, and service fees."""
        num_nights = max(1, (checkout_date - checkin_date).days)
        
        rooms_list = hotel.get("room_types", [])
        if room_type_idx < len(rooms_list):
            selected_room = rooms_list[room_type_idx]
        else:
            selected_room = rooms_list[0] if rooms_list else {"name": "Standard Room", "price_multiplier": 1.0}

        base_rate_usd_per_night = hotel["base_price_usd"] * selected_room.get("price_multiplier", 1.0)
        subtotal_usd = base_rate_usd_per_night * num_nights * num_rooms

        # Taxes & Fees: 10% VAT + 3% Service Charge + $5 City Tourism Tax / room / night
        vat_usd = subtotal_usd * 0.10
        service_usd = subtotal_usd * 0.03
        city_tax_usd = 5.0 * num_nights * num_rooms
        total_taxes_usd = vat_usd + service_usd + city_tax_usd
        grand_total_usd = subtotal_usd + total_taxes_usd

        return {
            "num_nights": num_nights,
            "num_rooms": num_rooms,
            "selected_room_name": selected_room["name"],
            "room_details": selected_room,
            "rate_per_night_usd": base_rate_usd_per_night,
            "subtotal_usd": subtotal_usd,
            "vat_usd": vat_usd,
            "service_usd": service_usd,
            "city_tax_usd": city_tax_usd,
            "total_taxes_usd": total_taxes_usd,
            "grand_total_usd": grand_total_usd,
            # Formatted in User's Selected Currency
            "rate_per_night_formatted": CurrencyEngine.format_price(base_rate_usd_per_night, currency_label),
            "subtotal_formatted": CurrencyEngine.format_price(subtotal_usd, currency_label),
            "total_taxes_formatted": CurrencyEngine.format_price(total_taxes_usd, currency_label),
            "grand_total_formatted": CurrencyEngine.format_price(grand_total_usd, currency_label)
        }

    @staticmethod
    def generate_booking_voucher(
        hotel: Dict[str, Any],
        quote: Dict[str, Any],
        guest_name: str,
        guest_email: str,
        guest_phone: str,
        special_requests: str = "None"
    ) -> Dict[str, Any]:
        """Produce official digital confirmation voucher."""
        ref_code = f"BKG-{random.randint(10000, 99999)}-{hotel['city'][:3].upper()}"
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return {
            "booking_reference": ref_code,
            "booking_timestamp": now_str,
            "status": "CONFIRMED & GUARANTEED 🟢",
            "hotel_name": hotel["name"],
            "hotel_address": hotel["address"],
            "hotel_stars": "⭐" * hotel["stars"],
            "guest_name": guest_name,
            "guest_email": guest_email,
            "guest_phone": guest_phone,
            "room_type": quote["selected_room_name"],
            "num_nights": quote["num_nights"],
            "num_rooms": quote["num_rooms"],
            "grand_total_formatted": quote["grand_total_formatted"],
            "cancellation_policy": quote["room_details"].get("cancellation", "Free Cancellation"),
            "special_requests": special_requests or "None",
            "checkin_policy": "Check-in from 15:00 | Check-out until 12:00"
        }
