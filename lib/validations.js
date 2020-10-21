'use strict';

var platformTools = require('./platformTools'),
  manifestTools = require('./manifestTools');

function platformsValid(platforms) {
  var availablePlatforms = platformTools.listPlatforms();

  for (var i = 0; i < platforms.length; i++) {
    if (availablePlatforms.indexOf(platforms[i].toLowerCase()) < 0) {
      return false;
    }
  }

  return true;
}

function platformToRunValid(platform) {
  var platformsToRun = ['windows', 'android'];

  if (!platform || platformsToRun.indexOf(platform.toLowerCase()) < 0) {
    return false;
  }

  return true;
}

function logLevelValid(level) {
  var availableLevels = ['debug', 'info', 'warn', 'error'];
  return availableLevels.indexOf(level.toLowerCase()) >= 0;
}

function manifestFormatValid(format) {
  var availableFormats = manifestTools.listAvailableManifestFormats();
  return availableFormats.indexOf(format.toLowerCase()) >= 0;
}

function isExpectedValidationError(errorResult) {
  const checkForPurposeList = errorResult.member.includes("icons") && errorResult.member.includes("purpose")

  return checkForPurposeList
}

function isExpectedCase(errorResult, w3cManifestInfo) {
  if (!errorResult.member) {
    return true;
  }

  const errorParams = errorResult.member.split('/').slice(1) //example: /icons/0/purpose -> ['icons', '0', 'purpose']
  const isIconsPurpose = errorResult.member.includes("icons") && errorResult.member.includes("purpose");
  const isShortcuts = errorResult.member.includes("shortcuts");
  const isScreenshots = errorResult.member.includes("screenshots"); // in the case we need to extend it to screenshots as well...

  if ((isScreenshots || isShortcuts) && isIconsPurpose) {
    // don't handle, just let it go through
    return true;

  } else  if (isIconsPurpose) {
    const [icons, index, purpose] = errorParams

    return w3cManifestInfo.content.icons
      && w3cManifestInfo.content.icons[index]
      && w3cManifestInfo.content.icons[index].purpose 
      && w3cManifestInfo.content.icons[index].purpose.split(" ").filter(entry => {
        return (entry === "any" || entry === "maskable" || entry === "monochrome");
    }).length > 0;
  }

  return false;
}



module.exports = {
  platformsValid: platformsValid,
  platformToRunValid: platformToRunValid,
  logLevelValid: logLevelValid,
  manifestFormatValid: manifestFormatValid,
  projectValidation: {
    isExpectedValidationError: isExpectedValidationError,
    isExpectedCase: isExpectedCase,
  }
};
