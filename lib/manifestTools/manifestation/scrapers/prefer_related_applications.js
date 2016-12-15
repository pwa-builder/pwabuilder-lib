'use strict';

var RelatedApplications = require('./related_applications');

var prefer_related_applications = function(obj, callback) {

  var preferRelatedApplications = !!RelatedApplications(obj).length;

  if (callback) {
    callback(null, preferRelatedApplications);
  }

  return preferRelatedApplications;
};

module.exports = prefer_related_applications;
