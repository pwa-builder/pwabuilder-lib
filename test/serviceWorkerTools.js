'use strict';

//var Q = require('q');
var should = require('should');

var manifestTools = require('../lib/serviceWorkerTools');

describe('Service Worker Tools', function () {
  describe('getAssetsFolders()', function () {
    it('Should return valid path', function (done) {
      manifestTools.getAssetsFolders('1', function (err, resultURL) {
        should.exist(resultURL);
        should.ok(resultURL.toString().endsWith('1'));
        done();
      });
    });
  });
});
