'use strict';

var validationConstants = {
  levels: {
    error: 'error',
    warning: 'warning',
    suggestion: 'suggestion'
  },
  codes: {
    requiredValue: 'required-value',
    invalidValue: 'invalid-value',
    missingImageGroup: 'missing-image-group',
    missingImage: 'missing-image',
    missingImageOnsite: 'missing-image-onsite',
    requiredAbsoluteUrl: 'requiredAbsoluteUrl',
    deprecatedMember: 'deprecatedMember',
    requiredHttpsUrl: 'required-https-url'
  },
  manifestMembers: {
    lang: 'lang',
    name: 'name',
    short_name: 'short_name',
    scope: 'scope',
    icons: 'icons',
    display: 'display',
    orientation: 'orientation',
    start_url: 'start_url',
    theme_color: 'theme_color',
    related_applications: 'related_applications',
    prefer_related_applications: 'prefer_related_applications',
    description: 'description',
    background_color: 'background_color',
    dir: 'dir',
    mjs_access_whitelist: 'mjs_access_whitelist',
    mjs_api_access: 'mjs_api_acces',
    mjs_extended_scope: 'mjs_extended_scope'
  },
  platforms: {
    all: 'general'
  }
};

module.exports = {
  TELEMETRY_FILE_NAME: 'generationInfo.json',
  PWA_FOLDER: 'PWA',
  POLYFILLS_FOLDER: 'Polyfills',
  ASSETS_FOLDER: "Assets",
  BASE_MANIFEST_FORMAT: 'w3c',
  CHROME_MANIFEST_FORMAT: 'chromeos',
  FIREFOX_MANIFEST_FORMAT: 'firefox',
  WINDOWS10_MANIFEST_FORMAT: 'windows10',
  EDGE_EXTENSION_MANIFEST_FORMAT: 'edgeextension',
  IMG_GEN_SVC_URL: 'http://appimagegenerator-prod.azurewebsites.net',
  IMG_GEN_SVC_API: 'api/image',
  IMG_GEN_IN_MIMETYPE: 'image/jpeg',
  IMG_GEN_IN_PLATFORM: 'manifoldjs',
  IMG_GEN_OUT_ICONSINFO: 'icons.json',
  IMG_GEN_OUT_DATAURI: 'data:image/png;base64,',
  IMG_GEN_OUT_MIMETYPE: 'image/png',
  validation: validationConstants
};