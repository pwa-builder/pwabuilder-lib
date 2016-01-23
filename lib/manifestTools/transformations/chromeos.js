'use strict';

var constants = require('../../constants'),
    utils = require('../../utils');

function convertToBase(manifestInfo, callback) {
  if (!manifestInfo || !manifestInfo.content) {
    return callback(new Error('Manifest content is empty or not initialized.'));
  }
  
  var originalManifest = manifestInfo.content;

  var manifest = {
    start_url: originalManifest.app.launch.web_url,
    icons: []
  };

  if (originalManifest.default_locale) {
    manifest.lang = originalManifest.default_locale;
  }

  if (originalManifest.name) {
    manifest.name = originalManifest.name;
  }

  if (originalManifest.short_name) {
    manifest.name = originalManifest.short_name;
  }
    
  // Extract icons
  for (var size in originalManifest.icons) {
    manifest.icons.push({
      sizes: size + 'x' + size,
      src: originalManifest.icons[size]
    });
  }

  // Extract app URLs
  var appUrls = originalManifest.app.urls;
  if (appUrls && Array.isArray(appUrls)) {
    appUrls = utils.removeDupesInPlace(appUrls, function (a, b) {
      return a === b;
    }).map(function (url) {
      return url.trim().replace(/\/$/, '/*');
    });
  }

  if (appUrls) {
    manifest.mjs_extended_scope = appUrls;
  }

  if (originalManifest.permissions) {
    var allPermissions = originalManifest.permissions.join(', ');
    manifest.mjs_api_access = [{ 'match': originalManifest.app.launch.web_url.replace(/\/$/, '/*'), 'platform': 'chrome', 'access': allPermissions }];

    if (appUrls && Array.isArray(appUrls)) {
      appUrls.forEach(function (url) {
        manifest.mjs_api_access.push({ 'match': url, 'platform': 'chrome', 'access': allPermissions });
      });
    }
  }

  var convertedManifestInfo = {
    'content': manifest,
    'format': constants.BASE_MANIFEST_FORMAT
  };

  return callback(undefined, convertedManifestInfo);
}

// see https://developer.chrome.com/webstore/hosted_apps
var requiredRootProperties = ['name', 'version', 'manifest_version', 'app'];

var validRootProperties = ['name', 'description', 'version', 'manifest_version', 'app',
                           'background_page', 'icons', 'key',
                           'minimum_chrome_version', 'offline_enabled',
                           'permissions', 'update_url', 'default_locale'];

var validAppProperties = ['urls', 'launch'];
var validAppLaunchProperties = ['web_url', 'container', 'height', 'width'];

function matchFormat(manifestObj) {
  var lowercasePropName;

  // check required fields
  for (var i = 0; i < requiredRootProperties.length; i++) {
    if (!manifestObj.hasOwnProperty(requiredRootProperties[i])) {
      return false;
    }
  }

  if (!manifestObj.app.hasOwnProperty('launch') ||
    !manifestObj.app.launch.hasOwnProperty('web_url')) {
    return false;
  }

  for (var prop in manifestObj) {
    if (manifestObj.hasOwnProperty(prop)) {
      lowercasePropName = prop.toLowerCase();
      if (validRootProperties.indexOf(lowercasePropName) === -1) {
        return false;
      }
    }

    if (lowercasePropName === 'app') {
      for (var appProp in manifestObj.app) {
        if (manifestObj.app.hasOwnProperty(appProp)) {
          if (validAppProperties.indexOf(appProp) === -1) {
            return false;
          }

          if (appProp === 'launch') {
            for (var appLaunchProp in manifestObj.app.launch) {
              if (manifestObj.app.launch.hasOwnProperty(appLaunchProp)) {
                if (validAppLaunchProperties.indexOf(appLaunchProp) === -1) {
                  return false;
                }
              }
            }
          }
        }
      }
    }
  }

  return true;
}

module.exports = {
  convertToBase: convertToBase,
  matchFormat: matchFormat
};
