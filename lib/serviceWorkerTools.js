'use strict';

var fs = require('fs'),
    path = require('path'),
    Q = require('q');

function getAssetsFolders(ids, callback) {
  var results = [];
  
  var serviceWorkerIDs = ids.split(',');

  serviceWorkerIDs.forEach(function (id) {
    var relativeDir = "../assets/serviceworkers/ServiceWorker" + id;

    var dir = path.resolve(__dirname, relativeDir);
    results.push(dir);
  });

  return Q.resolve(results).nodeify(callback);
};

module.exports = {
  getAssetsFolders: getAssetsFolders,
};