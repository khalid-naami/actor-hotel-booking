import { Actor } from 'apify';
import { gotScraping } from 'got-scraping';
import { PlaywrightCrawler, log } from 'crawlee';
import {
    resolveStayDates,
    parseSearchResultsHtml,
    parseHotelDetailPage
} from './extractors.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
    destination = 'Paris',
    hotelUrls = [],
    checkin: checkinInput = '',
    checkout: checkoutInput = '',
    stayNights = 3,
    adults = 2,
    children = 0,
    rooms = 1,
    currency = 'USD',
    minRating = 0,
    minStars = 0,
    sortBy = 'popularity',
    maxHotels = 50,
    proxyConfiguration
} = input;

// Resolve Dates
const { checkin, checkout, nights } = resolveStayDates(checkinInput, checkoutInput, stayNights);

log.info('🚀 Starting Booking.com Ultimate Scraper...', {
    destination,
    checkin,
    checkout,
    nights,
    adults,
    rooms,
    currency,
    maxHotels
});

const proxyConfig = proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : undefined;

function buildHeaders() {
    return {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1'
    };
}

// Fast HTML fetcher with proxy
async function fetchHtml(url) {
    const proxyUrl = proxyConfig ? await proxyConfig.newUrl() : undefined;
    const response = await gotScraping({
        url,
        headers: buildHeaders(),
        proxyUrl,
        timeout: { request: 30000 },
        retry: { limit: 2 }
    });
    return response.body;
}

// Playwright crawler fallback for interactive/anti-bot pages
async function fetchWithPlaywright(url) {
    let content = '';
    const crawler = new PlaywrightCrawler({
        proxyConfiguration: proxyConfig,
        maxRequestsPerCrawl: 1,
        headless: true,
        requestHandlerTimeoutSecs: 40,
        async requestHandler({ page }) {
            // Dismiss cookie consent banners
            try {
                const acceptBtn = page.locator('button#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Accept all")');
                if (await acceptBtn.isVisible({ timeout: 2500 })) {
                    await acceptBtn.click();
                    await page.waitForTimeout(1000);
                }
            } catch (_) {}

            content = await page.content();
        }
    });
    await crawler.run([url]);
    return content;
}

// Map sort order to Booking query param
function getSortParam(sort) {
    switch (sort) {
        case 'price_asc': return '&order=price';
        case 'review_score': return '&order=review_score_and_price';
        case 'distance': return '&order=distance_from_search';
        default: return '&order=popularity';
    }
}

const stats = {
    totalHotels: 0,
    totalPriceNumeric: 0,
    validPriceCount: 0,
    destinations: new Set(),
    failed: 0
};

const searchParams = {
    checkin,
    checkout,
    nights,
    currency,
    minRating,
    minStars
};

// CASE 1: DIRECT HOTEL URLS PROVIDED
if (Array.isArray(hotelUrls) && hotelUrls.length > 0) {
    log.info(`🎯 Processing ${hotelUrls.length} direct Booking.com hotel URLs...`);

    for (const rawUrl of hotelUrls) {
        const url = rawUrl.trim();
        if (!url) continue;

        try {
            log.info(`🏨 Scraping hotel page: ${url}`);
            let html = '';
            try {
                html = await fetchHtml(url);
            } catch (err) {
                log.warning(`⚠️ Fast HTTP failed for ${url} (${err.message}). Trying browser crawler...`);
                html = await fetchWithPlaywright(url);
            }

            const hotel = parseHotelDetailPage(html, url, searchParams);
            if (hotel && hotel.name) {
                hotel.checkin = checkin;
                hotel.checkout = checkout;
                hotel.nights = nights;
                hotel.currency = currency;

                await Actor.pushData(hotel);
                stats.totalHotels++;
                stats.destinations.add(hotel.city || destination);
                log.info(`✅ Successfully scraped Hotel: "${hotel.name}" [Rating: ${hotel.rating || 'N/A'}, Stars: ${hotel.stars || 'N/A'}]`);
            } else {
                log.warning(`⚠️ Could not parse hotel details from ${url}`);
            }
        } catch (err) {
            log.error(`❌ Failed scraping hotel ${url}: ${err.message}`);
            stats.failed++;
        }
    }
}

// CASE 2: SEARCH BY DESTINATION (CITY / REGION)
else if (destination) {
    log.info(`🔍 Searching Booking.com for destination: "${destination}"...`);

    let offset = 0;
    let hasMore = true;
    const pageSize = 25;

    while (stats.totalHotels < maxHotels && hasMore) {
        const sortParam = getSortParam(sortBy);
        const searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=${rooms}&group_children=${children}&selected_currency=${currency}&offset=${offset}${sortParam}`;

        log.info(`📜 Fetching page offset ${offset} (${stats.totalHotels}/${maxHotels} hotels scraped)...`);

        try {
            let html = '';
            try {
                html = await fetchHtml(searchUrl);
            } catch (err) {
                log.warning(`⚠️ Fast HTTP failed at offset ${offset} (${err.message}). Trying browser crawler...`);
                html = await fetchWithPlaywright(searchUrl);
            }

            const hotels = parseSearchResultsHtml(html, destination, searchParams);

            if (!hotels || hotels.length === 0) {
                log.info(`ℹ️ No more hotels found at offset ${offset}. Finishing search.`);
                hasMore = false;
                break;
            }

            for (const h of hotels) {
                if (stats.totalHotels >= maxHotels) {
                    hasMore = false;
                    break;
                }

                await Actor.pushData(h);
                stats.totalHotels++;
                stats.destinations.add(destination);

                if (h.priceNumeric > 0) {
                    stats.totalPriceNumeric += h.priceNumeric;
                    stats.validPriceCount++;
                }

                log.info(`✅ [${stats.totalHotels}/${maxHotels}] Scraped: "${h.name}" - ${h.price} (Rating: ${h.rating || 'N/A'})`);
            }

            offset += pageSize;
            if (hotels.length < pageSize) {
                hasMore = false;
            }

        } catch (err) {
            log.error(`❌ Error scraping search page offset ${offset}: ${err.message}`);
            stats.failed++;
            break;
        }
    }
}

// Generate execution overview summary
const averagePrice = stats.validPriceCount > 0 ? Math.round(stats.totalPriceNumeric / stats.validPriceCount) : 0;
const summary = {
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    metrics: {
        totalHotelsScraped: stats.totalHotels,
        destinationSearched: destination,
        destinationsCovered: Array.from(stats.destinations),
        currency,
        checkinDate: checkin,
        checkoutDate: checkout,
        stayNights: nights,
        averageTotalPrice: averagePrice > 0 ? `${currency} ${averagePrice}` : 'N/A',
        averagePricePerNight: averagePrice > 0 ? `${currency} ${Math.round(averagePrice / nights)}` : 'N/A',
        failedRequests: stats.failed
    },
    message: 'Booking.com Ultimate Scraper completed successfully.'
};

await Actor.setValue('OUTPUT', summary);
log.info('🏁 Execution Finished. Executive Summary:', summary);

await Actor.exit();
