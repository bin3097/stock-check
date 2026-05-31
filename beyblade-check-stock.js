require('dotenv').config({ quiet: true });

const axios = require('axios');

const PRODUCTS = [
    'https://malloftoys.com/products/bx-01-dran-sword?_pos=1&_sid=87ed6a530&_ss=r',
    'https://malloftoys.com/products/ux-03-wizardrod-booster',
    'https://malloftoys.com/products/ux-15-sharkscale-deck-set',
    'https://malloftoys.com/products/ux-08-silver-wolf',
    'https://malloftoys.com/products/bx-23-pheonix-wing-starter-set?_pos=9&_sid=8c99b5c4c&_ss=r',
    'https://www.toysrus.com.my/beyblade-bx-01-starter-dran-sw-10007158.html',
    'https://www.toysrus.com.my/beyblade-x-ux-15-shark-scale-deck-set-10098506.html',
    'https://www.toysrus.com.my/beyblade-x-ux-03-booster-wizard-rod-5-70db-10026914.html',
    'https://www.toysrus.com.my/beyblade-x-ux-08-starter-silver-wolf-3-80fb-10057321.html',
    'https://www.toysrus.com.my/beyblade-bx-23-starter-phoenix-10016234.html',
    // 'https://www.toysrus.com.my/beyblade-bx-18-string-launcher-10008062.html',
    // 'https://www.toysrus.com.my/bx-47-string-launcher-l-red-ver.-10114860.html',
    // 'https://www.toysrus.com.my/beyblade-x-bx-40-winder-launcher-l-10078294.html',
    // 'https://www.toysrus.com.my/beyblade-x-bx-28-string-launcher-white-ver.-10026909.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-ux-03-booster-wizard-rod-5-70db.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-23-starter-phoenix-wing-9-60gf.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-01-starter-dragon-sword.html',
    // 'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-40-winder-launcher-l.html',
    // 'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-28-string-launcher-white-ver.html',
    // 'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-47-l-string-launcher-red-ver.html',
    'https://www.beybladenexus.com/product/beyblade-x-wizard-rod-5-70db-booster-ux-03-takara-tomy',
    'https://www.beybladenexus.com/product/beyblade-x-phoenix-wing-9-60gf-starter-bx-23',
    'https://www.hlj.com/beyblade-bx-23-starter-phoenix-wing-9-60gf-tkt91309',
    'https://www.hlj.com/beyblade-x-ux-15-shark-scale-deck-set-tkt98243',
    // 'https://www.hlj.com/beyblade-x-bx-51-string-launcher-black-x-green-tkt08926',
    // 'https://www.hlj.com/beyblade-x-bx-28-string-launcher-white-tkt91451',
    // 'https://www.hlj.com/beyblade-x-bx-47-string-launcher-l-red-ver-tkt09739',
    // 'https://www.hlj.com/beyblade-x-bx-18-string-launcher-tkt91305',
    'https://www.toygarden.com/product/takara-tomy-beyblade-x-ux-15-shark-scale-deck-set',
    // 'https://www.toygarden.com/product/takara-tomy-beyblade-x-bx-28-string-launcher-white-ver',
    // 'https://www.toygarden.com/product/takara-tomy-beyblade-x-bx-40-winder-launcher-l',
];

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 3000;
const FETCH_RETRIES = parseInt(process.env.FETCH_RETRIES, 10) || 3;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const telegramEnabled = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

const color = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
};

function paint(text, tone) {
    return `${color[tone]}${text}${color.reset}`;
}

function isPremiumToyInStock(html) {
    const addToCartButton = html.match(
        /<button[^>]*\bclass="[^"]*\baddCartBtn_Detail\b[^"]*"[^>]*>[\s\S]*?\bAdd to Cart\b/i
    );
    if (addToCartButton) {
        return true;
    }

    if (/\bnoStockBtn\b/i.test(html) || /\bOut of stock\b/i.test(html)) {
        return false;
    }

    return /<button[^>]*\btitle="Add to Cart"[^>]*\bclass="[^"]*\baddCartBtn_Detail\b/i.test(
        html
    );
}

