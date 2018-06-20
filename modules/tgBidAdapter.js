/**
 *
 * TargetingGates Bid Adapter by Wider Planet, Inc.
 *
 * Contact: adcon-team@widerplanet.com
 *
 * Aliases - 'targetinggate' is supported for backwards compatibility.
 * Formats - Display/Native/Native Video/Outstream formats supported.
 *
 * References: xhbBidAdapter, rtbdemandadk, pubmatic, platformio
 *
 * eslint dot-notation:0, quote-props:0
 *
 */

import {
    config
} from 'src/config';
import * as utils from 'src/utils';

import {
    registerBidder
} from 'src/adapters/bidderFactory';
import {
    userSync
} from 'src/userSync';
import {
    BANNER,
    VIDEO,
    NATIVE,
    NATIVEVIDEO
} from 'src/mediaTypes';
import {
    parse
} from 'src/url';

// const constants = require('src/constants.json');
// const SUPPORTED_AD_TYPES = [BANNER, VIDEO, NATIVE, NATIVEVIDEO];
// const BIDDER_ALIASES = ['targetinggate', 'targetinggates'];

const SUPPORTED_AD_TYPES = [BANNER, VIDEO, NATIVE];
const BIDDER_CODE = 'tg';
const BIDDER_ALIASES = ['targetinggate', 'widerplanet'];

// const BIDDER_CONFIG = 'hb_pb';
// const BIDDER_VERSION = '1.0.0';
// const BIDDER_VERSION_RTB = '2.3';
// const BIDDER_VERSION_NATIVE = '1.1';

const NATIVE_DEFAULTS = {
    TITLE_LEN: 80,
    DESCR_LEN: 200,
    SPONSORED_BY_LEN: 50,
    IMG_MIN: 150,
    ICON_MIN: 50,
    VERSION: '1.1'
};

const DEFAULT_BID_TTL = 20;
const DEFAULT_CURRENCY = 'KRW';
const DEFAULT_NET_REVENUE = true;
const AUCTION_TYPE = 1; // First Price Acution in Header Bidding
const TEST_BID = 1; // Test Bid
const UNDEFINED = undefined;

const CUSTOM_PARAMS = {
    'zoneid': '', // Publisher's slot id in TargetingGates
    'affiliateid': '', // Publisher's id in TargetingGates
    'tagid': '', // Publisher's management slot id
    'location_signature': '', // Hashed required parameter
    'wh': '',
    'buyeruid': '', // OAID
    'hceid': '', // Hashed Email
    'gender': '', // User gender
    'yob': '', // User year of birth
    'lat': '', // User location - Latitude
    'lon': '', // User Location - Longitude
};

const dealChannelValues = {
    1: 'PMP',
    5: 'PREF',
    6: 'PMPG'
};

const DEFAULT_MIMES = ['video/mp4', 'video/webm', 'application/x-shockwave-flash', 'application/javascript'];
const VIDEO_TARGETING = ['mimes', 'skippable', 'playback_method', 'protocols', 'api'];
const DEFAULT_PROTOCOLS = [2, 3, 5, 6];
const DEFAULT_APIS = [1, 2];


const CM_USYNCURL = '//astg.widerplanet.com/delivery/wpg.php?affiliateid=';
const BIDDER_ENDPOINT_URL = '//adtg.widerplanet.com/delivery/pdirect.php?sl=prebid';
// const BIDDER_ENDPOINT_URL = '//hbopenbid.pubmatic.com/translator?source=prebid-client';

