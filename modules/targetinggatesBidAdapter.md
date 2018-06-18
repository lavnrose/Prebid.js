# Overview

```
Module Name: TargetingGates Bidder Adapter
Module Type: Bidder Adapter
Maintainer: adcon-team@widerplanet.com
```

# Description

Module that connects to TargetingGates's demand sources

# Test Parameters
```
    var adUnits = [
        {
            code: 'test-div',
            sizes: [[728, 90]],  // a display size
            mediaTypes: {'banner': {}},
            bids: [
                {
                    bidder: 'tg',
                    params: {
                        unit: '539439964',
                        delDomain: 'se-demo-d.openx.net'
                    }
                }
            ]
        },
        {
            code: 'video1',
            sizes: [[640,480]],
            mediaTypes: {'video': {}},
            bids: [
              {
                bidder: 'tg',
                params: {
                  unit: '539131525',
                  delDomain: 'zdo.com',
                  video: {
                     url: 'abc.com'
                  }
                }
              }
            ]
        }
    ];
```
