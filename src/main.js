import { Actor } from 'apify';
import { gotScraping } from 'got-scraping';
import { log } from 'crawlee';
import { chromium } from 'playwright';
import {
    cleanInputString,
    resolveStayDates,
    parsePlaywrightProxy,
    detectBookingBlock,
    parseSearchResultsDetailed,
    parseHotelDetailPage,
} from './extractors.js';

function sanitizeRecord(obj) {
    if (Array.isArray(obj)) return obj.map((item) => sanitizeRecord(item));
    if (!obj || typeof obj !== 'object') return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== null && v !== undefined && !(typeof v === 'number' && Number.isNaN(v))) {
            clean[k] = Array.isArray(v)
                ? v.map((item) => (item && typeof item === 'object' ? sanitizeRecord(item) : item))
                : v && typeof v === 'object' && !(v instanceof Date)
                    ? sanitizeRecord(v)
                    : v;
        }
    }
    return clean;
}

function isProxyTransportError(errOrStatus) {
    const msg = String(errOrStatus?.message || errOrStatus || '');
    return errOrStatus === 597 || errOrStatus === 407 || /597|UPSTREAM407|407|Proxy responded with|tunneling socket|ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED/i.test(msg);
}

await Actor.init();

let hasFailed = false;
let pwSession = null;

