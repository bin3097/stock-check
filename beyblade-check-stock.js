require('dotenv').config({ quiet: true });

const axios = require('axios');

const PRODUCTS = [
    'https://malloftoys.com/products/ux-03-wizardrod-booster',
    'https://malloftoys.com/products/ux-15-sharkscale-deck-set',
    'https://malloftoys.com/products/ux-08-silver-wolf',
    'https://malloftoys.com/products/ux-01-dran-buster',
    'https://malloftoys.com/products/bx-23-pheonix-wing-starter-set?_pos=9&_sid=8c99b5c4c&_ss=r',
    'https://www.toysrus.com.my/beyblade-x-ux-15-shark-scale-deck-set-10098506.html',
    'https://www.toysrus.com.my/beyblade-x-ux-03-booster-wizard-rod-5-70db-10026914.html',
    'https://www.toysrus.com.my/beyblade-x-ux-01-starter-dran-buster-10026912.html',
    'https://www.toysrus.com.my/beyblade-x-ux-08-starter-silver-wolf-3-80fb-10057321.html',
    'https://www.toysrus.com.my/beyblade-bx-23-starter-phoenix-10016234.html',
    'https://www.toysrus.com.my/takara-tomy-beyblade-x-bx-34-starter-cobalt-dragoon-10039171.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-ux-03-booster-wizard-rod-5-70db.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-ux-06-booster-leon-crest-7-60gn.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-ux-01-starter-doran-buster-1-60a.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-23-starter-phoenix-wing-9-60gf.html',
    'https://www.premiumtoy.my/takara-tomy-beyblade-x-bx-34-starter-cobalt-dragoon-2-60c.html',
    'https://www.beybladenexus.com/product/beyblade-x-ux-01-starter-drain-buster-1-60a-takara-tomy',
    'https://www.beybladenexus.com/product/pre-order-beyblade-x-ux-15-sharkscale-deck-set-mid-late-august',
    'https://www.beybladenexus.com/product/beyblade-x-wizard-rod-5-70db-booster-ux-03-takara-tomy',
    'https://www.beybladenexus.com/product/beyblade-x-phoenix-wing-9-60gf-starter-bx-23',
    'https://www.hlj.com/beyblade-x-ux-01-starter-dranbuster-1-60a-tkt91447',
    'https://www.hlj.com/beyblade-bx-23-starter-phoenix-wing-9-60gf-tkt91309',
    'https://www.hlj.com/beyblade-x-ux-15-shark-scale-deck-set-tkt98243',
    'https://www.toygarden.com/product/takara-tomy-beyblade-x-ux-15-shark-scale-deck-set',
    'https://www.toygarden.com/product/takara-tomy-beyblade-x-ux-01-starter-dran-buster-1-60a'
];

const MALLOFTOYS_IN_STOCK_LABEL = 'Add to cart';

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS);
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

function getMallOfToysSubmitButtonLabel(html) {
    const match = html.match(
        /<button[^>]*\bname="add"[^>]*\bclass="[^"]*\bproduct-form__submit\b[^"]*"[^>]*>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i
    );
    if (!match) {
        const fallback = html.match(
            /<button[^>]*\bclass="[^"]*\bproduct-form__submit\b[^"]*"[^>]*>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i
        );
        return fallback ? fallback[1].trim() : null;
    }
    return match[1].trim();
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

    if (site === 'malloftoys') {
        const label = getMallOfToysSubmitButtonLabel(html);
        if (!label) {
            throw new Error('Could not find product submit button on page');
        }
        return label === MALLOFTOYS_IN_STOCK_LABEL;
    }

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
    'Accept-Language': 'en-MY,en;q=0.9',
};

async function fetchPageHtml(url) {
    const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 30000,
    });
    return response.data;
}

async function checkProduct(url) {
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
