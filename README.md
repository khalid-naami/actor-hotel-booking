# 🏨 Booking.com Ultimate Scraper (Hotels, Live Prices, Reviews & Rooms)

High-speed, all-in-one **Booking.com** hotel data extraction and market intelligence engine on Apify. Extract **Live Hotel Pricing** across multiple currencies, **Real-time Availability**, **Review Scores & Category Subscores** (Cleanliness, Staff, WiFi, Location), **Precise GPS Coordinates**, **Room Types & Bed Configurations**, **Free Cancellation & Breakfast Badges**, and **HD Image Galleries** by destination keyword or direct hotel URLs.

---

## ⚡ Key Features

- 🌍 **Search by Any Destination**: Search any city, region, island, or landmark worldwide (e.g. *Paris*, *Dubai*, *New York*, *London*, *Tokyo*, *Makkah*) with automatic pagination.
- 💵 **Live Real-Time Pricing Across Currencies**: Extracts current live rates for specific check-in and check-out dates in your preferred currency (`USD`, `EUR`, `GBP`, `AED`, `SAR`, `CAD`, `AUD`, `JPY`, `CNY`, etc.).
- ⭐ **Deep Review Intelligence & Subscores**: Overall review score (0–10 scale), review descriptions (*Superb*, *Fabulous*, *Very Good*), total review counts, and category subscores (*Cleanliness*, *Staff*, *Location*, *Comfort*, *Value for Money*).
- 🏷️ **Booking Badges & Policies**: Automatically detects **Free Cancellation**, **No Prepayment Needed**, and **Breakfast Included** deals.
- 📍 **Precise Location & Geodata**: Extracts full street addresses, distance from city center, and exact GPS coordinates (Latitude & Longitude) for GIS mapping.
- 🖼️ **High-Resolution Photo Galleries**: Automatically upgrades low-res thumbnails to crisp, high-resolution original image URLs (`max1280x900`).
- 🛏️ **Room & Accommodation Details**: Room titles, unit types (*Deluxe*, *Suite*, *Standard*), and capacity specs.
- 🛡️ **Anti-Blocking Architecture**: High-speed HTTP requests via `got-scraping` paired with an intelligent Playwright browser fallback and Apify Residential Proxy integration.

---

## 📥 Input Configuration

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `destination` | String | `"Paris"` | City, landmark, or region to search on Booking.com. |
| `hotelUrls` | Array | `[]` | Optional list of specific Booking.com hotel URLs to scrape directly. |
| `checkin` | String | `""` | Arrival date in `YYYY-MM-DD` format (defaults to 7 days from today). |
| `checkout` | String | `""` | Departure date in `YYYY-MM-DD` format (defaults to checkin + stayNights). |
| `stayNights` | Integer | `3` | Number of nights when checkout date is omitted. |
| `adults` | Integer | `2` | Number of adult guests. |
| `children` | Integer | `0` | Number of children staying. |
| `rooms` | Integer | `1` | Number of rooms required. |
| `currency` | String | `"USD"` | Preferred currency (`USD`, `EUR`, `GBP`, `AED`, `SAR`, etc.). |
| `minRating` | Number | `0` | Filter hotels by minimum overall score (e.g. `8.0` for Very Good). |
| `minStars` | Integer | `0` | Filter hotels by minimum star rating (`1` to `5` stars). |
| `sortBy` | String | `"popularity"` | Sort order: `popularity`, `price_asc`, `review_score`, `distance`. |
| `maxHotels` | Integer | `50` | Maximum number of hotel properties to extract. |
| `proxyConfiguration` | Object | `{ useApifyProxy: true }` | Apify Residential proxy configuration (recommended). |

---

## 📤 Output Data Format

### 🏨 Complete Hotel Record

```json
{
  "type": "HOTEL",
  "id": "le-chatelet-paris",
  "name": "Hôtel Le Châtelet Paris Centre",
  "url": "https://www.booking.com/hotel/fr/le-chatelet-paris.html",
  "destination": "Paris",
  "price": "$ 680",
  "priceNumeric": 680,
  "currency": "USD",
  "pricePerNight": 227,
  "nights": 3,
  "checkin": "2026-12-01",
  "checkout": "2026-12-04",
  "rating": 8.9,
  "ratingText": "Fabulous",
  "reviewsCount": 2450,
  "stars": 4,
  "address": "12 Rue de Rivoli, 4th arr., 75004 Paris, France",
  "distanceFromCenter": "0.3 km from center",
  "hasFreeCancellation": true,
  "isBreakfastIncluded": true,
  "noPrepayment": true,
  "roomType": "Deluxe Double Room with City View",
  "imageUrl": "https://cf.bstatic.com/xdata/images/hotel/max1280x900/123456789.jpg",
  "scrapedAt": "2026-11-09T13:00:00.000Z"
}
```

---

## 💼 Business & Market Intelligence Use Cases

- **Dynamic Pricing & Revenue Management**: Hoteliers and Airbnb hosts can track competitor room rates in real time to optimize their own ADR (Average Daily Rate) and RevPAR.
- **OTA & Travel Tech Applications**: Power travel aggregation platforms, price comparison engines, and mobile booking guides with live hotel inventories.
- **Hospitality Feasibility & Investment**: Evaluate hotel acquisition opportunities by calculating average room yields and guest satisfaction benchmarks.
- **Reputation & Review Sentiment**: Monitor subscores in cleanliness, service, and facilities across competing hotel chains.

---

## 📄 License
Apache-2.0
