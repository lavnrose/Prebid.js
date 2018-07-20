# Overview

**Module Name**: TargetingGates Bidder Adapter  
**Module Type**: Bidder Adapter  
**Maintainer**: adcon-team@widerplanet.com

# Description

Connects to TargetingGates demand source to fetch bids.  
Banner, Outstream and Native formats are supported.  
Please use `tg` as the bidder code.
`targetinggate`, `targetinggates` and `widerplanet` aliases also supported as well.

Publisher should get required value from Wider Planet, as below

**affiliateid**: Media ID (Issue one media id for one media)

**zoneid**: Slot ID 

**location_signature**: Media Token, this called as `API Key`, you have to request to wider planet's media team.


# Test Parameters

```
    var adUnits = [{
      code: 'banner-ad-div',
      sizes: [[300, 250]],
      bids: [{
          bidder: 'tg',
          params: {
            zoneid: '30164',                                          // required parameter
            location_signature: 'feff819cdc9f9d70619211e55f1b0096',   // required parameter
            wh: '300X250',
            affiliateid: 512379,
            tagid: '486653',
            gender: 'F'
            yob: ' 2014',
            buyeruid: '55816b39711f9b5acf3b90e313ed29e51665623f',
            hceid: '55816b39711f9b5acf3b90e313ed29e51665623f',
            gdprConsent: {
                gdprApplies:  0,
                consentString: '',
            }
          }
      }, {
        code: 'video-ad-player',
        sizes: [640, 480],   // video player size
        bids: [
          {
            bidder: 'tg',
            mediaType : 'video',
            params: {
                affiliateid: 512379,
                tagid: '486653',
                zoneid: '30164',                                          // required parameter
                location_signature: 'feff819cdc9f9d70619211e55f1b0096',   // required parameter
                host: 'cpm.metaadserving.com', //required parameter
                gender: 'F'
                yob: ' 2014',
                buyeruid: '55816b39711f9b5acf3b90e313ed29e51665623f',
                hceid: '55816b39711f9b5acf3b90e313ed29e51665623f',
                gdprConsent: {
                    gdprApplies:  0,
                    consentString: '',
                }
            }
          }
        ]
      }
    },{
      code: 'native-ad-div',
      sizes: [[0, 0]],
      nativeParams: {
          title: { required: true, len: 75  },
          image: { required: true  },
          body: { len: 200  },
          sponsoredBy: { len: 20 }
      },
      bids: [{
          bidder: 'tg',
          params: {
                zoneid: '30164',                                          // required parameter
                location_signature: 'feff819cdc9f9d70619211e55f1b0096',   // required parameter
                affiliateid: 512379,
                tagid: '486653',
                gender: 'F'
                yob: ' 2014',
                buyeruid: '55816b39711f9b5acf3b90e313ed29e51665623f',
                hceid: '55816b39711f9b5acf3b90e313ed29e51665623f',
                gdprConsent: {
                    gdprApplies:  0,
                    consentString: '',
                }
          }
      }]
    }];
```

### Configuration

TargetingGates recommends the UserSync configuration below. Without it, the TargetingGates adapter will not able to perform user syncs, which lowers match rate and reduces monetization.

```javascript
pbjs.setConfig({
  userSync: {
    iframeEnabled: true,
    enabledBidders: ["tg"],
    syncDelay: 6000
  }
});
```

Note: Combine the above the configuration with any other UserSync configuration. Multiple setConfig() calls overwrite each other and only last call for a given attribute will take effect.