export const spec = {
    code: BIDDER_CODE,
    supportedMediaTypes: SUPPORTED_AD_TYPES,
    aliases: BIDDER_ALIASES,
    isBidRequestValid: bid => (!!(bid && bid.params && bid.params.affiliateid && bid.params.tagid && bid.params.zoneid && bid.params.location_signature)),

    buildRequests: (bidRequests, bidderRequest) => {
        const request = {
            id: bidRequests[0].bidderRequestId,
            at: AUCTION_TYPE,
            test: TEST_BID,
            imp: bidRequests.map(slot => impression(slot)),
            site: site(bidRequests),
            app: app(bidRequests),
            device: device(bidderRequest),
        };
        applyGdpr(bidderRequest, request);
        return {
            method: 'POST',
            url: BIDDER_ENDPOINT_URL,
            data: JSON.stringify(request),
        };
    },

    /**
     * Unpack the response from the server into a list of bids.
     *
     * @param {*} response A successful response from the server.
     * @return {Bid[]} An array of bids which were nested inside the server.
     */
    interpretResponse: (response, request) => (
        bidResponseAvailable(request, response)
    ),

    /**
     * User Cookie Sync method with GDPR before Bid Request
     *
     * getUserSyncs: syncOptions => {}
     *
     * @param {*} syncOptions Method for Cookie Sync.
     * @param {*} response Response Object
     * @param {*} gdprConsent Object for GDPR
     * @return {Cm[]} An array of bids which were nested inside the server.
     */
    getUserSyncs: (syncOptions, response, gdprConsent) => {
        let syncurl = CM_USYNCURL + publisherId;

        // Attaching GDPR Consent Params in UserSync url
        if (gdprConsent) {
            syncurl += '&gdpr=' + (gdprConsent.gdprApplies ? 1 : 0);
            syncurl += '&gdpr_consent=' + encodeURIComponent(gdprConsent.consentString || '');
        }

        if (syncOptions.iframeEnabled) {
            return [{
                type: 'iframe',
                url: syncurl
            }];
        } else if (syncOptions.pixelEnabled) {
            return [{
                type: 'image',
                url: syncurl
            }];
        } else {
            utils.logWarn('TargetingGates: Please enable iframe based user sync.');
        }
    }
};

/**
 * Callback for bids, after the call to TargetingGates completes.
 */
function bidResponseAvailable(bidRequest, bidResponse) {
    const idToImpMap = {};
    const idToBidMap = {};
    bidResponse = bidResponse.body
        // extract the request bids and the response bids, keyed by impr-id
    const ortbRequest = parse(bidRequest.data);
    ortbRequest.imp.forEach(imp => {
        idToImpMap[imp.id] = imp;
    });
    if (bidResponse) {
        bidResponse.seatbid.forEach(seatBid => seatBid.bid.forEach(bid => {
            idToBidMap[bid.impid] = bid;
        }));
    }
    const bids = [];
    Object.keys(idToImpMap).forEach(id => {
        if (idToBidMap[id]) {
            const bid = {
                requestId: id,
                cpm: idToBidMap[id].price,
                creative_id: id,
                creativeId: id,
                adId: id,
                ttl: DEFAULT_BID_TTL,
                netRevenue: DEFAULT_NET_REVENUE,
                currency: DEFAULT_CURRENCY
            };

            if (idToImpMap[id]['native']) {
                bid['native'] = nativeResponse(idToImpMap[id], idToBidMap[id]);
                let nurl = idToBidMap[id].nurl;
                nurl = nurl.replace(/\$(%7B|\{)AUCTION_IMP_ID(%7D|\})/gi, idToBidMap[id].impid);
                nurl = nurl.replace(/\$(%7B|\{)AUCTION_PRICE(%7D|\})/gi, idToBidMap[id].price);
                nurl = nurl.replace(/\$(%7B|\{)AUCTION_CURRENCY(%7D|\})/gi, bidResponse.cur);
                nurl = nurl.replace(/\$(%7B|\{)AUCTION_BID_ID(%7D|\})/gi, bidResponse.bidid);
                bid['native']['impressionTrackers'] = [nurl];
                bid.mediaType = 'native';
            } else if (idToImpMap[id]['video']) {
                bid.vastUrl = idToBidMap[id].adm;
                bid.vastUrl = bid.vastUrl.replace(/\$(%7B|\{)AUCTION_PRICE(%7D|\})/gi, idToBidMap[id].price);
                bid.crid = idToBidMap[id].crid;
                bid.width = idToImpMap[id].video.w;
                bid.height = idToImpMap[id].video.h;
                bid.mediaType = 'video';
            } else if (idToImpMap[id]['banner']) {
                bid.ad = idToBidMap[id].adm;
                bid.ad = bid.ad.replace(/\$(%7B|\{)AUCTION_IMP_ID(%7D|\})/gi, idToBidMap[id].impid);
                bid.ad = bid.ad.replace(/\$(%7B|\{)AUCTION_AD_ID(%7D|\})/gi, idToBidMap[id].adid);
                bid.ad = bid.ad.replace(/\$(%7B|\{)AUCTION_PRICE(%7D|\})/gi, idToBidMap[id].price);
                bid.ad = bid.ad.replace(/\$(%7B|\{)AUCTION_CURRENCY(%7D|\})/gi, bidResponse.cur);
                bid.ad = bid.ad.replace(/\$(%7B|\{)AUCTION_BID_ID(%7D|\})/gi, bidResponse.bidid);
                bid.width = idToImpMap[id].banner.w;
                bid.height = idToImpMap[id].banner.h;
                bid.mediaType = 'banner';
            }

            if (idToBidMap[id].ext && idToBidMap[id].ext.deal_channel) {
                bid.dealChannel = dealChannelValues[bid.ext.deal_channel] || null;
            }

            applyExt(bid, idToBidMap[id])
            bids.push(bid);
        }
    });
    return bids;
}

