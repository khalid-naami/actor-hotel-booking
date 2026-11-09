/**
 * Booking.com Ultimate Scraper - Extractors & Parsers
 * High-precision parsing for Search Results, Property Cards, Hotel Detail Pages, Prices & Reviews.
 */

// Format Date to YYYY-MM-DD
export function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Calculate default Check-in and Check-out dates
export function resolveStayDates(checkinInput, checkoutInput, stayNights = 3) {
    let checkin = checkinInput ? checkinInput.trim() : '';
    let checkout = checkoutInput ? checkoutInput.trim() : '';

    if (!checkin) {
        const d = new Date();
        d.setDate(d.getDate() + 7); // Default to 7 days from today
        checkin = formatDate(d);
    }

    if (!checkout) {
        const d = new Date(checkin);
        d.setDate(d.getDate() + (stayNights > 0 ? stayNights : 3));
        checkout = formatDate(d);
    }

    const start = new Date(checkin);
    const end = new Date(checkout);
    const diffTime = Math.abs(end - start);
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return { checkin, checkout, nights };
}

// Clean and extract numeric price from formatted string
export function parsePrice(priceStr) {
    if (!priceStr) return { formatted: null, numeric: 0 };
    const str = String(priceStr).replace(/&nbsp;/g, ' ').trim();
    const numericStr = str.replace(/[^\d.,]/g, '').replace(/,/g, '');
    const numeric = parseFloat(numericStr);
    return {
        formatted: str,
        numeric: isNaN(numeric) ? 0 : Math.round(numeric)
    };
}

// Parse review count from text (e.g. "1,245 reviews", "340 avis")
export function parseReviewCount(text) {
    if (!text) return 0;
    const match = String(text).replace(/&nbsp;/g, ' ').match(/([\d,\s]+)/);
    if (match) {
        const num = parseInt(match[1].replace(/[^\d]/g, ''), 10);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}

// Convert thumbnail image URL into high-resolution version
export function getHdImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    return url
        .replace(/max\d+x\d+/i, 'max1280x900')
        .replace(/\/square\d+\//i, '/max1280x900/')
        .replace(/max300/i, 'max1024x768')
        .replace(/max500/i, 'max1280x900');
}

// Extract JSON-LD blocks from HTML
export function extractJsonLd(html) {
    if (!html) return [];
    const blocks = [];
    const regex = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) blocks.push(...parsed);
            else blocks.push(parsed);
        } catch (_) {}
    }
    return blocks;
}

