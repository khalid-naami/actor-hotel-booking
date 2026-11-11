import { load } from 'cheerio';

/**
 * Booking.com Ultimate Scraper - Extractors & Parsers
 * Cheerio DOM extraction for Booking.com Search Results, Property Cards, Hotel Detail Pages,
 * AWS WAF / Bot Block Detection, Prices, Ratings & Stay Dates.
 */

export function cleanInputString(raw, fallback = '') {
    if (!raw || typeof raw !== 'string') return fallback;
    const cleaned = raw.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
    return cleaned || fallback;
}

function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

// Format Date to YYYY-MM-DD (UTC)
export function formatDate(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseIsoDateUtc(str) {
    if (!str || typeof str !== 'string') return null;
    const cleaned = cleanInputString(str);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return null;
    const d = new Date(`${cleaned}T00:00:00Z`);
    if (isNaN(d.getTime())) return null;
    // Verify calendar rollover did not occur (e.g. 2026-02-31)
    if (formatDate(d) !== cleaned) return null;
    return d;
}

// Calculate and validate Check-in / Check-out dates
export function resolveStayDates(checkinInput, checkoutInput, stayNights = 3) {
    const safeNights = (Number.isFinite(Number(stayNights)) && Number(stayNights) >= 1)
        ? Math.min(30, Math.round(Number(stayNights)))
        : 3;

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let dateAdjusted = false;
    let start = parseIsoDateUtc(checkinInput);

    if (!start) {
        if (cleanInputString(checkinInput)) dateAdjusted = true;
        start = new Date(todayUtc.getTime());
        start.setUTCDate(start.getUTCDate() + 7);
    } else if (start < todayUtc) {
        // Booking.com rejects past check-in dates; advance cleanly
        dateAdjusted = true;
        start = new Date(todayUtc.getTime());
        start.setUTCDate(start.getUTCDate() + 7);
    }

    let end = parseIsoDateUtc(checkoutInput);
    if (!end || end <= start) {
        if (cleanInputString(checkoutInput)) dateAdjusted = true;
        end = new Date(start.getTime());
        end.setUTCDate(end.getUTCDate() + safeNights);
    }

    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const nights = Math.max(1, diffDays);

    return {
        checkin: formatDate(start),
        checkout: formatDate(end),
        nights,
        dateAdjusted,
    };
}

// Clean and extract numeric price from formatted international string
export function parsePrice(priceStr) {
    if (!priceStr) return { formatted: null, numeric: 0 };
    const str = String(priceStr).replace(/\u00a0|\u202f|&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

    const numMatch = str.match(/\d[\d.,\s]*/);
    if (!numMatch) return { formatted: str, numeric: 0 };

    const compact = numMatch[0].replace(/\s+/g, '');
    let numeric = 0;

    // Check if trailing separator is decimal (.50 or ,50) vs 3-digit thousands (.245 or ,245)
    const decimalMatch = compact.match(/^([\d.,]+)[.,](\d{1,2})$/);
    if (decimalMatch) {
        const intPart = decimalMatch[1].replace(/[.,]/g, '');
        numeric = parseFloat(`${intPart}.${decimalMatch[2]}`);
    } else {
        const digitsOnly = compact.replace(/[.,]/g, '');
        numeric = parseFloat(digitsOnly);
    }

    return {
        formatted: str,
        numeric: Number.isFinite(numeric) ? Math.round(numeric) : 0,
    };
}

// Parse review count from text (avoids merging preceding review score like "8.9 2,450 reviews")
export function parseReviewCount(text) {
    if (!text) return 0;
    const normalized = String(text).replace(/\u00a0|\u202f|&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

    const labelledMatch = normalized.match(
        /(?:^|[^\d.])(\d{1,3}(?:[.,\s]\d{3})+|\d{1,6})\s*(?:real\s+guests?\s+|external\s+|verified\s+)?(?:reviews?|avis|bewertungen|opiniones|recensioni|beoordelingen|kommentarer|تقييم(?:ات)?|مراجع(?:ة|ات))/i
    );
    if (labelledMatch) {
        const num = parseInt(labelledMatch[1].replace(/[^\d]/g, ''), 10);
        return Number.isFinite(num) ? num : 0;
    }

    return 0;
}

// Convert thumbnail image URL into high-resolution version
export function getHdImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();
    if (!/^https?:\/\//i.test(clean) && !clean.startsWith('//')) return null;
    const fullUrl = clean.startsWith('//') ? `https:${clean}` : clean;
    return fullUrl
        .replace(/max\d+x\d+/i, 'max1280x900')
        .replace(/\/square\d+\//i, '/max1280x900/')
        .replace(/square\d+/i, 'max1280x900')
        .replace(/max300/i, 'max1024x768')
        .replace(/max500/i, 'max1280x900');
}

// Parse Playwright proxy configuration into { server, username, password }
export function parsePlaywrightProxy(proxyUrl) {
    if (!proxyUrl) return undefined;
    try {
        const u = new URL(proxyUrl);
        const proxy = {
            server: `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`,
        };
        if (u.username) proxy.username = decodeURIComponent(u.username);
        if (u.password) proxy.password = decodeURIComponent(u.password);
        return proxy;
    } catch {
        return { server: proxyUrl };
    }
}

function normalizeBookingUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
        const parsed = new URL(rawUrl.trim(), 'https://www.booking.com');
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        const trimmed = rawUrl.split('?')[0].trim();
        if (!trimmed) return '';
        return trimmed.startsWith('http')
            ? trimmed
            : `https://www.booking.com${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    }
}

function getCardElements($) {
    let $cards = $('[data-testid="property-card"]');
    if (!$cards.length) {
        $cards = $('[data-testid="property-card-container"]');
    }
    if (!$cards.length) {
        $cards = $('#hotellist_inner .sr_property_block');
    }
    return $cards;
}

export function countPropertyCards(html = '') {
    if (!html || typeof html !== 'string') return 0;
    const $ = load(html);
    return getCardElements($).length;
}

/**
 * Detect Booking.com AWS WAF challenges (HTTP 202), PerimeterX/Cloudflare CAPTCHAs,
 * HTTP blocks, or empty/non-SERP shells. Avoids false positives when real cards are present.
 */
export function detectBookingBlock(html = '', finalUrl = '', statusCode = 200, headers = {}) {
    const htmlStr = String(html || '');
    const urlLower = String(finalUrl || '').toLowerCase();
    const location = String(headers?.location || headers?.Location || '').trim();
    const wafAction = String(headers?.['x-amzn-waf-action'] || headers?.['X-Amzn-Waf-Action'] || '').trim();
    const title = htmlStr.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';

    const $ = load(htmlStr);
    const cardsCount = getCardElements($).length;
    const hasHotelDetail = $('h2.pp-header__title, #hp_hotel_name, [data-testid="PropertyHeaderTitle"], #hotelTmpl, [data-testid="availability-cta"]').length > 0;
    const hasValidPageContent = cardsCount > 0 || hasHotelDetail;

    const diagnostics = {
        statusCode,
        finalUrl: String(finalUrl || ''),
        ...(location ? { location } : {}),
        ...(wafAction ? { wafAction } : {}),
        htmlLength: htmlStr.length,
        cardsCount,
        ...(title ? { title } : {}),
    };

    if (hasValidPageContent && statusCode < 400) {
        return { blocked: false, diagnostics };
    }

    const hasWafDom = $('script[src*="awswaf"], script[src*="challenge.js"], #challenge-container').length > 0;
    const hasPxDom = $('#px-captcha, [id*="px-captcha"], script[src*="perimeterx"]').length > 0;
    const hasCaptchaDom = $('form[action*="captcha"], iframe[src*="captcha"], [data-testid="captcha"]').length > 0;
    const hasWafPayload = !hasValidPageContent && /awswaf|token\.awswaf\.com|AwsWafIntegration|gokuProps/i.test(htmlStr);

    $('script, style, noscript').remove();
    const visibleText = $('body').text().replace(/\s+/g, ' ').trim();

    // 1. AWS WAF JS challenge (very common HTTP 202 from Booking.com on datacenter/raw HTTP requests)
    if (statusCode === 202 || wafAction || hasWafDom || hasWafPayload) {
        return {
            blocked: true,
            reason: 'AWS_WAF',
            message: `Booking.com returned an AWS WAF challenge (${wafAction || `HTTP ${statusCode}`})`,
            diagnostics,
        };
    }

    // 2. CAPTCHA / PerimeterX / bot gate
    if (
        hasPxDom
        || hasCaptchaDom
        || urlLower.includes('/captcha')
        || /verify you are human|complete the security check|bot protection|unusual activity/i.test(visibleText)
    ) {
        return {
            blocked: true,
            reason: 'CAPTCHA',
            message: 'Booking.com gated this IP with a CAPTCHA / anti-bot verification',
            diagnostics,
        };
    }

    // 3. Cloudflare / Turnstile challenge
    if (/just a moment|attention required|cf-turnstile/i.test(`${title} ${visibleText}`)) {
        return {
            blocked: true,
            reason: 'CLOUDFLARE',
            message: 'Booking.com returned a Cloudflare/Turnstile challenge',
            diagnostics,
        };
    }

    // 4. HTTP error status
    if (statusCode === 403 || statusCode === 429 || statusCode >= 500) {
        return {
            blocked: true,
            reason: 'HTTP_ERROR',
            message: `Booking.com returned HTTP ${statusCode}`,
            diagnostics,
        };
    }

    // 5. Redirect without final target content
    if (statusCode >= 300 && statusCode < 400 && location) {
        return {
            blocked: true,
            reason: 'REDIRECT',
            message: `Booking.com returned HTTP ${statusCode} redirect to ${location}`,
            diagnostics,
        };
    }

    // 6. Check legitimate zero-properties-found search page vs empty/challenge response
    const isSearchShell = $('#search_results_table, [data-testid="search-results-list"], #bodyconstraint, [data-testid="header-booking-logo"]').length > 0;
    const isZeroResultsMsg = /0 properties found|no properties found|no exact matches|couldn.?t find any properties/i.test(visibleText);

    if (statusCode === 200 && isSearchShell && isZeroResultsMsg) {
        return {
            blocked: false,
            emptySearch: true,
            diagnostics,
        };
    }

    if (htmlStr.length < 15000 || !isSearchShell) {
        return {
            blocked: true,
            reason: 'CHALLENGE_OR_EMPTY',
            message: `Booking.com returned no property markup (${htmlStr.length} bytes)`,
            diagnostics,
        };
    }

    return { blocked: false, diagnostics };
}

// Extract JSON-LD blocks from HTML (supports @graph arrays)
export function extractJsonLd(html) {
    if (!html) return [];
    const $ = load(html);
    const blocks = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).html();
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                blocks.push(...parsed);
            } else if (parsed && Array.isArray(parsed['@graph'])) {
                blocks.push(...parsed['@graph']);
            } else if (parsed) {
                blocks.push(parsed);
            }
        } catch {
            // Skip malformed JSON-LD blocks
        }
    });

    return blocks;
}

function extractStarsFromElement($, $root) {
    const starRegex = /(\d)\s*(?:out of 5|of 5|\/\s*5|-?\s*stars?|étoiles?|sterne|estrellas?|stelle)/i;

    const $rating = $root.find('[data-testid="rating-stars"], [data-testid="rating-squares"]').first();
    if ($rating.length) {
        const ariaLabel = $rating.attr('aria-label')
            || $rating.parent().attr('aria-label')
            || $rating.closest('[aria-label]').attr('aria-label')
            || $rating.find('[aria-label]').first().attr('aria-label')
            || '';
        const ariaMatch = ariaLabel.match(starRegex);
        if (ariaMatch) {
            const val = parseInt(ariaMatch[1], 10);
            if (val >= 1 && val <= 5) return val;
        }

        const svgCount = $rating.find('svg').length;
        if (svgCount >= 1 && svgCount <= 5) return svgCount;

        const spanCount = $rating.children('span').length;
        if (spanCount >= 1 && spanCount <= 5) return spanCount;
    }

    let foundStars = null;
    $root.find('[aria-label]').each((_, el) => {
        const lbl = $(el).attr('aria-label') || '';
        const m = lbl.match(starRegex);
        if (m) {
            const val = parseInt(m[1], 10);
            if (val >= 1 && val <= 5) {
                foundStars = val;
                return false;
            }
        }
        return undefined;
    });

    return foundStars;
}

function extractScoreDetails($, $card) {
    const $scoreEl = $card.find('[data-testid="review-score"], [data-testid="review-score-link"]').first();
    if (!$scoreEl.length) return { rating: null, ratingText: null, reviewsCount: 0 };

    // Collect text from children separated by spaces so nested elements never concatenate digits
    const parts = [];
    $scoreEl.find('*').addBack().each((_, node) => {
        const $node = $(node);
        const directText = $node.contents().filter((__, c) => c.type === 'text').text().replace(/\s+/g, ' ').trim();
        if (directText) parts.push(directText);
    });
    const combined = parts.join(' ').replace(/\s+/g, ' ').trim() || $scoreEl.text().replace(/\s+/g, ' ').trim();

    let rating = null;
    for (const token of combined.split(/\s+/)) {
        const cleanedToken = token.replace(/[()]/g, '');
        if (/^(?:10(?:[.,]0)?|[1-9](?:[.,]\d)?)$/.test(cleanedToken)) {
            const val = parseFloat(cleanedToken.replace(',', '.'));
            if (val > 0 && val <= 10) {
                rating = val;
                break;
            }
        }
    }

    let ratingText = null;
    const descMatch = combined.match(/\b(Exceptional|Superb|Wonderful|Fabulous|Very Good|Good|Pleasant|Fair|Passable|Okay|Review score)\b/i);
    if (descMatch) {
        ratingText = descMatch[1];
    }

    const reviewsCount = parseReviewCount(combined);

    return { rating, ratingText, reviewsCount };
}

function extractCleanTextWithoutSr($el) {
    if (!$el || !$el.length) return '';
    const $copy = $el.clone();
    $copy.find('.bui-u-sr-only, .sr-only').remove();
    return $copy
        .text()
        .replace(/Opens in new window/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Detailed Search Results parser returning both hotels and diagnostic skip stats
export function parseSearchResultsDetailed(html, destination, searchParams = {}) {
    const emptyStats = {
        rawCards: 0,
        noName: 0,
        noUrl: 0,
        duplicateUrl: 0,
        filteredByRating: 0,
        filteredByStars: 0,
        extracted: 0,
        sampleCard: null,
    };
    if (!html || typeof html !== 'string') return { hotels: [], stats: emptyStats };

    const $ = load(html);
    const hotels = [];
    const seenUrls = new Set();
    const $cards = getCardElements($);

    const stats = {
        ...emptyStats,
        rawCards: $cards.length,
    };

    $cards.each((idx, cardNode) => {
        const $card = $(cardNode);

        // 1. Name & Clean URL
        const $titleEl = $card.find('[data-testid="title"], .sr-hotel__name').first();
        let name = extractCleanTextWithoutSr($titleEl);
        if (!name) {
            name = extractCleanTextWithoutSr($card.find('a[data-testid="title-link"] h3, h3, a[data-testid="title-link"]').first());
        }

        const rawHref = $card.find('a[data-testid="title-link"]').attr('href')
            || $card.find('a[href*="/hotel/"]').first().attr('href')
            || $card.find('h3 a[href]').first().attr('href')
            || '';
        const url = normalizeBookingUrl(rawHref);

        // 2. Price
        let rawPrice = $card.find('[data-testid="price-and-discounted-price"]').first().text().replace(/\s+/g, ' ').trim();
        if (!rawPrice) {
            rawPrice = $card.find('[data-testid="price"]').first().text().replace(/\s+/g, ' ').trim();
        }
        if (!rawPrice) {
            const $rateBlock = $card.find('[data-testid="availability-rate-information"], [data-testid="availability-rate-wrapper"]').first();
            if ($rateBlock.length) {
                $rateBlock.find('span, div').each((__, el) => {
                    const $el = $(el);
                    if ($el.attr('data-testid') === 'price-for-x-nights') return;
                    if ($el.attr('aria-hidden') === 'true' && /line-through/i.test($el.attr('style') || '')) return;
                    const txt = $el.text().replace(/\s+/g, ' ').trim();
                    if (/^(?:US\$|\$|€|£|AED|SAR|CAD|AUD|CHF|JPY|CNY|C\$|A\$|¥)\s*[\d.,\s]+$/i.test(txt)) {
                        rawPrice = txt;
                        return false;
                    }
                    return undefined;
                });
            }
        }

        // 3. Rating & Stars (captured before skip checks so diagnostics remain informative)
        const { rating, ratingText, reviewsCount } = extractScoreDetails($, $card);
        const stars = extractStarsFromElement($, $card);

        if (idx === 0) {
            const testIds = [];
            $card.find('[data-testid]').each((__, el) => {
                const tid = $(el).attr('data-testid');
                if (tid && !testIds.includes(tid) && testIds.length < 10) testIds.push(tid);
            });
            stats.sampleCard = {
                name: name || null,
                rawHref: rawHref ? rawHref.slice(0, 100) : null,
                url: url || null,
                rawPrice: rawPrice || null,
                rating,
                stars,
                testIds,
            };
        }

        if (!name) {
            stats.noName++;
            return;
        }
        if (!url) {
            stats.noUrl++;
            return;
        }
        if (seenUrls.has(url)) {
            stats.duplicateUrl++;
            return;
        }
        seenUrls.add(url);

        const idMatch = url.match(/\/hotel\/[a-z]{2}\/([a-zA-Z0-9_-]+)/i);
        const hotelId = idMatch ? idMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const { formatted: price, numeric: priceNumeric } = parsePrice(rawPrice);
        const nights = searchParams.nights || 1;
        const pricePerNight = priceNumeric > 0 ? Math.round(priceNumeric / nights) : 0;

        // 4. Address & Distance
        const address = $card.find('[data-testid="address"], .bui-card__subtitle, .sr_card_address_line').first().text().replace(/\s+/g, ' ').trim()
            || destination
            || null;
        const distanceFromCenter = $card.find('[data-testid="distance"]').first().text().replace(/\s+/g, ' ').trim() || null;

        // 5. Badges (Free Cancellation, Breakfast, No Prepayment)
        const cardTextLower = $card.text().replace(/\s+/g, ' ').toLowerCase();
        const hasFreeCancellation = Boolean(
            cardTextLower.includes('free cancellation')
            || cardTextLower.includes('annulation gratuite')
            || cardTextLower.includes('kostenlose stornierung')
            || cardTextLower.includes('cancelación gratis')
        );
        const isBreakfastIncluded = Boolean(
            cardTextLower.includes('breakfast included')
            || cardTextLower.includes('petit-déjeuner compris')
            || cardTextLower.includes('frühstück inbegriffen')
            || cardTextLower.includes('desayuno incluido')
        );
        const noPrepayment = Boolean(
            cardTextLower.includes('no prepayment')
            || cardTextLower.includes('sans prépaiement')
            || cardTextLower.includes('keine vorauszahlung')
            || cardTextLower.includes('sin pago por adelantado')
        );

        // 6. Room Type
        const $units = $card.find('[data-testid="recommended-units"]').first();
        let roomType = null;
        if ($units.length) {
            roomType = $units.find('h4, strong, [role="heading"]').first().text().replace(/\s+/g, ' ').trim()
                || $units.children().first().text().replace(/\s+/g, ' ').trim()
                || $units.text().replace(/\s+/g, ' ').trim()
                || null;
        }

        // 7. Cover Image (HD)
        const rawImgUrl = $card.find('img[data-testid="image"]').first().attr('src')
            || $card.find('img[src*="bstatic.com"]').first().attr('src')
            || $card.find('img[data-src*="bstatic.com"]').first().attr('data-src')
            || null;
        const imageUrl = getHdImageUrl(rawImgUrl);

        // 8. Quality Filters
        if (searchParams.minRating > 0 && (!rating || rating < searchParams.minRating)) {
            stats.filteredByRating++;
            return;
        }
        if (searchParams.minStars > 0 && (!stars || stars < searchParams.minStars)) {
            stats.filteredByStars++;
            return;
        }

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
            checkin: searchParams.checkin || null,
            checkout: searchParams.checkout || null,
            rating,
            ratingText,
            reviewsCount,
            stars,
            propertyType: null,
            address,
            distanceFromCenter,
            hasFreeCancellation,
            isBreakfastIncluded,
            noPrepayment,
            roomType,
            imageUrl,
            scrapedAt: new Date().toISOString(),
        });
    });

    stats.extracted = hotels.length;
    return { hotels, stats };
}

// Parse Search Results Page HTML for Property Cards using Cheerio DOM
export function parseSearchResultsHtml(html, destination, searchParams = {}) {
    return parseSearchResultsDetailed(html, destination, searchParams).hotels;
}

// Parse Individual Hotel Details Page using Cheerio DOM + JSON-LD
export function parseHotelDetailPage(html, url, searchParams = {}) {
    if (!html || typeof html !== 'string') return null;

    const $ = load(html);
    const jsonLds = extractJsonLd(html);
    const allowedTypes = new Set(['Hotel', 'LodgingBusiness', 'Resort', 'Hostel', 'Apartment', 'BedAndBreakfast', 'VacationRental']);
    const hotelLd = jsonLds.find((j) => {
        const types = Array.isArray(j?.['@type']) ? j['@type'] : [j?.['@type']];
        return types.some((t) => allowedTypes.has(t));
    }) || {};

    const cleanUrl = normalizeBookingUrl(url) || url;

    const name = cleanInputString(
        decodeHtmlEntities(
            hotelLd.name
            || $('h2.pp-header__title, #hp_hotel_name, [data-testid="PropertyHeaderTitle"]').first().text().replace(/\s+/g, ' ').trim()
            || $('meta[property="og:title"]').attr('content')?.replace(/\|.*$/gi, '').trim()
            || ''
        )
    );
    if (!name) return null;

    const idMatch = cleanUrl.match(/\/hotel\/[a-z]{2}\/([a-zA-Z0-9_-]+)/i);
    const hotelId = idMatch ? idMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const description = decodeHtmlEntities(
        hotelLd.description
        || $('#property_description_content, [data-testid="property-description"]').first().text()
        || $('meta[property="og:description"]').attr('content')
        || ''
    ).replace(/\s+/g, ' ').trim() || null;

    // Coordinates
    let latitude = hotelLd.geo?.latitude ? parseFloat(hotelLd.geo.latitude) : null;
    let longitude = hotelLd.geo?.longitude ? parseFloat(hotelLd.geo.longitude) : null;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const coordRaw = $('[data-atlas-latlng]').first().attr('data-atlas-latlng') || '';
        if (coordRaw.includes(',')) {
            const [latStr, lngStr] = coordRaw.split(',');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                latitude = lat;
                longitude = lng;
            }
        }
    }

    // Address & Location
    let address = '';
    let city = null;
    let country = null;

    if (hotelLd.address) {
        const a = hotelLd.address;
        const countryVal = (a.addressCountry && typeof a.addressCountry === 'object')
            ? (a.addressCountry.name || '')
            : (a.addressCountry || '');
        address = decodeHtmlEntities([a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, countryVal].filter(Boolean).join(', '));
        city = decodeHtmlEntities(a.addressLocality || '') || null;
        country = decodeHtmlEntities(countryVal || '') || null;
    }

    if (!address) {
        address = $('.hp_address_subtitle, [data-testid="address"]').first().text().replace(/\s+/g, ' ').trim();
    }

    // Price (if dates/availability present on hotel page)
    const rawDetailPrice = $('.bui-price-display__value, .prco-valign-middle-helper, [data-testid="price-and-discounted-price"]').first().text().replace(/\s+/g, ' ').trim();
    const { formatted: parsedPrice, numeric: priceNumeric } = parsePrice(rawDetailPrice);
    const nights = searchParams.nights || 1;
    const pricePerNight = priceNumeric > 0 ? Math.round(priceNumeric / nights) : 0;

    // Rating & Score
    let rating = hotelLd.aggregateRating?.ratingValue ? parseFloat(hotelLd.aggregateRating.ratingValue) : null;
    let reviewsCount = hotelLd.aggregateRating?.reviewCount ? parseInt(hotelLd.aggregateRating.reviewCount, 10) : 0;

    if (!rating) {
        const scoreAttr = $('[data-testid="review-score-component"], [data-testid="review-score-right-component"]').first().text().replace(/\s+/g, ' ').trim();
        const m = scoreAttr.match(/\b(\d{1,2}(?:[.,]\d)?)\b/);
        if (m) {
            const v = parseFloat(m[1].replace(',', '.'));
            if (v > 0 && v <= 10) rating = v;
        }
        if (!reviewsCount) {
            reviewsCount = parseReviewCount(scoreAttr);
        }
    }

    // Review Subscores (modern React DOM + legacy bars)
    const reviewSubscores = {};
    $('[data-testid="review-subscore"]').each((_, el) => {
        const $el = $(el);
        const text = $el.text().replace(/\s+/g, ' ').trim();
        const m = text.match(/^(.*?)\s+(\d{1,2}(?:[.,]\d)?)$/);
        if (m) {
            const label = m[1].trim();
            const val = parseFloat(m[2].replace(',', '.'));
            if (label && Number.isFinite(val)) reviewSubscores[label] = val;
        }
    });
    if (Object.keys(reviewSubscores).length === 0) {
        $('.c-score-bar, .v2_review-scores__subscore').each((_, el) => {
            const label = $(el).find('.c-score-bar__title').text().replace(/\s+/g, ' ').trim();
            const valStr = $(el).find('.c-score-bar__score').text().replace(/\s+/g, ' ').trim();
            const val = parseFloat(valStr.replace(',', '.'));
            if (label && Number.isFinite(val)) reviewSubscores[label] = val;
        });
    }

    // Popular Facilities
    const facilities = [];
    const seenFac = new Set();
    $('[data-testid="property-most-popular-facilities-wrapper"] li, [data-testid="property-most-popular-facilities-wrapper"] span, .hotel-facilities-group__item, .important_facility').each((_, el) => {
        const txt = $(el).text().replace(/\s+/g, ' ').trim();
        if (txt && txt.length > 1 && txt.length < 80 && !seenFac.has(txt.toLowerCase())) {
            seenFac.add(txt.toLowerCase());
            facilities.push(txt);
        }
    });

    // Images Gallery (High-Res)
    const imageUrls = [];
    const seenImgs = new Set();
    $('a[href*="bstatic.com/xdata/images/hotel"], img[src*="bstatic.com/xdata/images/hotel"]').each((_, el) => {
        if (imageUrls.length >= 20) return false;
        const src = $(el).attr('href') || $(el).attr('src');
        const hd = getHdImageUrl(src);
        if (hd && !seenImgs.has(hd)) {
            seenImgs.add(hd);
            imageUrls.push(hd);
        }
        return undefined;
    });

    const coverImageUrl = imageUrls[0] || getHdImageUrl(Array.isArray(hotelLd.image) ? hotelLd.image[0] : hotelLd.image) || null;
    const stars = extractStarsFromElement($, $.root());
    const rawLdType = Array.isArray(hotelLd['@type']) ? hotelLd['@type'][0] : hotelLd['@type'];

    return {
        type: 'HOTEL',
        id: hotelId,
        name,
        url: cleanUrl,
        destination: city || searchParams.destination || null,
        price: parsedPrice || (priceNumeric > 0 ? `${searchParams.currency || '$'} ${priceNumeric}` : 'Price on request'),
        priceNumeric,
        currency: searchParams.currency || 'USD',
        pricePerNight,
        nights: searchParams.nights || null,
        checkin: searchParams.checkin || null,
        checkout: searchParams.checkout || null,
        rating: Number.isFinite(rating) ? rating : null,
        ratingText: null,
        reviewsCount: Number.isFinite(reviewsCount) ? reviewsCount : 0,
        reviewSubscores: Object.keys(reviewSubscores).length > 0 ? reviewSubscores : null,
        stars,
        propertyType: typeof rawLdType === 'string' ? rawLdType : null,
        address: address || null,
        city,
        country,
        distanceFromCenter: null,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        roomType: null,
        hasFreeCancellation: false,
        isBreakfastIncluded: false,
        noPrepayment: false,
        facilities: facilities.length > 0 ? facilities : null,
        description,
        imageUrl: coverImageUrl,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        scrapedAt: new Date().toISOString(),
    };
}