/**
 *
 * Auto compleate function for bid.ext
 *
 * @param {*} bid Bid Object
 * @param {*} tgrtbBid OpenRTB Bid Object
 */
function applyExt(bid, tgrtbBid) {
    if (tgrtbBid && tgrtbBid.ext) {
        bid.ttl = tgrtbBid.ext.ttl || bid.ttl;
        bid.currency = tgrtbBid.ext.currency || bid.currency;
        bid.netRevenue = tgrtbBid.ext.netRevenue != null ? tgrtbBid.ext.netRevenue : bid.netRevenue;

        bid.ext = {
            request_time: Math.round((new Date()).getTime() / 1000),
            location_signature: tgrtbBid.params.location_signature,
            //            price_type: '',
        };
    }
}

/**
 * Produces an OpenRTBImpression from a slot config.
 *
 * @param {*} slot Slot Object
 * @return {*} OpenRTB Impression Object
 */
function impression(slot) {
    return {
        id: slot.bidId,
        bidfloorcur: DEFAULT_CURRENCY,
        bidfloor: slot.params.bidFloor || '0.000001',
        secure: isSecure(),
        tagid: slot.params.tagid.toString(),
        banner: banner(slot),
        native: nativeImpression(slot),
        video: videoImpression(slot),
        // slot.params.user.gender ????
        user: getUser(slot),
        // Attaching GDPR Consent Params
        regs: {
            ext: {
                gdpr: (slot.params.gdprConsent.gdprApplies ? 1 : 0)
            }
        },
        ext: {
            zoneid: slot.params.zoneid.toString(),
            cat: slot.params.cat.toString(),
        }
    };
}

/**
 * Video Impression Object
 *
 * @param {*} slot Slot Object
 * @returns {*} object Video Object
 */
function videoImpression(slot) {
    if (slot.mediaType === 'video' || utils.deepAccess(slot, 'mediaTypes.video')) {
        const sizes = adSize(slot);
        const video = {
            w: size[0],
            h: size[1],
            mimes: DEFAULT_MIMES,
            protocols: DEFAULT_PROTOCOLS,
            api: DEFAULT_APIS,
        };
        if (slot.params.video) {
            Object.keys(slot.params.video).filter(param => includes(VIDEO_TARGETING, param)).forEach(param => video[param] = slot.params.video[param]);
        }
        return video;
    }
    return null;
}

/**
 * Produces an OpenRTB Banner object for the slot given.
 *
 * @param {*}  slot Slot Object
 * @returns {*} object Slot width with height
 */
function banner(slot) {
    const size = adSize(slot);
    return slot.nativeParams ? null : {
        w: size[0],
        h: size[1],
    };
}

/**
 * Produces an OpenRTB Native object for the slot given.
 */
function nativeImpression(slot) {
    if (slot.nativeParams) {
        const assets = [];
        addAsset(assets, titleAsset(assets.length + 1, slot.nativeParams.title, NATIVE_DEFAULTS.TITLE_LEN));
        addAsset(assets, dataAsset(assets.length + 1, slot.nativeParams.body, 2, NATIVE_DEFAULTS.DESCR_LEN));
        addAsset(assets, dataAsset(assets.length + 1, slot.nativeParams.sponsoredBy, 1, NATIVE_DEFAULTS.SPONSORED_BY_LEN));
        addAsset(assets, imageAsset(assets.length + 1, slot.nativeParams.icon, 1, NATIVE_DEFAULTS.ICON_MIN, NATIVE_DEFAULTS.ICON_MIN));
        addAsset(assets, imageAsset(assets.length + 1, slot.nativeParams.image, 3, NATIVE_DEFAULTS.IMG_MIN, NATIVE_DEFAULTS.IMG_MIN));
        return {
            request: JSON.stringify({
                assets
            }),
            ver: NATIVE_DEFAULTS.VERSION,
        };
    }
    return null;
}

