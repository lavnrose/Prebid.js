/*
  TargetingGates PreBid Module by Wider Planet, Inc.
*/
import {
    config
} from 'src/config';
import {
    registerBidder
} from 'src/adapters/bidderFactory';
import * as utils from 'src/utils';
import {
    userSync
} from 'src/userSync';
import {
    BANNER,
    NATIVE,
    NATIVEVIDEO,
    VIDEO
} from 'src/mediaTypes';
import {
    parse
} from 'src/url';

// const SUPPORTED_AD_TYPES = [BANNER, NATIVE, NATIVEVIDEO, VIDEO];
const SUPPORTED_AD_TYPES = [BANNER, VIDEO, NATIVE, NATIVEVIDEO];
const BIDDER_CODE = 'targetinggates';
const BIDDER_CONFIG = 'hb_pb';
const BIDDER_VERSION = '1.0.0';

let shouldSendBoPixel = true;
export function resetBoPixel() {
    shouldSendBoPixel = true;
}

export const spec = {
    code: BIDDER_CODE,
    supportedMediaTypes: SUPPORTED_AD_TYPES,
    isBidRequestValid: function(bidRequest) {
        return !!(bidRequest.params.unit && bidRequest.params.delDomain);
    },
    buildRequests: function(bidRequests, bidderRequest) {
        if (bidRequests.length === 0) {
            return [];
        }

        let requests = [];
        let [videoBids, bannerBids] = partitionByVideoBids(bidRequests);

        // build banner requests
        if (bannerBids.length > 0) {
            requests.push(buildTGBannerRequest(bannerBids, bidderRequest));
        }
        // build video requests
        if (videoBids.length > 0) {
            videoBids.forEach(videoBid => {
                requests.push(buildTGVideoRequest(videoBid, bidderRequest))
            });
        }

        return requests;
    },
    interpretResponse: function({
        body: tgResponseObj
    }, serverRequest) {
        let mediaType = getMediaTypeFromRequest(serverRequest);
        switch (mediaType) {
            case VIDEO:
                return createVideoBidResponses(tgResponseObj, serverRequest.payload);
                break;
            case NATIVEVIDEO:
                return createNativeVideoBidResponses(tgResponseObj, serverRequest.payload);
                break;
            case NATIVE:
                return createNativeBidResponses(tgResponseObj, serverRequest.payload);
                break;
            default:
                return createBannerBidResponses(tgResponseObj, serverRequest.payload);
                break;
        }
    },
    getUserSyncs: function(syncOptions, responses) {
        if (syncOptions.iframeEnabled) {
            let url = utils.deepAccess(responses, '0.body.ads.pixels') ||
                utils.deepAccess(responses, '0.body.pixels') ||
                '//adtg.widerplanet.com/delivery/pdirect.php';
            /*
            // //astg.widerplanet.com/delivery/wpc.php?v=1&ver=4.0&r=1&md=bs&ga=1df4nk6-16ec81t-3-1&eid=4-cf1e72bfe9b200d09c785bd435a8ad12dc1348820dee37df1cc48d4f2cd3ef70f059178fefd87a71fe2e6a926b17c80fceeb9239782c6a842c1b3b25eaba64938a9fe550d1ae3301589dd9e7dd67d606&ty=Home&ti=30735&device=web&charset=UTF-8&tc=1529299340984&loc=http%3A%2F%2Fwww.widerplanet.com.%2F

            Scheme: https
            Protocol: https
            Authority: astg.widerplanet.com
            Host: astg.widerplanet.com
            Hostname: astg.widerplanet.com
            Subdomain: astg
            Domain: widerplanet.com
            Tld: com
            Resource: /delivery/wpc.php?v=1&ver=4.0&r=1&md=bs&ga=1df4nk6-16ec81t-3-1&eid=4-cf1e72bfe9b200d09c785bd435a8ad12dc1348820dee37df1cc48d4f2cd3ef70f059178fefd87a71fe2e6a926b17c80fceeb9239782c6a842c1b3b25eaba64938a9fe550d1ae3301589dd9e7dd67d606&ty=Home&ti=30735&device=web&charset=UTF-8&tc=1529299340984&loc=http%3A%2F%2Fwww.widerplanet.com.%2F
            Directory: /delivery
            Path: /delivery/wpc.php
            File name: wpc.php
            File suffix: php
            Query string: v=1&ver=4.0&r=1&md=bs&ga=1df4nk6-16ec81t-3-1&eid=4-cf1e72bfe9b200d09c785bd435a8ad12dc1348820dee37df1cc48d4f2cd3ef70f059178fefd87a71fe2e6a926b17c80fceeb9239782c6a842c1b3b25eaba64938a9fe550d1ae3301589dd9e7dd67d606&ty=Home&ti=30735&device=web&charset=UTF-8&tc=1529299340984&loc=http%3A%2F%2Fwww.widerplanet.com.%2F

            'v': 1
            'ver': 4.0
            'r': 1
            'md': bs
            'ga': 1df4nk6-16ec81t-3-1
            'eid': 4-cf1e72bfe9b200d09c785bd435a8ad12dc1348820dee37df1cc48d4f2cd3ef70f059178fefd87a71fe2e6a926b17c80fceeb9239782c6a842c1b3b25eaba64938a9fe550d1ae3301589dd9e7dd67d606
            'ty': Home
            'ti': 30735
            'device': web
            'charset': UTF-8
            'tc': 1529299340984
            'loc': http://www.widerplanet.com./
            */

            return [{
                type: 'iframe',
                url: url,
            }];
        }
    }
};

