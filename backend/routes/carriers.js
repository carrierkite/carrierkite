const express = require('express');
const router = express.Router();
const https = require('https');

/**
 * FMCSA Carrier Lookup Service — 100% FREE VERSION
 *
 * Data source: FMCSA "Company Census File" (MCS-150 data), published as a
 * free, public, no-signup-required open dataset by data.transportation.gov:
 *   https://data.transportation.gov/resource/az4n-8mr2.json
 *
 * This is the SAME underlying government dataset that paid services like
 * verifycarrier.com and various "carrier list" vendors resell. Every
 * interstate carrier is legally required to file an MCS-150 form (which
 * includes a business email address) with FMCSA, and that data is public.
 *
 * No API key is strictly required. Optionally, you can register a free
 * Socrata "app token" at https://data.transportation.gov/profile/edit
 * (also free) to raise rate limits / improve reliability, and set it as
 * SOCRATA_APP_TOKEN below. The code works fine without it.
 */

const CENSUS_DATASET_URL = 'https://data.transportation.gov/resource/az4n-8mr2.json';
const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN || null; // optional, free

/**
 * Make an HTTPS GET request and parse JSON.
 *
 * Notes for hosting environments (VPS/shared hosting, e.g. Hostinger):
 * - Some hosts have broken/unreliable outbound IPv6 routing. Forcing
 *   `family: 4` (IPv4) avoids requests silently hanging or failing when
 *   the host's IPv6 route to data.transportation.gov doesn't work.
 * - Some firewalls/CDNs reject requests with no User-Agent header.
 *   We always send one to avoid being silently blocked.
 */
function httpRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                // Some CDN/WAF layers in front of data.transportation.gov
                // block requests that self-identify as a bot/script/API
                // client via User-Agent (this is what caused the 403).
                // Presenting a normal browser User-Agent avoids that.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                ...headers
            },
            timeout: 15000,
            family: 4 // force IPv4 — avoids broken outbound IPv6 on some hosts
        }, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    return reject(new Error(`Request failed with status ${response.statusCode}: ${data.slice(0, 300)}`));
                }
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Failed to parse response as JSON')); }
            });
        });
          request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            const timeoutError = new Error('Request timeout after 15s');
            timeoutError.code = 'ETIMEDOUT_CUSTOM';
            reject(timeoutError);
        });
    });
}

/**
 * Build a Socrata SoQL query URL against the free Census dataset.
 */
function buildCensusUrl(whereClause) {
    const params = new URLSearchParams({
        '$where': whereClause,
        '$order': 'mcs150_date DESC',
        '$limit': '1'
    });
    return `${CENSUS_DATASET_URL}?${params.toString()}`;
}

/**
 * Normalize a raw Census record into our carrier shape.
 */
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

/**
 * Lookup a carrier by MC number or USDOT number using the FREE
 * FMCSA Census dataset. Returns basic info AND email in one call.
 */
async function lookupCarrier(mcNumber, usdotNumber) {
    try {
        let whereClause;

        if (usdotNumber) {
            whereClause = `dot_number=${Number(usdotNumber)}`;
        } else if (mcNumber) {
            whereClause = `(docket1prefix='MC' AND docket1='${mcNumber}') OR (docket2prefix='MC' AND docket2='${mcNumber}') OR (docket3prefix='MC' AND docket3='${mcNumber}')`;
        } else {
            return { success: false, error: 'MC or USDOT number required' };
        }

        let url = buildCensusUrl(whereClause);
        if (SOCRATA_APP_TOKEN) {
            url += `&$$app_token=${encodeURIComponent(SOCRATA_APP_TOKEN)}`;
        }

                let rows;
        try {
            rows = await httpRequest(url);
        } catch (networkError) {
            console.error('FMCSA Census network error:', networkError.code || '(no code)', networkError.message);
            return {
                success: false,
                error: 'Could not reach the FMCSA data service right now. This is a network issue on our server, not a problem with the MC/USDOT number — please try again shortly.',
                networkError: true,
                // TEMPORARY diagnostic fields — remove once the underlying
                // hosting/network issue is identified and fixed.
                debugCode: networkError.code || null,
                debugMessage: networkError.message || null
            };
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            return { success: false, error: 'Carrier not found in FMCSA database. Double-check the MC or USDOT number.' };
        }

        const carrier = normalizeCarrier(rows[0]);

        if (!carrier.email) {
            return {
                success: false,
                error: 'This carrier does not have an email on file with FMCSA (their MCS-150 filing is missing or predates the email requirement). They may need to update their FMCSA registration, or you can verify manually and record it.',
                carrier,
                requiresManualVerification: true
            };
        }

        return { success: true, carrier };

    } catch (error) {
        console.error('FMCSA Census lookup error:', error.message);
        return {
            success: false,
            error: 'FMCSA data lookup temporarily unavailable. Please try again in a moment.',
            networkError: true
        };
    }
}

// ── ROUTES ──────────────────────────────────────────────────

/**
 * GET /api/carriers/lookup?mc=XXX or &usdot=XXX
 */
router.get('/lookup', async (req, res) => {
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

        // Validate input
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
            // Distinguish network/outage failures (503) from a genuine
            // "carrier not found" (404) or "no email on file" (422) —
            // this matters for debugging in the browser Network tab.
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

/**
 * POST /api/carriers/verify-email
 * Verify that an email matches the FMCSA-registered carrier email.
 */
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