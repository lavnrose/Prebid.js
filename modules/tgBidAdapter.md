# Overview

**Module Name**: TargetingGates Bidder Adapter  
**Module Type**: Bidder Adapter  
**Maintainer**: adcon-team@widerplanet.com

# Description

Connects to TargetingGates demand source to fetch bids.  
Banner, Outstream and Native formats are supported.  
Please use `tg` as the bidder code.
`targetinggate` and `targetinggates` aliases also supported as well.

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
              cf: '300X250',
              cp: 512379,
              ct: 486653
          }
      }, {
        code: 'video-ad-player',
        sizes: [640, 480],   // video player size
        bids: [
          {
            bidder: 'tg',
            mediaType : 'video',
            params: {
              zoneid: '30164',                                          // required parameter
              location_signature: 'feff819cdc9f9d70619211e55f1b0096',   // required parameter
              host: 'cpm.metaadserving.com' //required parameter
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
              cp: 512379,
              ct: 505642
          }
      }]
    }];
```
