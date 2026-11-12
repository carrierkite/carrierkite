const express = require('express');
const router = express.Router();
const https = require('https');

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10
});

const CENSUS_DATASET_URL = 'https://data.transportation.gov/resource/az4n-8mr2.json';
const SOCRATA_APP_TOKEN = (process.env.SOCRATA_APP_TOKEN || '').trim() || null;

const FMCSA_RELAY_URL = (process.env.FMCSA_RELAY_URL || '').trim() || null;
const FMCSA_RELAY_SECRET = (process.env.FMCSA_RELAY_SECRET || '').trim() || null;

const CENSUS_SELECT_FIELDS = [
    'dot_number',
    'legal_name',
    'dba_name',
    'phone',
    'phy_street',
    'phy_city',
    'phy_state',
    'phy_zip',
    'status_code',
    'carrier_operation',
    'safety_rating',
    'mcs150_date',
    'email_address',
    'docket1prefix',
    'docket1',
    'docket2prefix',
    'docket2',
    'docket3prefix',
    'docket3'
].join(',');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const carrierCache = new Map();
const inFlightLookups = new Map();

function getCachedCarrier(key, allowStale = false) {
    const entry = carrierCache.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now <= entry.expiresAt) {
        return entry.value;
    }
    if (allowStale && now <= entry.staleUntil) {
        return entry.value;
    }
    if (now > entry.staleUntil) {
        carrierCache.delete(key);
    }
    return null;
}

function setCachedCarrier(key, value) {
    if (carrierCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = carrierCache.keys().next().value;
        carrierCache.delete(oldestKey);
    }
    const now = Date.now();
    carrierCache.set(key, {
        value,
        expiresAt: now + CACHE_TTL_MS,
        staleUntil: now + STALE_TTL_MS
    });
}

function httpRequest(url, headers = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            agent: httpsAgent,
            headers: {
                'User-Agent': 'CarrierKite/1.0 (+https://carrierkite.com)',
                'Accept': 'application/json',
                ...(SOCRATA_APP_TOKEN ? { 'X-App-Token': SOCRATA_APP_TOKEN } : {}),
                ...headers
            },
            timeout: timeoutMs,
            family: 4
        }, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const err = new Error(`Request failed with status ${response.statusCode}: ${data.slice(0, 300)}`);
                    err.statusCode = response.statusCode;
                    return reject(err);
                }
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Failed to parse response as JSON')); }
            });
        });
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            const timeoutError = new Error(`Request timeout after ${timeoutMs / 1000}s`);
            timeoutError.code = 'ETIMEDOUT_CUSTOM';
            reject(timeoutError);
        });
    });
}

function isRetryableError(err) {
    const retryableCodes = new Set([
        'ETIMEDOUT_CUSTOM',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EAI_AGAIN',
        'EPIPE'
    ]);
    if (err.code && retryableCodes.has(err.code)) return true;
    if (err.statusCode && [429, 500, 502, 503, 504].includes(err.statusCode)) return true;
    return false;
}

async function fetchCensusData(directUrl) {
    const maxAttempts = 2;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (FMCSA_RELAY_URL && FMCSA_RELAY_SECRET) {
                const relayUrl = `${FMCSA_RELAY_URL}?target=${encodeURIComponent(directUrl)}`;
                try {
                    return await httpRequest(relayUrl, { 'X-Relay-Secret': FMCSA_RELAY_SECRET });
                } catch (relayErr) {
                    console.warn(`FMCSA relay failed (attempt ${attempt}):`, relayErr.statusCode || relayErr.code || relayErr.message);
                    return await httpRequest(directUrl);
                }
            }
            return await httpRequest(directUrl);
        } catch (err) {
            lastError = err;
            if (attempt < maxAttempts && isRetryableError(err)) {
                await new Promise(resolve => setTimeout(resolve, 600 * attempt));
                continue;
            }
            throw err;
        }
    }

    throw lastError;
}

function buildCensusUrl(whereClause) {
    const params = new URLSearchParams({
        '$select': CENSUS_SELECT_FIELDS,
        '$where': whereClause,
        '$limit': '5'
    });
    let url = `${CENSUS_DATASET_URL}?${params.toString()}`;
    if (SOCRATA_APP_TOKEN) {
        url += `&$$app_token=${encodeURIComponent(SOCRATA_APP_TOKEN)}`;
    }
    return url;
}

function pickLatestRecord(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    if (rows.length === 1) return rows[0];
    return [...rows].sort((a, b) => {
        const dateA = a.mcs150_date ? Date.parse(a.mcs150_date) || 0 : 0;
        const dateB = b.mcs150_date ? Date.parse(b.mcs150_date) || 0 : 0;
        return dateB - dateA;
    })[0];
}

function normalizeCarrier(record) {
    const mcNumber = record.docket1prefix === 'MC' ? record.docket1
        : (record.docket2prefix === 'MC' ? record.docket2
        : (record.docket3prefix === 'MC' ? record.docket3 : null));

    return {
        mcNumber: mcNumber || null,
        usdotNumber: record.dot_number || null,
        legalName: record.legal_name || null,
        dbaName: record.dba_name || null,
        phone: record.phone || null,
        physicalAddress: {
            street: record.phy_street || null,
            city: record.phy_city || null,
            state: record.phy_state || null,
            zip: record.phy_zip || null
        },
        status: record.status_code === 'A' ? 'Active' : (record.status_code === 'I' ? 'Inactive' : record.status_code),
        carrierOperation: record.carrier_operation || null,
        safetyRating: record.safety_rating || null,
        mcs150Date: record.mcs150_date || null,
        email: record.email_address ? record.email_address.trim().toLowerCase() : null,
        verified: true,
        source: 'FMCSA Company Census File (data.transportation.gov)'
    };
}