function isVideoRequest(bidRequest) {
    return utils.deepAccess(bidRequest, 'mediaTypes.video') || bidRequest.mediaType === VIDEO;
}

function createNativeBidResponses(tgResponseObj, {
    bids,
    startTime
}) {
    let adUnits = tgResponseObj.ads.ad;
    let bidResponses = [];
    for (let i = 0; i < adUnits.length; i++) {
        let adUnit = adUnits[i];
        let adUnitIdx = parseInt(adUnit.idx, 10);
        let bidResponse = {};

        bidResponse.requestId = bids[adUnitIdx].bidId;

        if (adUnit.pub_rev) {
            bidResponse.cpm = Number(adUnit.pub_rev) / 1000;
        } else {
            // No fill, do not add the bidresponse
            continue;
        }
        let creative = adUnit.creative[0];
        if (creative) {
            bidResponse.width = creative.width;
            bidResponse.height = creative.height;
        }
        bidResponse.creativeId = creative.id;
        bidResponse.ad = adUnit.html;
        if (adUnit.deal_id) {
            bidResponse.dealId = adUnit.deal_id;
        }
        // default 5 mins
        bidResponse.ttl = 300;
        // true is net, false is gross
        bidResponse.netRevenue = true;
        bidResponse.currency = adUnit.currency;

        // additional fields to add
        if (adUnit.tbd) {
            bidResponse.tbd = adUnit.tbd;
        }
        bidResponse.ts = adUnit.ts;
        bidResponses.push(bidResponse);
        registerBeacon(BANNER, adUnit, startTime);
    }
    return bidResponses;
}

