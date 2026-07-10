const express = require('express');
const router = express.Router();
const https = require('https');

const CENSUS_DATASET_URL = 'https://data.transportation.gov/resource/az4n-8mr2.json';
const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN || null;

const FMCSA_RELAY_URL = process.env.FMCSA_RELAY_URL || null;
const FMCSA_RELAY_SECRET = process.env.FMCSA_RELAY_SECRET || null;

function httpRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                ...headers
            },
            timeout: 15000,
            family: 4
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

function fetchCensusData(directUrl) {
    if (FMCSA_RELAY_URL && FMCSA_RELAY_SECRET) {
        const relayUrl = `${FMCSA_RELAY_URL}?target=${encodeURIComponent(directUrl)}`;
        return httpRequest(relayUrl, { 'X-Relay-Secret': FMCSA_RELAY_SECRET });
    }
    return httpRequest(directUrl);
}

function buildCensusUrl(whereClause) {
    const params = new URLSearchParams({
        '$where': whereClause,
        '$order': 'mcs150_date DESC',
        '$limit': '1'
    });
    return `${CENSUS_DATASET_URL}?${params.toString()}`;
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
            rows = await fetchCensusData(url);
        } catch (networkError) {
            console.error('FMCSA Census network error:', networkError.code || '(no code)', networkError.message);
            return {
                success: false,
                error: 'Could not reach the FMCSA data service right now. This is a network issue on our server, not a problem with the MC/USDOT number — please try again shortly.',
                networkError: true
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