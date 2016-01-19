'use strict';

var path = require('path');

var platformTools = require('../lib/platformTools');

var testPlatformPath = path.join(__dirname, '..', 'test-assets', 'test-platform');

var platformConfig = {
    "chrome": {
        "packageName": testPlatformPath,
        "source": ''
    },
    "firefox": {
        "packageName": testPlatformPath,
        "source": ''
    },
    "windows10": {
        "packageName": testPlatformPath,
        "source": ''
    },
    "android": {
        "packageName": testPlatformPath,
        "source": ''
    },
    "ios": {
        "packageName": testPlatformPath,
        "source": ''
    },
    "windows": {
        "packageName": testPlatformPath,
        "source": ''
    },
    "web": {
        "packageName": testPlatformPath,
        "source": ''
    }
};
 
function configureTestPlatforms (config) {
  platformTools.configurePlatforms(config || platformConfig);
}

module.exports = configureTestPlatforms;