function createBannerBidResponses(tgResponseObj, {
    bids,
    startTime
}) {
    let adUnits = tgResponseObj.ads.ad;
    let bidResponses = [];
    for (let i = 0; i < adUnits.length; i++) {
        let adUnit = adUnits[i];
        let adUnitIdx = parseInt(adUnit.idx, 10);
        let bidResponse = {};

        bidResponse.requestId = bids[adUnitIdx].bidId;

        if (adUnit.pub_rev) {
            bidResponse.cpm = Number(adUnit.pub_rev) / 1000;
        } else {
            // No fill, do not add the bidresponse
            continue;
        }
        let creative = adUnit.creative[0];
        if (creative) {
            bidResponse.width = creative.width;
            bidResponse.height = creative.height;
        }
        bidResponse.creativeId = creative.id;
        bidResponse.ad = adUnit.html;
        if (adUnit.deal_id) {
            bidResponse.dealId = adUnit.deal_id;
        }
        // default 5 mins
        bidResponse.ttl = 300;
        // true is net, false is gross
        bidResponse.netRevenue = true;
        bidResponse.currency = adUnit.currency;

        // additional fields to add
        if (adUnit.tbd) {
            bidResponse.tbd = adUnit.tbd;
        }
        bidResponse.ts = adUnit.ts;
        bidResponses.push(bidResponse);
        registerBeacon(BANNER, adUnit, startTime);
    }
    return bidResponses;
}

function buildQueryStringFromParams(params) {
    for (let key in params) {
        if (params.hasOwnProperty(key)) {
            if (!params[key]) {
                delete params[key];
            }
        }
    }
    return utils._map(Object.keys(params), key => `${key}=${params[key]}`)
        .join('&');
}

function getViewportDimensions(isIfr) {
    let width;
    let height;
    let tWin = window;
    let tDoc = document;
    let docEl = tDoc.documentElement;
    let body;

    if (isIfr) {
        try {
            tWin = window.top;
            tDoc = window.top.document;
        } catch (e) {
            return;
        }
        docEl = tDoc.documentElement;
        body = tDoc.body;

        width = tWin.innerWidth || docEl.clientWidth || body.clientWidth;
        height = tWin.innerHeight || docEl.clientHeight || body.clientHeight;
    } else {
        docEl = tDoc.documentElement;
        width = tWin.innerWidth || docEl.clientWidth;
        height = tWin.innerHeight || docEl.clientHeight;
    }

    return `${width}x${height}`;
}

function formatCustomParms(customKey, customParams) {
    let value = customParams[customKey];
    if (utils.isArray(value)) {
        // if value is an array, join them with commas first
        value = value.join(',');
    }
    // return customKey=customValue format, escaping + to . and / to _
    return (customKey.toLowerCase() + '=' + value.toLowerCase()).replace('+', '.').replace('/', '_')
}

function partitionByVideoBids(bidRequests) {
    return bidRequests.reduce(function(acc, bid) {
        // Fallback to banner ads if nothing specified
        if (isVideoRequest(bid)) {
            acc[0].push(bid);
        } else {
            acc[1].push(bid);
        }
        return acc;
    }, [
        [],
        []
    ]);
}

function getMediaTypeFromRequest(serverRequest) {
    return /avjp$/.test(serverRequest.url) ? VIDEO : BANNER;
}

function buildCommonQueryParamsFromBids(bids, bidderRequest) {
    const isInIframe = utils.inIframe();
    let defaultParams;

    defaultParams = {
        ju: config.getConfig('pageUrl') || utils.getTopWindowUrl(),
        jr: utils.getTopWindowReferrer(),
        ch: document.charSet || document.characterSet,
        res: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        ifr: isInIframe,
        tz: new Date().getTimezoneOffset(),
        tws: getViewportDimensions(isInIframe),
        be: 1,
        dddid: utils._map(bids, bid => bid.transactionId).join(','),
        nocache: new Date().getTime()
    };

    if (utils.deepAccess(bidderRequest, 'gdprConsent')) {
        let gdprConsentConfig = bidderRequest.gdprConsent;

        if (gdprConsentConfig.consentString !== undefined) {
            defaultParams.gdpr_consent = gdprConsentConfig.consentString;
        }

        if (gdprConsentConfig.gdprApplies !== undefined) {
            defaultParams.gdpr = gdprConsentConfig.gdprApplies ? 1 : 0;
        }

        if (config.getConfig('consentManagement.cmpApi') === 'iab') {
            defaultParams.x_gdpr_f = 1;
        }
    }

    return defaultParams;
}