async function lookupCarrier(mcNumber, usdotNumber) {
    try {
        if (!usdotNumber && !mcNumber) {
            return { success: false, error: 'MC or USDOT number required' };
        }

        const cacheKey = usdotNumber ? `usdot:${usdotNumber}` : `mc:${mcNumber}`;
        const cached = getCachedCarrier(cacheKey);
        if (cached) {
            return cached;
        }

        if (inFlightLookups.has(cacheKey)) {
            return await inFlightLookups.get(cacheKey);
        }

        const lookupPromise = (async () => {
            let rows;
            try {
                if (usdotNumber) {
                    rows = await fetchCensusData(buildCensusUrl(`dot_number=${Number(usdotNumber)}`));
                } else {
                    // Fast path: check primary docket1 first before scanning docket2/docket3
                    rows = await fetchCensusData(
                        buildCensusUrl(`docket1prefix='MC' AND docket1='${mcNumber}'`)
                    );
                    if (!Array.isArray(rows) || rows.length === 0) {
                        rows = await fetchCensusData(
                            buildCensusUrl(`(docket2prefix='MC' AND docket2='${mcNumber}') OR (docket3prefix='MC' AND docket3='${mcNumber}')`)
                        );
                    }
                }
            } catch (networkError) {
                console.error(
                    'FMCSA Census error:',
                    networkError.statusCode || networkError.code || '(no code)',
                    networkError.message
                );
                const staleCached = getCachedCarrier(cacheKey, true);
                if (staleCached) {
                    console.warn('Serving stale cached carrier for:', cacheKey);
                    return staleCached;
                }
                const message = networkError.statusCode === 429
                    ? 'The FMCSA open data service is temporarily busy (rate limited). Please wait a few seconds and try again.'
                    : 'Could not reach the FMCSA data service right now (upstream service timeout or temporary outage). Please try again shortly.';
                return {
                    success: false,
                    error: message,
                    networkError: true
                };
            }

            const latestRecord = pickLatestRecord(rows);
            if (!latestRecord) {
                return { success: false, error: 'Carrier not found in FMCSA database. Double-check the MC or USDOT number.' };
            }

            const carrier = normalizeCarrier(latestRecord);

            if (!carrier.email) {
                const result = {
                    success: false,
                    error: 'This carrier does not have an email on file with FMCSA (their MCS-150 filing is missing or predates the email requirement). They may need to update their FMCSA registration, or you can verify manually and record it.',
                    carrier,
                    requiresManualVerification: true
                };
                setCachedCarrier(cacheKey, result);
                return result;
            }

            const result = { success: true, carrier };
            setCachedCarrier(cacheKey, result);
            return result;
        })();

        inFlightLookups.set(cacheKey, lookupPromise);
        try {
            return await lookupPromise;
        } finally {
            inFlightLookups.delete(cacheKey);
        }

    } catch (error) {
        console.error('FMCSA Census lookup error:', error.message);
        return {
            success: false,
            error: 'FMCSA data lookup temporarily unavailable. Please try again in a moment.',
            networkError: true
        };
    }
}

router.get('/lookup', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const { mc, usdot } = req.query;

        if (!mc && !usdot) {
            return res.status(400).json({
                success: false,
                error: 'Please provide MC Number or USDOT Number'
            });
        }

        const cleanMC = mc ? mc.replace(/^MC[-]?/i, '').trim() : null;
        const cleanUSDOT = usdot ? usdot.replace(/[^0-9]/g, '').trim() : null;

        if (cleanMC && !/^\d{4,7}$/.test(cleanMC)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid MC Number format. Expected 4-7 digits.'
            });
        }

        if (cleanUSDOT && !/^\d{5,8}$/.test(cleanUSDOT)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid USDOT Number format. Expected 5-8 digits.'
            });
        }

        const result = await lookupCarrier(cleanMC, cleanUSDOT);

        if (!result.success) {
            let status = 404;
            if (result.requiresManualVerification) status = 422;
            if (result.networkError) status = 503;
            return res.status(status).json(result);
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Carrier lookup error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to lookup carrier. Please try again.'
        });
    }
});

router.post('/verify-email', async (req, res) => {
    try {
        const { mcNumber, usdotNumber, email } = req.body;

        if (!mcNumber && !usdotNumber) {
            return res.status(400).json({
                success: false,
                error: 'MC Number or USDOT Number required'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        const cleanMC = mcNumber ? String(mcNumber).replace(/^MC[-]?/i, '').trim() : null;
        const cleanUSDOT = usdotNumber ? String(usdotNumber).replace(/[^0-9]/g, '').trim() : null;

        const result = await lookupCarrier(cleanMC, cleanUSDOT);

        if (!result.success || !result.carrier.email) {
            return res.status(404).json({
                success: false,
                verified: false,
                error: result.error || 'Could not verify carrier email'
            });
        }

        const matches = result.carrier.email.toLowerCase() === String(email).toLowerCase();

        return res.status(200).json({
            success: true,
            verified: matches,
            fmcsaEmail: result.carrier.email,
            carrier: result.carrier
        });

    } catch (error) {
        console.error('Verify email error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify carrier email'
        });
    }
});

module.exports = router;
module.exports.lookupCarrier = lookupCarrier;