/**
 * Helper method to add an asset to the assets list.
 */
function addAsset(assets, asset) {
    if (asset) {
        assets.push(asset);
    }
}

/**
 * Produces a Native Title asset for the configuration given.
 */
function titleAsset(id, params, defaultLen) {
    if (params) {
        return {
            id,
            required: params.required ? 1 : 0,
            title: {
                len: params.len || defaultLen,
            },
        };
    }
    return null;
}

/**
 * Produces a Native Image asset for the configuration given.
 */
function imageAsset(id, params, type, defaultMinWidth, defaultMinHeight) {
    return params ? {
        id,
        required: params.required ? 1 : 0,
        img: {
            type,
            wmin: params.wmin || defaultMinWidth,
            hmin: params.hmin || defaultMinHeight,
        }
    } : null;
}

/**
 * Produces a Native Data asset for the configuration given.
 */
function dataAsset(id, params, type, defaultLen) {
    return params ? {
        id,
        required: params.required ? 1 : 0,
        data: {
            type,
            len: params.len || defaultLen,
        }
    } : null;
}

/**
 * Produces an OpenRTB site object.
 */
function site(bidderRequest) {
    const pubId = bidderRequest && bidderRequest.length > 0 ? bidderRequest[0].params.affiliateid : '0';
    const appParams = bidderRequest[0].params.app;
    if (!appParams) {
        return {
            publisher: {
                id: pubId.toString(),
            },
            content: {
                language: getLanguage(),
            },
            ref: referrer(),
            page: getTopWindowLocation().href,
        }
    }
    return null;
}

/**
 * Produces an OpenRTB App object.
 */
function app(bidderRequest) {
    const pubId = bidderRequest && bidderRequest.length > 0 ? bidderRequest[0].params.affiliateid : '0';
    const appParams = bidderRequest[0].params.app;
    if (appParams) {
        return {
            id: appParams.id,
            name: appParams.name,
            bundle: appParams.bundle,
            storeurl: appParams.storeUrl,
            domain: appParams.domain,
            publisher: {
                id: pubId.toString(),
            },
        }
    }
    return null;
}

/**
 * Attempts to capture the referrer url.
 */
function referrer() {
    try {
        return window.top.document.referrer;
    } catch (e) {
        return document.referrer;
    }
}

/**
 * Produces an OpenRTB Device object.
 */
function device(bidderRequest) {
    const lat = bidderRequest && bidderRequest.length > 0 ? bidderRequest[0].params.latitude : '';
    const lon = bidderRequest && bidderRequest.length > 0 ? bidderRequest[0].params.longitude : '';
    const ifa = bidderRequest && bidderRequest.length > 0 ? bidderRequest[0].params.ifa : '';

    return {
        ua: navigator.userAgent,
        mobile: (mobilecheck()) ? 1 : 0,
        js: 1,
        dnt: (navigator.doNotTrack == 'yes' || navigator.doNotTrack == '1' || navigator.msDoNotTrack == '1') ? 1 : 0,
        // dnt: utils.getDNT() ? 1 : 0,
        // ip:
        // os: 'iOS',
        // osv: '6.1',
        // h: screen.height,
        // w: screen.width,
        // devicetype: 1,
        // country: 'KOR', // ISO-3166-1-alpha-3.
        // region: 'KR', // ISO-3166-2
        // city: 'Seoul',
        // zip: '123-123',
        // utcoffset: 900,
        w: (window.screen.width || window.innerWidth),
        h: (window.screen.height || window.innerHeigh),
        geo: {
            lat: lat,
            lon: lon,
        },
        ifa: ifa,
        flashver: getFlashVersion(),
        // language: (navigator.language || navigator.browserLanguage || navigator.userLanguage || navigator.systemLanguage),
        language: getLanguage(),
    };
    /*
        bid_floor: parseFloat(bidRequest.params.floor) > 0 ? bidRequest.params.floor : 0,

        charset: document.charSet || document.characterSet,

        site_domain: document.location.hostname,
        site_page: window.location.href,
        subid: 'hb',
        tmax: bidderRequest.timeout,
        hb: '1',
        name: document.location.hostname,

        width: parse.width,
        height: parse.height,
        device_width: screen.width,
        device_height: screen.height,

        dnt: (navigator.doNotTrack == 'yes' || navigator.doNotTrack == '1' || navigator.msDoNotTrack == '1') ? 1 : 0,
        secure: isSecure(),
        make: navigator.vendor ? navigator.vendor : '',
    */
}