try {
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
        proxyConfiguration,
    } = input;

    const safeHotelUrls = (Array.isArray(hotelUrls) ? hotelUrls : [hotelUrls])
        .map((u) => cleanInputString(String(u || ''), ''))
        .filter(Boolean);

    const cleanDestination = cleanInputString(destination, '') || (safeHotelUrls.length === 0 ? 'Paris' : '');
    const cleanCurrency = cleanInputString(currency, 'USD').toUpperCase();
    const cleanSort = cleanInputString(sortBy, 'popularity');
    const safeAdults = Math.max(1, Number(adults) || 2);
    const safeChildren = Math.max(0, Number(children) || 0);
    const safeRooms = Math.max(1, Number(rooms) || 1);
    const safeMaxHotels = Math.max(1, Number(maxHotels) || 50);
    const safeMinRating = Math.max(0, Number(minRating) || 0);
    const safeMinStars = Math.max(0, Number(minStars) || 0);

    // Resolve and validate check-in / check-out dates
    const { checkin, checkout, nights, dateAdjusted } = resolveStayDates(checkinInput, checkoutInput, stayNights);
    if (dateAdjusted) {
        log.warning(`Stay dates adjusted to valid future range: checkin=${checkin}, checkout=${checkout} (${nights} nights).`);
    }

    log.info('🚀 Starting Booking.com Ultimate Scraper...', {
        destination: cleanDestination || '(direct URLs)',
        directUrlsCount: safeHotelUrls.length,
        checkin,
        checkout,
        nights,
        adults: safeAdults,
        children: safeChildren,
        rooms: safeRooms,
        currency: cleanCurrency,
        minRating: safeMinRating,
        minStars: safeMinStars,
        sortBy: cleanSort,
        maxHotels: safeMaxHotels,
    });

    let proxyConfig = proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : undefined;
    if (proxyConfig) {
        log.info('Configured Apify Proxy successfully', {
            groups: proxyConfig.groups || [],
            countryCode: proxyConfig.countryCode || null,
            isManInTheMiddle: Boolean(proxyConfig.isManInTheMiddle),
        });
    }

    function formatDiagnostics(diag) {
        if (!diag) return '';
        const parts = [`status=${diag.statusCode}`, `len=${diag.htmlLength}`, `cards=${diag.cardsCount ?? 0}`];
        if (diag.wafAction) parts.push(`waf=${diag.wafAction}`);
        if (diag.location) parts.push(`location=${diag.location}`);
        if (diag.title) parts.push(`title="${diag.title.slice(0, 80)}"`);
        return ` [${parts.join(', ')}]`;
    }

    let httpSessionToken = {};
    let preferPlaywright = false;

    // Fast HTML fetcher with proxy and WAF/block detection
    async function fetchHtml(url) {
        let proxyUrl = proxyConfig ? await proxyConfig.newUrl() : undefined;
        let response;
        try {
            response = await gotScraping({
                url,
                headers: {
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'sec-fetch-site': 'none',
                },
                headerGeneratorOptions: {
                    browsers: [{ name: 'chrome' }],
                    operatingSystems: ['windows', 'linux'],
                },
                sessionToken: httpSessionToken,
                proxyUrl,
                timeout: { request: 30000 },
                retry: { limit: 1 },
                throwHttpErrors: false,
            });
        } catch (err) {
            if (isProxyTransportError(err) && proxyConfig) {
                log.warning(`Proxy transport error (${err.message}) on ${url}, retrying direct connection without proxy...`);
                proxyConfig = undefined;
                response = await gotScraping({
                    url,
                    headers: {
                        'accept-language': 'en-US,en;q=0.9',
                        'accept-encoding': 'gzip, deflate, br',
                        'sec-fetch-site': 'none',
                    },
                    headerGeneratorOptions: {
                        browsers: [{ name: 'chrome' }],
                        operatingSystems: ['windows', 'linux'],
                    },
                    sessionToken: httpSessionToken,
                    timeout: { request: 30000 },
                    retry: { limit: 1 },
                    throwHttpErrors: false,
                });
            } else {
                throw err;
            }
        }

        if (isProxyTransportError(response.statusCode) && proxyConfig) {
            log.warning(`Proxy returned HTTP ${response.statusCode} on ${url}, falling back to direct connection...`);
            proxyConfig = undefined;
            return fetchHtml(url);
        }

        const blockCheck = detectBookingBlock(
            response.body,
            response.url || url,
            response.statusCode,
            response.headers,
        );

        if (blockCheck.blocked) {
            httpSessionToken = {};
            const err = new Error(`${blockCheck.message}${formatDiagnostics(blockCheck.diagnostics)}`);
            err.reason = blockCheck.reason;
            err.diagnostics = blockCheck.diagnostics;
            throw err;
        }

        return {
            html: response.body,
            emptySearch: Boolean(blockCheck.emptySearch),
            diagnostics: blockCheck.diagnostics,
        };
    }

    async function safePageContent(page) {
        for (let i = 0; i < 3; i++) {
            try {
                return await page.content();
            } catch (err) {
                if (i === 2) throw err;
                await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(500);
            }
        }
        return '';
    }

    class PlaywrightSession {
        constructor() {
            this.browser = null;
            this.context = null;
        }

        async ensureReady() {
            if (this.browser?.isConnected() && this.context) return;

            const attemptProxyUrl = proxyConfig ? await proxyConfig.newUrl() : undefined;
            const hasXvfbDisplay = process.platform === 'linux' && Boolean(process.env.DISPLAY);

            const launchOptions = {
                headless: !hasXvfbDisplay,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-webgl',
                    '--disable-3d-apis',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--no-first-run',
                    '--mute-audio',
                    '--ignore-certificate-errors',
                    '--ignore-certificate-errors-spki-list',
                    '--disable-blink-features=AutomationControlled',
                ],
            };
            if (attemptProxyUrl) {
                launchOptions.proxy = parsePlaywrightProxy(attemptProxyUrl);
            }

            this.browser = await chromium.launch(launchOptions);
            const browserVersion = this.browser.version() || '147.0.0.0';
            const cleanUserAgent = `Mozilla/5.0 (${process.platform === 'linux' ? 'X11; Linux x86_64' : 'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;

            this.context = await this.browser.newContext({
                ignoreHTTPSErrors: true,
                userAgent: cleanUserAgent,
                locale: 'en-US',
                viewport: { width: 1366, height: 768 },
                extraHTTPHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });

            await this.context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            });

            // Abort heavy binary images/media/fonts at context level to prevent tab OOM crashes while keeping cookies warm
            await this.context.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['image', 'media', 'font'].includes(type)) {
                    return route.abort().catch(() => {});
                }
                return route.continue().catch(() => {});
            });
        }

        async fetchPage(url, options = {}) {
            const { targetCards = 25 } = options;
            await this.ensureReady();
            const page = await this.context.newPage();
            let lastDocStatus = 200;
            let lastDocHeaders = {};

            page.on('response', (res) => {
                try {
                    if (res.request().resourceType() === 'document' && /booking\.com/i.test(res.url())) {
                        lastDocStatus = res.status();
                        lastDocHeaders = res.headers();
                    }
                } catch {}
            });

            try {
                const navResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                const targetSelector = '[data-testid="property-card"], [data-testid="property-card-container"], #hotellist_inner .sr_property_block, h2.pp-header__title, #hp_hotel_name, [data-testid="PropertyHeaderTitle"], #px-captcha, #challenge-container';

                try {
                    await page.waitForSelector(targetSelector, { timeout: 15000 });
                } catch {
                    // Handle client-side reload if AWS WAF JS refreshed the document
                    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
                    await page.waitForSelector(targetSelector, { timeout: 10000 }).catch(() => {});
                }

                // Dismiss OneTrust cookie banner or Booking Genius sign-in modal if present
                const dismissSelectors = [
                    '#onetrust-accept-btn-handler',
                    'button[aria-label="Dismiss sign-in info."]',
                    'button[aria-label="Dismiss sign in information."]',
                ];
                for (const sel of dismissSelectors) {
                    try {
                        const btn = page.locator(sel).first();
                        if (await btn.isVisible({ timeout: 1000 })) {
                            await btn.click({ timeout: 1500 });
                            await page.waitForTimeout(300);
                        }
                    } catch {}
                }

                await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
                await page.waitForTimeout(800);

                const cardSel = '[data-testid="property-card"]';
                let currentCards = await page.locator(cardSel).count().catch(() => 0);
                let loadMoreExhausted = false;

                if (currentCards > 0 && targetCards > currentCards) {
                    const maxClicks = 12;
                    let noGrowthClicks = 0;

                    for (let clickIdx = 0; clickIdx < maxClicks && currentCards < targetCards; clickIdx++) {
                        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
                        await page.waitForTimeout(400);

                        const loadMoreBtn = page.locator(
                            'button:has-text("Load more results"), button:has-text("Load more"), [data-testid="pagination-load-more"] button'
                        ).first();

                        const isVisible = await loadMoreBtn.isVisible({ timeout: 2000 }).catch(() => false);
                        if (!isVisible) {
                            loadMoreExhausted = true;
                            break;
                        }

                        const prevCount = currentCards;
                        try {
                            await loadMoreBtn.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
                            await loadMoreBtn.click({ timeout: 4000 });
                            await page.waitForFunction(
                                ({ sel, prev }) => document.querySelectorAll(sel).length > prev,
                                { sel: cardSel, prev: prevCount },
                                { timeout: 6000 },
                            ).catch(() => {});
                            await page.waitForTimeout(400);
                        } catch {
                            loadMoreExhausted = true;
                            break;
                        }

                        currentCards = await page.locator(cardSel).count().catch(() => prevCount);
                        if (currentCards <= prevCount) {
                            noGrowthClicks++;
                            if (noGrowthClicks >= 2) {
                                loadMoreExhausted = true;
                                break;
                            }
                        } else {
                            noGrowthClicks = 0;
                        }
                    }
                }

                const html = await safePageContent(page);
                const finalUrl = page.url();
                const status = lastDocStatus || (navResponse ? navResponse.status() : 200);
                const headers = Object.keys(lastDocHeaders).length > 0
                    ? lastDocHeaders
                    : (navResponse ? navResponse.headers() : {});

                const blockCheck = detectBookingBlock(html, finalUrl, status, headers);
                if (blockCheck.blocked) {
                    const diagSuffix = formatDiagnostics(blockCheck.diagnostics);
                    const err = new Error(
                        `${blockCheck.message}${diagSuffix}. Try Apify Proxy group "RESIDENTIAL" or "UNBLOCKER".`
                    );
                    err.reason = blockCheck.reason;
                    err.diagnostics = blockCheck.diagnostics;
                    throw err;
                }

                return {
                    html,
                    emptySearch: Boolean(blockCheck.emptySearch),
                    diagnostics: blockCheck.diagnostics,
                    loadMoreExhausted,
                };
            } finally {
                await page.close().catch(() => {});
            }
        }

        async close() {
            await this.context?.close().catch(() => {});
            await this.browser?.close().catch(() => {});
            this.context = null;
            this.browser = null;
        }
    }

    pwSession = new PlaywrightSession();

    async function fetchWithFallback(url, label, fetchOptions = {}) {
        if (!preferPlaywright) {
            try {
                const httpRes = await fetchHtml(url);
                return { ...httpRes, usedPlaywright: false, loadMoreExhausted: false };
            } catch (httpErr) {
                log.warning(`⚠️ Fast HTTP blocked/challenged for ${label} (${httpErr.message}). Trying Playwright browser fallback...`);
                preferPlaywright = true;
            }
        }

        const maxPwAttempts = proxyConfig ? 2 : 1;
        let lastPwErr = null;

        for (let pwAttempt = 1; pwAttempt <= maxPwAttempts; pwAttempt++) {
            try {
                const pwRes = await pwSession.fetchPage(url, fetchOptions);
                return { ...pwRes, usedPlaywright: true };
            } catch (pwErr) {
                lastPwErr = pwErr;
                await pwSession.close();
                if (isProxyTransportError(pwErr) && proxyConfig) {
                    log.warning(`⚠️ Playwright proxy transport error (${pwErr.message}), disabling dead proxy and retrying direct...`);
                    proxyConfig = undefined;
                }
                if (pwAttempt < maxPwAttempts) {
                    log.warning(`⚠️ Playwright attempt ${pwAttempt}/${maxPwAttempts} failed (${pwErr.message}). Retrying...`);
                    await new Promise((r) => setTimeout(r, 1200));
                }
            }
        }

        throw lastPwErr;
    }

    function getSortParam(sort) {
        switch (sort) {
            case 'price_asc': return 'price';
            case 'review_score': return 'review_score_and_price';
            case 'distance': return 'distance_from_search';
            default: return 'popularity';
        }
    }

    function buildNfltParam() {
        const parts = [];
        if (safeMinStars >= 1) {
            const minStarInt = Math.min(5, Math.max(1, Math.ceil(safeMinStars)));
            for (let s = minStarInt; s <= 5; s++) {
                parts.push(`class=${s}`);
            }
        }
        if (safeMinRating >= 9) parts.push('review_score=90');
        else if (safeMinRating >= 8) parts.push('review_score=80');
        else if (safeMinRating >= 7) parts.push('review_score=70');
        else if (safeMinRating >= 6) parts.push('review_score=60');
        return parts.join(';');
    }

    function buildSearchUrl(destQuery, offset = 0) {
        const u = new URL('https://www.booking.com/searchresults.html');
        u.searchParams.set('ss', destQuery);
        u.searchParams.set('checkin', checkin);
        u.searchParams.set('checkout', checkout);
        u.searchParams.set('group_adults', String(safeAdults));
        u.searchParams.set('no_rooms', String(safeRooms));
        u.searchParams.set('group_children', String(safeChildren));
        for (let i = 0; i < safeChildren; i++) {
            u.searchParams.append('age', '8');
        }
        u.searchParams.set('selected_currency', cleanCurrency);
        u.searchParams.set('order', getSortParam(cleanSort));
        u.searchParams.set('lang', 'en-us');
        const nflt = buildNfltParam();
        if (nflt) {
            u.searchParams.set('nflt', nflt);
        }
        u.searchParams.set('offset', String(offset));
        return u.toString();
    }

    function appendStayParamsIfMissing(rawUrl) {
        try {
            const u = new URL(rawUrl);
            if (!u.searchParams.has('checkin')) u.searchParams.set('checkin', checkin);
            if (!u.searchParams.has('checkout')) u.searchParams.set('checkout', checkout);
            if (!u.searchParams.has('selected_currency')) u.searchParams.set('selected_currency', cleanCurrency);
            if (!u.searchParams.has('lang')) u.searchParams.set('lang', 'en-us');
            return u.toString();
        } catch {
            return rawUrl;
        }
    }

    const stats = {
        totalHotels: 0,
        totalPriceNumeric: 0,
        validPriceCount: 0,
        destinations: new Set(),
        failed: 0,
    };

    const searchParams = {
        destination: cleanDestination,
        checkin,
        checkout,
        nights,
        currency: cleanCurrency,
        minRating: safeMinRating,
        minStars: safeMinStars,
    };

    const seenHotelKeys = new Set();

    async function scrapeSearchUrlPaginated(urlBuilder, label, serverFilteredStars = false) {
        const seenRawUrls = new Set();
        let offset = 0;
        let hasMore = true;
        let consecutiveFilteredEmpty = 0;
        let forceLoadMoreFromZero = false;
        let loadMoreTarget = Math.min(250, safeMaxHotels);
        const pageSize = 25;

        while (stats.totalHotels < safeMaxHotels && hasMore && offset < 1000) {
            const effectiveOffset = forceLoadMoreFromZero ? 0 : offset;
            const targetUrl = urlBuilder(effectiveOffset);
            const desiredCards = forceLoadMoreFromZero ? loadMoreTarget : Math.min(250, safeMaxHotels);

            log.info(
                forceLoadMoreFromZero
                    ? `📜 Expanding results in browser (target ~${desiredCards} cards, ${stats.totalHotels}/${safeMaxHotels} hotels scraped)...`
                    : `📜 Fetching page offset ${effectiveOffset} (${stats.totalHotels}/${safeMaxHotels} hotels scraped)...`,
            );

            try {
                const {
                    html,
                    emptySearch,
                    diagnostics,
                    usedPlaywright,
                    loadMoreExhausted,
                } = await fetchWithFallback(targetUrl, `${label} offset=${effectiveOffset}`, { targetCards: desiredCards });

                if (emptySearch) {
                    log.info(`ℹ️ Booking.com reported 0 matching properties for "${label}" at offset ${effectiveOffset}.`);
                    hasMore = false;
                    break;
                }

                const { hotels, stats: parseStats } = parseSearchResultsDetailed(
                    html,
                    cleanDestination || label,
                    { ...searchParams, serverFilteredStars },
                );
                const rawCards = parseStats.rawCards;

                if (rawCards === 0) {
                    log.warning(`ℹ️ No property cards found at offset ${effectiveOffset}.${formatDiagnostics(diagnostics)}`);
                    hasMore = false;
                    break;
                }

                if (parseStats.usedStarFallback) {
                    log.warning('ℹ️ Property cards did not expose star badges in DOM; keeping results matching Booking server-side class filter.');
                }

                let unseenRawCount = 0;
                for (const rawCardUrl of parseStats.allUrls || []) {
                    if (!seenRawUrls.has(rawCardUrl)) {
                        seenRawUrls.add(rawCardUrl);
                        unseenRawCount++;
                    }
                }

                let addedOnPage = 0;
                for (const h of hotels) {
                    if (stats.totalHotels >= safeMaxHotels) {
                        hasMore = false;
                        break;
                    }
                    const key = h.url || h.id;
                    if (key && seenHotelKeys.has(key)) continue;
                    if (key) seenHotelKeys.add(key);

                    await Actor.pushData(sanitizeRecord(h));
                    stats.totalHotels++;
                    addedOnPage++;
                    if (h.destination) stats.destinations.add(h.destination);

                    if (h.priceNumeric > 0) {
                        stats.totalPriceNumeric += h.priceNumeric;
                        stats.validPriceCount++;
                    }

                    log.info(`✅ [${stats.totalHotels}/${safeMaxHotels}] Scraped: "${h.name}" - ${h.price} (Rating: ${h.rating ?? 'N/A'}, Stars: ${h.stars ?? 'N/A'})`);
                }

                if (stats.totalHotels >= safeMaxHotels) {
                    hasMore = false;
                    break;
                }

                // Stop immediately or expand via Load More if no unseen property cards arrived
                if ((parseStats.allUrls?.length || 0) > 0 && unseenRawCount === 0) {
                    if (!forceLoadMoreFromZero && !loadMoreExhausted && seenRawUrls.size < 250) {
                        forceLoadMoreFromZero = true;
                        preferPlaywright = true;
                        loadMoreTarget = Math.min(250, seenRawUrls.size + Math.max(25, (safeMaxHotels - stats.totalHotels) * 2));
                        log.info(`ℹ️ Offset ${effectiveOffset} repeated existing cards; switching to in-page "Load more results" pagination (target ${loadMoreTarget})...`);
                        await new Promise((r) => setTimeout(r, 800));
                        continue;
                    }
                    log.info(`ℹ️ Reached end of unique results at offset ${effectiveOffset} (0 new properties). Finishing search.`);
                    hasMore = false;
                    break;
                }

                if (addedOnPage === 0 && rawCards > 0) {
                    consecutiveFilteredEmpty++;
                    log.warning(`ℹ️ ${rawCards} cards at offset ${effectiveOffset} yielded 0 new matching hotels (${consecutiveFilteredEmpty}/3).`, parseStats);
                    if (consecutiveFilteredEmpty >= 3) {
                        hasMore = false;
                        break;
                    }
                } else {
                    consecutiveFilteredEmpty = 0;
                }

                if (usedPlaywright && !forceLoadMoreFromZero && rawCards >= 15) {
                    // Booking desktop React ignores ?offset=25 on reload; expand via in-page "Load more results"
                    if (loadMoreExhausted || seenRawUrls.size >= 250) {
                        hasMore = false;
                        break;
                    }
                    forceLoadMoreFromZero = true;
                    loadMoreTarget = Math.min(250, seenRawUrls.size + Math.max(25, (safeMaxHotels - stats.totalHotels) * 2));
                    await new Promise((r) => setTimeout(r, 800));
                    continue;
                }

                if (forceLoadMoreFromZero) {
                    if (loadMoreExhausted || loadMoreTarget >= 250) {
                        hasMore = false;
                        break;
                    }
                    loadMoreTarget = Math.min(250, Math.max(loadMoreTarget + 50, seenRawUrls.size + 40));
                    await new Promise((r) => setTimeout(r, 800));
                    continue;
                }

                offset += pageSize;
                if (rawCards < 15) {
                    hasMore = false;
                } else {
                    await new Promise((r) => setTimeout(r, 1000));
                }
            } catch (err) {
                log.error(`❌ Error scraping search page offset ${effectiveOffset}: ${err.message}`);
                stats.failed++;
                break;
            }
        }
    }

    // CASE 1: DIRECT HOTEL OR SEARCH URLS PROVIDED
    if (safeHotelUrls.length > 0) {
        log.info(`🎯 Processing ${safeHotelUrls.length} direct Booking.com URLs...`);

        for (const rawUrl of safeHotelUrls) {
            if (stats.totalHotels >= safeMaxHotels) break;

            if (/\/searchresults/i.test(rawUrl)) {
                log.info(`🔎 Detected Booking search URL in hotelUrls: ${rawUrl}`);
                let hasServerClassFilter = false;
                try {
                    const checkUrl = new URL(appendStayParamsIfMissing(rawUrl));
                    const defaultNflt = buildNfltParam();
                    if (!checkUrl.searchParams.has('nflt') && defaultNflt) {
                        checkUrl.searchParams.set('nflt', defaultNflt);
                    }
                    hasServerClassFilter = /(?:^|;)class=\d/i.test(checkUrl.searchParams.get('nflt') || '');
                } catch {}

                await scrapeSearchUrlPaginated((offset) => {
                    try {
                        const u = new URL(appendStayParamsIfMissing(rawUrl));
                        const defaultNflt = buildNfltParam();
                        if (!u.searchParams.has('nflt') && defaultNflt) {
                            u.searchParams.set('nflt', defaultNflt);
                        }
                        u.searchParams.set('offset', String(offset));
                        return u.toString();
                    } catch {
                        return rawUrl;
                    }
                }, rawUrl, hasServerClassFilter);
                continue;
            }

            try {
                const targetUrl = appendStayParamsIfMissing(rawUrl);
                log.info(`🏨 Scraping hotel page: ${targetUrl}`);
                const { html, diagnostics } = await fetchWithFallback(targetUrl, targetUrl);

                const hotel = parseHotelDetailPage(html, rawUrl, searchParams);
                if (hotel && hotel.name) {
                    await Actor.pushData(sanitizeRecord(hotel));
                    stats.totalHotels++;
                    if (hotel.city || cleanDestination) stats.destinations.add(hotel.city || cleanDestination);
                    if (hotel.priceNumeric > 0) {
                        stats.totalPriceNumeric += hotel.priceNumeric;
                        stats.validPriceCount++;
                    }
                    log.info(`✅ Successfully scraped Hotel: "${hotel.name}" [Rating: ${hotel.rating ?? 'N/A'}, Stars: ${hotel.stars ?? 'N/A'}]`);
                } else {
                    log.warning(`⚠️ Could not parse hotel details from ${rawUrl}${formatDiagnostics(diagnostics)}`);
                }
            } catch (err) {
                log.error(`❌ Failed scraping hotel ${rawUrl}: ${err.message}`);
                stats.failed++;
            }
        }
    }

    // CASE 2: SEARCH BY DESTINATION (CITY / REGION)
    else if (cleanDestination) {
        const nfltFilter = buildNfltParam();
        log.info(`🔍 Searching Booking.com for destination: "${cleanDestination}"...`, nfltFilter ? { nflt: nfltFilter } : {});
        await scrapeSearchUrlPaginated(
            (offset) => buildSearchUrl(cleanDestination, offset),
            cleanDestination,
            safeMinStars >= 1,
        );
    }

    const averagePrice = stats.validPriceCount > 0 ? Math.round(stats.totalPriceNumeric / stats.validPriceCount) : 0;
    const isBlockedRun = stats.failed > 0 && stats.totalHotels === 0;

    const summary = {
        status: isBlockedRun ? 'BLOCKED_BY_WAF' : 'COMPLETED',
        timestamp: new Date().toISOString(),
        metrics: {
            totalHotelsScraped: stats.totalHotels,
            destinationSearched: cleanDestination || null,
            destinationsCovered: Array.from(stats.destinations),
            currency: cleanCurrency,
            checkinDate: checkin,
            checkoutDate: checkout,
            stayNights: nights,
            averageTotalPrice: averagePrice > 0 ? `${cleanCurrency} ${averagePrice}` : 'N/A',
            averagePricePerNight: averagePrice > 0 ? `${cleanCurrency} ${Math.round(averagePrice / nights)}` : 'N/A',
            failedRequests: stats.failed,
        },
        message: isBlockedRun
            ? 'Requests were blocked/challenged by Booking.com anti-bot (AWS WAF). Enable Apify Proxy group "RESIDENTIAL" or "UNBLOCKER" in proxyConfiguration.'
            : 'Booking.com Ultimate Scraper completed successfully.',
    };

    await Actor.setValue('OUTPUT', summary);
    log.info('🏁 Execution Finished. Executive Summary:', summary);

    if (stats.totalHotels === 0) {
        hasFailed = true;
        await Actor.fail(summary.message || 'No hotel records were extracted.');
    }
} catch (err) {
    hasFailed = true;
    log.error(`Fatal execution error: ${err.message}`, { stack: err.stack });
    await Actor.setValue('OUTPUT', { status: 'FAILED', error: err.message }).catch(() => {});
    await Actor.fail(err.message);
} finally {
    await pwSession?.close().catch(() => {});
    if (!hasFailed) {
        await Actor.exit();
    }
}