function isToyGardenInStock(html) {
    const addToCartButton = /<button[^>]*\bclass="[^"]*\bprimary-btn\b[^"]*"[^>]*>[\s\S]*?\bAdd to cart\b/i.test(
        html
    );
    if (addToCartButton) {
        return true;
    }

    const quantityMatch =
        html.match(/\\"productDetail\\":\{[\s\S]*?\\"quantity\\":(\d+)/) ||
        html.match(/"productDetail":\{[\s\S]*?"quantity":(\d+)/);
    if (quantityMatch) {
        return Number(quantityMatch[1]) > 0;
    }

    if (/\bSold Out\b/i.test(html)) {
        return false;
    }

    return false;
}

function isHljInStock(html) {
    const addToCartButton = /<button[^>]*\bid="addToCart"[^>]*>[\s\S]*?\bAdd To Cart\b/i.test(
        html
    );
    if (addToCartButton) {
        return true;
    }

    if (
        /\bBackordered\b/i.test(html) ||
        /Temporarily out of stock/i.test(html) ||
        /<button[^>]*\bid="openModal"[^>]*>[\s\S]*?\bNotify Me\b/i.test(html)
    ) {
        return false;
    }

    return false;
}

function isBeybladeNexusInStock(html) {
    const buyButton = /<button[^>]*\btype="submit"[^>]*\bclass="[^"]*\bbtn-primary\b[^"]*\bbtn-shadow\b[^"]*\bbtn-lg\b[^>]*>[\s\S]*?\bBuy\b/i.test(
        html
    );
    if (buyButton) {
        return true;
    }

    if (
        /Product is out of stock/i.test(html) ||
        /og:availability" content="out of stock"/i.test(html)
    ) {
        return false;
    }

    return false;
}

function isToysRUsInStock(html) {
    const addToCartButton = html.match(
        /<button[^>]*\bclass="[^"]*\badd-to-cart\b[^"]*"[^>]*>[\s\S]*?\bAdd to Cart\b/i
    );
    if (addToCartButton) {
        return true;
    }

    const availability = html.match(
        /\bdata-available="(true|false)"/i
    );
    if (availability) {
        return availability[1].toLowerCase() === 'true';
    }

    return false;
}

function getSite(url) {
    if (url.includes('toysrus.com.my')) {
        return 'toysrus';
    }
    if (url.includes('premiumtoy.my')) {
        return 'premiumtoy';
    }
    if (url.includes('malloftoys.com')) {
        return 'malloftoys';
    }
    if (url.includes('beybladenexus.com')) {
        return 'beybladenexus';
    }
    if (url.includes('hlj.com')) {
        return 'hlj';
    }
    if (url.includes('toygarden.com')) {
        return 'toygarden';
    }
    return 'unknown';
}

function isInStock(url, html) {
    const site = getSite(url);

    if (site === 'toysrus') {
        return isToysRUsInStock(html);
    }

    if (site === 'premiumtoy') {
        return isPremiumToyInStock(html);
    }

    if (site === 'beybladenexus') {
        return isBeybladeNexusInStock(html);
    }

    if (site === 'hlj') {
        return isHljInStock(html);
    }

    if (site === 'toygarden') {
        return isToyGardenInStock(html);
    }

    throw new Error(`Unsupported site: ${url}`);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
};

const SHOPIFY_JSON_HEADERS = {
    ...BROWSER_HEADERS,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://malloftoys.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
};

function mallOfToysJsonUrl(url) {
    const [path] = url.split('?');
    return `${path}.js`;
}

function isMallOfToysInStock(product) {
    if (typeof product?.available === 'boolean') {
        return product.available;
    }
    if (Array.isArray(product?.variants)) {
        return product.variants.some((variant) => variant.available);
    }
    throw new Error('Unexpected Mall of Toys product response');
}

async function fetchWithRetry(url, options) {
    let lastError;

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
        try {
            return await axios.get(url, options);
        } catch (error) {
            lastError = error;
            const status = error.response?.status;
            const retryable = status === 403 || status === 429 || status === 503;

            if (retryable && attempt < FETCH_RETRIES) {
                await sleep(1000 * (attempt + 1));
                continue;
            }

            if (status === 403) {
                throw new Error('403 Forbidden (Cloudflare bot protection)');
            }

            throw error;
        }
    }

    throw lastError;
}

async function fetchPageHtml(url) {
    const response = await fetchWithRetry(url, {
        headers: BROWSER_HEADERS,
        timeout: 30000,
    });
    return response.data;
}