/* Mobile Device Check */
function mobilecheck() {
    var check = false;
    (function(a) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}

/* Get Flalsh Version */
function getFlashVersion() {
    var plugins, plugin, result;

    if (navigator.plugins && navigator.plugins.length > 0) {
        plugins = navigator.plugins;
        for (var i = 0; i < plugins.length && !result; i++) {
            plugin = plugins[i];
            if (plugin.name.indexOf('Shockwave Flash') > -1) {
                result = plugin.description.split('Shockwave Flash ')[1];
            }
        }
    }
    return result || '';
}

/* Secure Check */
function isSecure() {
    return document.location.protocol === 'https:';
}

/* Get Browser Language */
function getLanguage() {
    const language = navigator.language ? 'language' : 'userLanguage';
    return navigator[language].split('-')[0];
}

/**
 * Safely parses the input given. Returns null on
 * parsing failure.
 */
function parse(rawResponse) {
    try {
        if (rawResponse) {
            return JSON.parse(rawResponse);
        }
    } catch (ex) {
        logError('pulsepointLite.safeParse', 'ERROR', ex);
    }
    return null;
}

/**
 * Determines the AdSize for the slot.
 */
function adSize(slot) {
    if (slot.params.wh) {
        const size = slot.params.wh.toUpperCase().split('X');
        const width = parseInt(slot.params.cw || size[0], 10);
        const height = parseInt(slot.params.ch || size[1], 10);
        return [width, height];
    }
    if (slot.params.size) {
        const size = slot.params.size.toUpperCase().split('X');
        return [parseInt(size[0]), parseInt(size[1])];
    }
    return [1, 1];
}

/**
 * Get User object from slot.
 */
function getUser(slot) {
    return {
        gender: slot.params.gender ? slot.params.gender.trim() : UNDEFINED,
        yob: slot.params.yob ? slot.params.yob.trim() : UNDEFINED,
        ext: {
            buyeruid: lot.params.buyeruid ? lot.params.buyeruid.trim() : UNDEFINED,
            hcuid: slot.params.hcuid ? slot.params.hcuid.trim() : UNDEFINED,
            hceid: slot.params.hceid.trim(): UNDEFINED,
            consent: slot.params.gdprConsent ? slot.params.gdprConsent.consentString : 0
        }
    };
}


/**
 * Applies GDPR parameters to request.
 */
function applyGdpr(bidderRequest, ortbRequest) {
    if (bidderRequest && bidderRequest.gdprConsent) {
        if (!ortbRequest.regs) ortbRequest.regs = {};
        if (!ortbRequest.regs.ext) ortbRequest.regs.ext = {};
        ortbRequest.regs.ext.gdpr = bidderRequest.gdprConsent.gdprApplies ? 1 : 0;


        if (!ortbRequest.user) rtbRequest.user = {};
        if (!ortbRequest.user.ext) ortbRequest.user.ext = {};
        ortbRequest.user.ext.consent = bidderRequest.gdprConsent.consentString ? bidderRequest.gdprConsent.consentString : 0;
    }
}

/**
 * Parses the native response from the Bid given.
 */
function nativeResponse(imp, bid) {
    if (imp['native']) {
        const nativeAd = parse(bid.adm);
        const keys = {};
        if (nativeAd && nativeAd['native'] && nativeAd['native'].assets) {
            nativeAd['native'].assets.forEach(asset => {
                keys.title = asset.title ? asset.title.text : keys.title;
                keys.body = asset.data && asset.data.type === 2 ? asset.data.value : keys.body;
                keys.sponsoredBy = asset.data && asset.data.type === 1 ? asset.data.value : keys.sponsoredBy;
                keys.image = asset.img && asset.img.type === 3 ? asset.img.url : keys.image;
                keys.icon = asset.img && asset.img.type === 1 ? asset.img.url : keys.icon;
            });
            if (nativeAd['native'].link) {
                keys.clickUrl = encodeURIComponent(nativeAd['native'].link.url);
            }
            keys.impressionTrackers = nativeAd['native'].imptrackers;
            return keys;
        }
    }
    return null;
}

registerBidder(spec);