// Parse Search Results Page HTML for Property Cards
export function parseSearchResultsHtml(html, destination, searchParams = {}) {
    if (!html) return [];
    const hotels = [];

    // Match each property card container
    const cardBlocks = html.split(/data-testid="property-card"/gi);

    for (let i = 1; i < cardBlocks.length; i++) {
        const block = cardBlocks[i];

        // 1. Title & URL
        const titleMatch = block.match(/data-testid="title"[^>]*>([\s\S]*?)<\/div>/i);
        const name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        if (!name) continue;

        const linkMatch = block.match(/href="([^"]*hotel\/[^"]*)"/i)
            || block.match(/data-testid="title-link"[^>]*href="([^"]*)"/i);
        let url = linkMatch ? linkMatch[1].split('?')[0] : '';
        if (url && !url.startsWith('http')) {
            url = `https://www.booking.com${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const idMatch = url.match(/\/hotel\/[a-z]{2}\/([a-zA-Z0-9_-]+)/i);
        const hotelId = idMatch ? idMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // 2. Price
        const priceMatch = block.match(/data-testid="price-and-discounted-price"[^>]*>([\s\S]*?)<\/span>/i)
            || block.match(/data-testid="price"[^>]*>([\s\S]*?)<\/span>/i);
        const rawPrice = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        const { formatted: price, numeric: priceNumeric } = parsePrice(rawPrice);

        const nights = searchParams.nights || 1;
        const pricePerNight = priceNumeric > 0 ? Math.round(priceNumeric / nights) : 0;

        // 3. Rating & Reviews
        let rating = null;
        let ratingText = '';
        let reviewsCount = 0;

        const scoreMatch = block.match(/data-testid="review-score"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
        if (scoreMatch) {
            const scoreText = scoreMatch[1];
            const numMatch = scoreText.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                rating = parseFloat(numMatch[1].replace(',', '.'));
            }

            const descMatch = scoreText.match(/(Superb|Fabulous|Very Good|Good|Pleasant|Wonderful|Exceptional|Review score)/i);
            if (descMatch) {
                ratingText = descMatch[1];
            }

            const countMatch = scoreText.match(/([\d,\s]+)\s*(?:reviews|avis|Bewertungen|المراجعات)/i);
            if (countMatch) {
                reviewsCount = parseReviewCount(countMatch[1]);
            }
        }

        // 4. Address & Distance
        const addressMatch = block.match(/data-testid="address"[^>]*>([\s\S]*?)<\/span>/i);
        const address = addressMatch ? addressMatch[1].replace(/<[^>]+>/g, '').trim() : destination;

        const distanceMatch = block.match(/data-testid="distance"[^>]*>([\s\S]*?)<\/span>/i);
        const distanceFromCenter = distanceMatch ? distanceMatch[1].replace(/<[^>]+>/g, '').trim() : null;

        // 5. Stars (Count number of star icons or read aria-label)
        let stars = null;
        const starsAriaMatch = block.match(/aria-label="(\d)-star/i);
        if (starsAriaMatch) {
            stars = parseInt(starsAriaMatch[1], 10);
        } else {
            const starSvgCount = (block.match(/data-testid="rating-stars"/gi) || []).length;
            if (starSvgCount > 0) stars = starSvgCount;
        }

        // 6. Badges (Free Cancellation, Breakfast, No Prepayment)
        const lowerBlock = block.toLowerCase();
        const hasFreeCancellation = Boolean(
            lowerBlock.includes('free cancellation') ||
            lowerBlock.includes('annulation gratuite') ||
            lowerBlock.includes('kostenlose stornierung')
        );

        const isBreakfastIncluded = Boolean(
            lowerBlock.includes('breakfast included') ||
            lowerBlock.includes('petit-déjeuner compris') ||
            lowerBlock.includes('frühstück inbegriffen')
        );

        const noPrepayment = Boolean(
            lowerBlock.includes('no prepayment') ||
            lowerBlock.includes('sans prépaiement') ||
            lowerBlock.includes('keine vorauszahlung')
        );

        // 7. Room Type
        const roomMatch = block.match(/data-testid="recommended-units"[^>]*>([\s\S]*?)<\/div>/i);
        const roomType = roomMatch ? roomMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;

        // 8. Image URL (HD)
        const imgMatch = block.match(/<img[^>]+data-testid="image"[^>]+src="([^"]*)"/i)
            || block.match(/<img[^>]+src="([^"]*cf\.bstatic\.com[^"]*)"/i);
        const rawImgUrl = imgMatch ? imgMatch[1] : null;
        const imageUrl = getHdImageUrl(rawImgUrl);

        // Filter checks if requested
        if (searchParams.minRating && rating && rating < searchParams.minRating) continue;
        if (searchParams.minStars && stars && stars < searchParams.minStars) continue;

        hotels.push({
            type: 'HOTEL',
            id: hotelId,
            name,
            url,
            destination: destination || address,
            price: price || (priceNumeric > 0 ? `${searchParams.currency || '$'} ${priceNumeric}` : 'Price on request'),
            priceNumeric,
            currency: searchParams.currency || 'USD',
            pricePerNight,
            nights,
            checkin: searchParams.checkin,
            checkout: searchParams.checkout,
            rating: rating || null,
            ratingText: ratingText || null,
            reviewsCount: reviewsCount || 0,
            stars: stars || null,
            address,
            distanceFromCenter,
            hasFreeCancellation,
            isBreakfastIncluded,
            noPrepayment,
            roomType,
            imageUrl,
            scrapedAt: new Date().toISOString()
        });
    }

    return hotels;
}

// Parse Individual Hotel Details Page
export function parseHotelDetailPage(html, url, searchParams = {}) {
    if (!html) return null;

    const jsonLds = extractJsonLd(html);
    const hotelLd = jsonLds.find(j => j['@type'] === 'Hotel' || j['@type'] === 'LodgingBusiness' || j['@type'] === 'Resort') || {};

    const name = hotelLd.name
        || html.match(/<h2[^>]*class="[^"]*pp-header__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.trim()
        || html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1]?.replace(/\|.*$/gi, '').trim()
        || '';

    const idMatch = url.match(/\/hotel\/[a-z]{2}\/([a-zA-Z0-9_-]+)/i);
    const hotelId = idMatch ? idMatch[1] : (hotelLd.name ? hotelLd.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'hotel');

    const description = hotelLd.description
        || html.match(/id="property_description_content"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        || html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1]
        || '';

    // Coordinates
    let latitude = hotelLd.geo?.latitude ? parseFloat(hotelLd.geo.latitude) : null;
    let longitude = hotelLd.geo?.longitude ? parseFloat(hotelLd.geo.longitude) : null;

    if (!latitude) {
        const coordMatch = html.match(/data-atlas-latlng="([^"]+)"/i);
        if (coordMatch) {
            const parts = coordMatch[1].split(',');
            latitude = parseFloat(parts[0]);
            longitude = parseFloat(parts[1]);
        }
    }

    // Address & Location
    let address = '';
    let city = '';
    let country = '';

    if (hotelLd.address) {
        const a = hotelLd.address;
        address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean).join(', ');
        city = a.addressLocality || '';
        country = a.addressCountry || '';
    }

    if (!address) {
        const addrMatch = html.match(/class="hp_address_subtitle[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        if (addrMatch) address = addrMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Rating & Score
    let rating = hotelLd.aggregateRating?.ratingValue ? parseFloat(hotelLd.aggregateRating.ratingValue) : null;
    let reviewsCount = hotelLd.aggregateRating?.reviewCount ? parseInt(hotelLd.aggregateRating.reviewCount, 10) : 0;

    // Review Subscores (Cleanliness, Staff, WiFi, etc.)
    const reviewSubscores = {};
    const subscoreRegex = /class="[^"]*c-score-bar__title[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?class="[^"]*c-score-bar__score[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    let subMatch;
    while ((subMatch = subscoreRegex.exec(html)) !== null) {
        const label = subMatch[1].replace(/<[^>]+>/g, '').trim();
        const score = parseFloat(subMatch[2].replace(/<[^>]+>/g, '').trim());
        if (label && !isNaN(score)) {
            reviewSubscores[label] = score;
        }
    }

    // Popular Facilities
    const facilities = [];
    const facRegex = /class="[^"]*hotel-facilities-group__item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let facMatch;
    while ((facMatch = facRegex.exec(html)) !== null) {
        const fText = facMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (fText && !facilities.includes(fText)) {
            facilities.push(fText);
        }
    }

    // Images Gallery (High-Res)
    const imageUrls = [];
    const imgRegex = /href="([^"]*cf\.bstatic\.com[^"]*)"/gi;
    let iMatch;
    while ((iMatch = imgRegex.exec(html)) !== null) {
        const hdUrl = getHdImageUrl(iMatch[1]);
        if (hdUrl && !imageUrls.includes(hdUrl) && imageUrls.length < 20) {
            imageUrls.push(hdUrl);
        }
    }

    const coverImageUrl = imageUrls[0] || getHdImageUrl(hotelLd.image) || null;

    // Star Rating
    let stars = null;
    const starsMatch = html.match(/aria-label="(\d)-star/i) || html.match(/class="[^"]*f-star-rating[^"]*"[^>]*data-star="(\d)"/i);
    if (starsMatch) stars = parseInt(starsMatch[1], 10);

    return {
        type: 'HOTEL',
        id: hotelId,
        name,
        url,
        description,
        address: address || hotelLd.address?.streetAddress || '',
        city,
        country,
        latitude,
        longitude,
        rating,
        reviewsCount,
        reviewSubscores: Object.keys(reviewSubscores).length > 0 ? reviewSubscores : undefined,
        stars,
        facilities: facilities.length > 0 ? facilities : undefined,
        imageUrl: coverImageUrl,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        scrapedAt: new Date().toISOString()
    };
}