async function fetchMallOfToysProduct(url) {
    const response = await fetchWithRetry(mallOfToysJsonUrl(url), {
        headers: SHOPIFY_JSON_HEADERS,
        timeout: 30000,
    });
    return response.data;
}

async function checkProduct(url) {
    if (getSite(url) === 'malloftoys') {
        const product = await fetchMallOfToysProduct(url);
        return isMallOfToysInStock(product);
    }

    const html = await fetchPageHtml(url);
    return isInStock(url, html);
}

function logPollSummary(timestamp, { newlyInStock, soldOutCount, errors, telegramNotes }) {
    const lines = [`[${timestamp}]`];

    if (newlyInStock.length > 0) {
        lines.push(paint(`IN STOCK (${newlyInStock.length}):`, 'green'));
        for (const url of newlyInStock) {
            lines.push(`  ${url}`);
        }
        for (const note of telegramNotes) {
            lines.push(`  ${paint(note, 'green')}`);
        }
    } else if (errors.length === 0) {
        lines.push(paint(`No stock found — ${soldOutCount} product(s) checked`, 'red'));
    }

    if (errors.length > 0) {
        lines.push(paint(`Errors (${errors.length}):`, 'yellow'));
        for (const { url, message } of errors) {
            lines.push(`  ${url} — ${message}`);
        }
        if (newlyInStock.length === 0 && soldOutCount > 0) {
            lines.push(paint(`${soldOutCount} product(s) still sold out`, 'red'));
        }
    }

    console.log(`${lines.join('\n')}\n`);
}

async function sendTelegramInStockAlert(url, timestamp) {
    if (!telegramEnabled) {
        return;
    }

    const text = `IN STOCK\n\n${url}\n\nDetected: ${timestamp}`;

    await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
            chat_id: TELEGRAM_CHAT_ID,
            text,
        },
        { timeout: 15000 }
    );
}

async function notifyInStock(url, timestamp) {
    const telegramNotes = [];

    if (telegramEnabled) {
        try {
            await sendTelegramInStockAlert(url, timestamp);
            telegramNotes.push('Telegram alert sent.');
        } catch (error) {
            const detail = error.response?.data?.description || error.message;
            telegramNotes.push(`Telegram alert failed: ${detail}`);
        }
    }

    return telegramNotes;
}

async function stockCheckLoop() {
    const pending = [...PRODUCTS];
    const inStockResults = [];

    console.log(`Monitoring ${pending.length} product(s). Stops when all are in stock.`);
    console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
    console.log(
        telegramEnabled
            ? paint('Telegram alerts: enabled', 'green')
            : paint('Telegram alerts: disabled (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)', 'yellow')
    );
    console.log('');

    while (pending.length > 0) {
        const timestamp = new Date().toISOString();
        const newlyInStock = [];
        const errors = [];
        const telegramNotes = [];
        let soldOutCount = 0;

        const checks = await Promise.all(
            pending.map(async (url) => {
                try {
                    const inStock = await checkProduct(url);
                    return { url, inStock, error: null };
                } catch (error) {
                    return { url, inStock: false, error };
                }
            })
        );

        const stillPending = [];

        for (const { url, inStock, error } of checks) {
            if (error) {
                errors.push({ url, message: error.message });
                stillPending.push(url);
                continue;
            }

            if (inStock) {
                const notes = await notifyInStock(url, timestamp);
                telegramNotes.push(...notes);
                newlyInStock.push(url);
                inStockResults.push({ url, foundAt: timestamp });
            } else {
                soldOutCount++;
                stillPending.push(url);
            }
        }

        logPollSummary(timestamp, { newlyInStock, soldOutCount, errors, telegramNotes });

        pending.length = 0;
        pending.push(...stillPending);

        if (pending.length > 0) {
            await sleep(POLL_INTERVAL_MS);
        }
    }

    if (inStockResults.length > 0) {
        const lines = [paint(`All in stock (${inStockResults.length}):`, 'green')];
        for (const result of inStockResults) {
            lines.push(`  [${result.foundAt}] ${result.url}`);
        }
        console.log(`${lines.join('\n')}\n`);
    } else {
        console.log(paint('Done — no stock found.', 'red'));
    }
}

stockCheckLoop().catch((error) => {
    console.error('Stock check failed:', error.message);
    process.exit(1);
});
