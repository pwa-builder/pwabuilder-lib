'use strict';

var url = require('url');

var validationConstants = require('../../constants').validation;

module.exports = function (manifestContent, callback) {
  var startUrl = manifestContent.start_url;

  if (startUrl) {
    var parsedSiteUrl = url.parse(startUrl);

    if (parsedSiteUrl.protocol && parsedSiteUrl.protocol.match(/^https:?/gi)) {
      return callback();
    }
  }

  return callback(undefined, {
    'description': 'The start URL for the target web site needs to be a HTTPS URL',
    'platform': validationConstants.platforms.all,
    'level': validationConstants.levels.warning,
    'member': validationConstants.manifestMembers.start_url,
    'code': validationConstants.codes.requiredHttpsUrl
  });
};