function buildtgBannerRequest(bids, bidderRequest) {
    let queryParams = buildCommonQueryParamsFromBids(bids, bidderRequest);

    queryParams.auid = utils._map(bids, bid => bid.params.unit).join(',');
    queryParams.aus = utils._map(bids, bid => utils.parseSizesInput(bid.sizes).join(',')).join('|');
    queryParams.bc = bids[0].params.bc || `${BIDDER_CONFIG}_${BIDDER_VERSION}`;

    let customParamsForAllBids = [];
    let hasCustomParam = false;
    bids.forEach(function(bid) {
        if (bid.params.customParams) {
            let customParamsForBid = utils._map(Object.keys(bid.params.customParams), customKey => formatCustomParms(customKey, bid.params.customParams));
            let formattedCustomParams = window.btoa(customParamsForBid.join('&'));
            hasCustomParam = true;
            customParamsForAllBids.push(formattedCustomParams);
        } else {
            customParamsForAllBids.push('');
        }
    });
    if (hasCustomParam) {
        queryParams.tps = customParamsForAllBids.join(',');
    }

    let customFloorsForAllBids = [];
    let hasCustomFloor = false;
    bids.forEach(function(bid) {
        if (bid.params.customFloor) {
            customFloorsForAllBids.push(bid.params.customFloor * 1000);
            hasCustomFloor = true;
        } else {
            customFloorsForAllBids.push(0);
        }
    });
    if (hasCustomFloor) {
        queryParams.aumfs = customFloorsForAllBids.join(',');
    }

    let url = `//${bids[0].params.delDomain}/w/1.0/arj`;
    return {
        method: 'GET',
        url: url,
        data: queryParams,
        payload: {
            'bids': bids,
            'startTime': new Date()
        }
    };
}

function buildTGVideoRequest(bid, bidderRequest) {
    let url = `//${bid.params.delDomain}/v/1.0/avjp`;
    let tgVideoParams = generateVideoParameters(bid, bidderRequest);
    return {
        method: 'GET',
        url: url,
        data: tgVideoParams,
        payload: {
            'bid': bid,
            'startTime': new Date()
        }
    };
}

function generateVideoParameters(bid, bidderRequest) {
    let queryParams = buildCommonQueryParamsFromBids([bid], bidderRequest);
    let tgVideoConfig = utils.deepAccess(bid, 'params.video') || {};
    let context = utils.deepAccess(bid, 'mediaTypes.video.context');
    let playerSize = utils.deepAccess(bid, 'mediaTypes.video.playerSize');
    let width;
    let height;

    // normalize config for video size
    if (utils.isArray(bid.sizes) && bid.sizes.length === 2 && !utils.isArray(bid.sizes[0])) {
        width = parseInt(bid.sizes[0], 10);
        height = parseInt(bid.sizes[1], 10);
    } else if (utils.isArray(bid.sizes) && utils.isArray(bid.sizes[0]) && bid.sizes[0].length === 2) {
        width = parseInt(bid.sizes[0][0], 10);
        height = parseInt(bid.sizes[0][1], 10);
    } else if (utils.isArray(playerSize) && playerSize.length === 2) {
        width = parseInt(playerSize[0], 10);
        height = parseInt(playerSize[1], 10);
    }

    Object.keys(tgVideoConfig).forEach(function(key) {
        if (key === 'openrtb') {
            tgVideoConfig[key].w = width || tgVideoConfig[key].w;
            tgVideoConfig[key].v = height || tgVideoConfig[key].v;
            queryParams[key] = JSON.stringify(tgVideoConfig[key]);
        } else if (!(key in queryParams) && key !== 'url') {
            // only allow video-related attributes
            queryParams[key] = tgVideoConfig[key];
        }
    });

    queryParams.auid = bid.params.unit;
    // override prebid config with TargetingGates config if available
    queryParams.vwd = width || tgVideoConfig.vwd;
    queryParams.vht = height || tgVideoConfig.vht;

    if (context === 'outstream') {
        queryParams.vos = '101';
    }

    if (tgVideoConfig.mimes) {
        queryParams.vmimes = tgVideoConfig.mimes;
    }

    return queryParams;
}

