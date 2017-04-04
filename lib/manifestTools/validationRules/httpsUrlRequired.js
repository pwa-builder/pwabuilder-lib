'use strict';

var url = require('url');
var request = require('request');

var validationConstants = require('../../constants').validation;

module.exports = function (manifestContent, callback) {
  var startUrl = manifestContent.start_url;

  if (startUrl) {
    var parsedSiteUrl = url.parse(startUrl);

    if (parsedSiteUrl.protocol && parsedSiteUrl.protocol.match(/^https:?/gi)) {
      return callback();
    } else {
      // check if the site is redirected to https
      request({ uri: startUrl }, function (err, response) {
        if (!err && response && response.request && response.request.uri && response.request.uri.href) {
          var parsedLocationUrl = url.parse(response.request.uri.href);
          if (parsedLocationUrl.protocol && parsedLocationUrl.protocol.match(/^https:?/gi)) {
            return callback();
          }
        }

        return callback(undefined, {
          'description': 'The target website must be served from a secure origin (i.e. moved to HTTPS) to be compliant with Progressive Web Apps requirements',
          'platform': validationConstants.platforms.all,
          'level': validationConstants.levels.warning,
          'member': validationConstants.manifestMembers.start_url,
          'code': validationConstants.codes.requiredHttpsUrl
        });
      });
    }
  }
};
