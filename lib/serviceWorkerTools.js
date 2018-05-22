'use strict';

var serviceWorkers = require('pwabuilder-serviceworkers'),
    cheerio = require('cheerio'),
    request = require('request'),
    Q = require('q');

function getAssetsFolders(ids, callback) {
  var results = serviceWorkers.getAssetsFolders(ids);

  return Q.resolve(results).nodeify(callback);
}

function getServiceWorkersDescription(callback) {
  var relativeDir = '../assets/serviceworkers'
  
  var result = path.resolve(__dirname, relativeDir) + '/serviceworkers.json';

  return Q.resolve(result).nodeify(callback);
}

function getServiceWorkersFromUrl (siteUrl, callback) {
  var deferred = Q.defer();
  request({ uri: siteUrl }, function (err, response, body) {
    if (err || response.statusCode !== 200) {
      return deferred.reject(new Error('Failed to retrieve service workers from site.'));
    }

    var $ = cheerio.load(body);
    var scriptContent = $($('script')).text();
    var serviceWorkers = scriptContent.match(/navigator\.serviceWorker\.register\([\s\S]*?\)/);

    return deferred.resolve(serviceWorkers);
  });

  return deferred.promise.nodeify(callback);
}

module.exports = {
  getAssetsFolders: getAssetsFolders,
  getServiceWorkersFromUrl: getServiceWorkersFromUrl
};