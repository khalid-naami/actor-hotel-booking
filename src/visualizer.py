"""High-Impact Interactive Plotly Visualizations for Hotel Maps, Price Intelligence & Guest Ratings."""

from typing import Dict, List, Any, Optional
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from src.currency_engine import CurrencyEngine

PALETTE = {
    "bg": "#0e1117",
    "card_bg": "#1e222b",
    "text": "#e0e6ed",
    "primary": "#38bdf8",     # Sky Blue
    "secondary": "#f59e0b",   # Amber / Gold
    "accent": "#10b981",      # Emerald
    "danger": "#ef4444",      # Red
    "purple": "#a855f7",
    "grid": "#2a303c"
}

def create_hotels_map(hotels_list: List[Dict[str, Any]], currency_label: str = "USD ($)") -> go.Figure:
    """Create global interactive hotel map with prices, star ratings, and coordinates."""
    fig = go.Figure()
    if not hotels_list:
        return fig

    lats = [h["lat"] for h in hotels_list]
    lons = [h["lon"] for h in hotels_list]
    prices = [CurrencyEngine.format_price(h["base_price_usd"], currency_label) for h in hotels_list]
    stars = ["⭐" * h["stars"] for h in hotels_list]
    names = [h["name"] for h in hotels_list]
    cities = [f"{h['city']}, {h['country']}" for h in hotels_list]
    ratings = [f"{h['rating']}/10 ({h['rating_badge']})" for h in hotels_list]

    hover_texts = [
        f"🏨 <b>{name}</b> ({star})<br>"
        f"📍 {city}<br>"
        f"⭐ Rating: <b>{rating}</b> ({h['review_count']} reviews)<br>"
        f"💵 From: <b>{price} / night</b><br>"
        f"🏖️ Type: {h['property_type']}"
        for name, star, city, rating, price, h in zip(names, stars, cities, ratings, prices, hotels_list)
    ]

    fig.add_trace(go.Scattergeo(
        lon=lons,
        lat=lats,
        mode="markers+text",
        text=prices,
        textposition="top center",
        textfont=dict(color="#f59e0b", size=11, family="Inter, sans-serif"),
        marker=dict(
            size=14,
            color=[h["base_price_usd"] for h in hotels_list],
            colorscale="Viridis",
            colorbar=dict(title="Rate (USD)", x=1.02, len=0.6),
            symbol="star",
            line=dict(width=1.5, color="#ffffff"),
            opacity=0.95
        ),
        hovertext=hover_texts,
        hoverinfo="text",
        name="Hotels & Resorts"
    ))

    fig.update_geos(
        projection_type="natural earth",
        showland=True,
        landcolor="#1a202c",
        showocean=True,
        oceancolor="#0c1017",
        showlakes=True,
        lakecolor="#0c1017",
        showcountries=True,
        countrycolor="#334155",
        coastlinecolor="#475569",
        bgcolor=PALETTE["bg"]
    )

    fig.update_layout(
        template="plotly_dark",
        plot_bgcolor=PALETTE["bg"],
        paper_bgcolor=PALETTE["bg"],
        height=620,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
        margin=dict(l=10, r=10, t=30, b=10)
    )
    return fig

def create_guest_ratings_radar(sub_ratings: Dict[str, float], hotel_name: str) -> go.Figure:
    """Radar Chart showing detailed guest review scores across 5 hospitality pillars."""
    categories = list(sub_ratings.keys())
    values = list(sub_ratings.values())

    # Close loop on radar
    categories.append(categories[0])
    values.append(values[0])

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill="toself",
        name="Guest Sub-Score",
        fillcolor="rgba(245, 158, 11, 0.25)",
        line=dict(color="#f59e0b", width=2.5)
    ))

    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[7.0, 10.0], gridcolor=PALETTE["grid"]),
            angularaxis=dict(gridcolor=PALETTE["grid"])
        ),
        template="plotly_dark",
        plot_bgcolor=PALETTE["bg"],
        paper_bgcolor=PALETTE["bg"],
        title=f"🎯 Guest Satisfaction Radar: {hotel_name}",
        height=350,
        margin=dict(l=40, r=40, t=50, b=30)
    )
    return fig

def create_seasonal_price_chart(seasonal_rates: Dict[str, float], hotel_name: str, currency_label: str = "USD ($)") -> go.Figure:
    """Bar chart comparing High Season vs Current Rate vs Low Season potential savings."""
    fig = go.Figure()
    labels = ["Low Season (Best Value) 🟢", "Current Live Rate ⚡", "High Peak Season 🏖️"]
    usd_vals = [
        seasonal_rates.get("Low_Season", 400),
        seasonal_rates.get("Current", 550),
        seasonal_rates.get("High_Season", 750)
    ]
    formatted_vals = [CurrencyEngine.convert_amount(v, currency_label) for v in usd_vals]
    colors = ["#10b981", "#38bdf8", "#ef4444"]

    fig.add_trace(go.Bar(
        x=labels,
        y=formatted_vals,
        marker_color=colors,
        text=[CurrencyEngine.format_price(v, currency_label) for v in usd_vals],
        textposition="outside"
    ))

    fig.update_layout(
        title=f"📊 Seasonal Price Intelligence & Potential Savings ({hotel_name})",
        template="plotly_dark",
        plot_bgcolor=PALETTE["bg"],
        paper_bgcolor=PALETTE["bg"],
        yaxis=dict(title=f"Price per Night ({currency_label})", gridcolor=PALETTE["grid"]),
        margin=dict(l=40, r=40, t=60, b=30),
        height=350
    )
    return fig
