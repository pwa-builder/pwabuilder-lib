'use strict';

var relatedApplications = require('./related_applications');

var prefer_related_applications = function(obj, callback) {

  var preferrelatedApplications = !!relatedApplications(obj).length;

  if (callback) {
    callback(null, preferrelatedApplications);
  }

  return preferrelatedApplications;
};

module.exports = prefer_related_applications;