function createVideoBidResponses(response, {
    bid,
    startTime
}) {
    let bidResponses = [];

    if (response !== undefined && response.vastUrl !== '' && response.pub_rev !== '') {
        let vastQueryParams = parse(response.vastUrl).search || {};
        let bidResponse = {};
        bidResponse.requestId = bid.bidId;
        bidResponse.bidderCode = BIDDER_CODE;
        // default 5 mins
        bidResponse.ttl = 300;
        // true is net, false is gross
        bidResponse.netRevenue = true;
        bidResponse.currency = response.currency;
        bidResponse.cpm = Number(response.pub_rev) / 1000;
        bidResponse.width = response.width;
        bidResponse.height = response.height;
        bidResponse.creativeId = response.adid;
        bidResponse.vastUrl = response.vastUrl;
        bidResponse.mediaType = VIDEO;

        // enrich adunit with vast parameters
        response.ph = vastQueryParams.ph;
        response.colo = vastQueryParams.colo;
        response.ts = vastQueryParams.ts;

        bidResponses.push(bidResponse);

        registerBeacon(VIDEO, response, startTime)
    }

    return bidResponses;
}

function createNativeVideoBidResponses(response, {
    bid,
    startTime
}) {
    let bidResponses = [];

    if (response !== undefined && response.vastUrl !== '' && response.pub_rev !== '') {
        let vastQueryParams = parse(response.vastUrl).search || {};
        let bidResponse = {};
        bidResponse.requestId = bid.bidId;
        bidResponse.bidderCode = BIDDER_CODE;
        // default 5 mins
        bidResponse.ttl = 300;
        // true is net, false is gross
        bidResponse.netRevenue = true;
        bidResponse.currency = response.currency;
        bidResponse.cpm = Number(response.pub_rev) / 1000;
        bidResponse.width = response.width;
        bidResponse.height = response.height;
        bidResponse.creativeId = response.adid;
        bidResponse.vastUrl = response.vastUrl;
        bidResponse.mediaType = VIDEO;

        // enrich adunit with vast parameters
        response.ph = vastQueryParams.ph;
        response.colo = vastQueryParams.colo;
        response.ts = vastQueryParams.ts;

        bidResponses.push(bidResponse);

        registerBeacon(VIDEO, response, startTime)
    }

    return bidResponses;
}

function registerBeacon(mediaType, adUnit, startTime) {
    // only register beacon once
    if (!shouldSendBoPixel) {
        return;
    }
    shouldSendBoPixel = false;

    let bt = config.getConfig('bidderTimeout');
    let beaconUrl;
    if (window.PREBID_TIMEOUT) {
        bt = Math.min(window.PREBID_TIMEOUT, bt);
    }

    let beaconParams = {
        bd: +(new Date()) - startTime,
        bp: adUnit.pub_rev,
        br: '0', // may be 0, t, or p
        bs: utils.getTopWindowLocation().hostname,
        bt: bt,
        ts: adUnit.ts
    };

    beaconParams.br = beaconParams.bt < beaconParams.bd ? 't' : 'p';

    if (mediaType === VIDEO) {
        let url = parse(adUnit.colo);
        beaconParams.ph = adUnit.ph;
        beaconUrl = `//${url.hostname}/w/1.0/bo?${buildQueryStringFromParams(beaconParams)}`
    } else {
        let recordPixel = utils.deepAccess(adUnit, 'creative.0.tracking.impression');
        let boBase = recordPixel.match(/([^?]+\/)ri\?/);

        if (boBase && boBase.length > 1) {
            beaconUrl = `${boBase[1]}bo?${buildQueryStringFromParams(beaconParams)}`;
        }
    }

    if (beaconUrl) {
        userSync.registerSync('image', BIDDER_CODE, beaconUrl);
    }
}

registerBidder(spec);