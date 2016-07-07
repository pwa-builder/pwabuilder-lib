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

module.exports = {
  platformsValid: platformsValid,
  platformToRunValid: platformToRunValid,
  logLevelValid: logLevelValid,
  manifestFormatValid: manifestFormatValid
};
