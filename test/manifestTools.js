'use strict';

var fs = require('fs'),
    http = require('http'),
    path = require('path'),    
    url = require('url');

var should = require('should');

var manifestTools = require('../lib/manifestTools'),
    validationConstants = require('../lib/constants').validation;
    
var manifestTypeDetector = require('../lib/manifestTools/manifestTypeDetector');
var chromeToW3c = require('../lib/manifestTools/platformUtils/chromeToW3c.js');

var responseFunction;

var server = http.createServer(function (req, res) {
  if (responseFunction) {
    responseFunction(req, res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

var assetsDirectory = path.join(__dirname, 'assets');

var inputFiles = {
  notExistingFile: path.join(assetsDirectory, 'notExistingFile.json'),
  invalidManifest: path.join(assetsDirectory, 'invalid.json'),
  invalidManifestFormat: path.join(assetsDirectory, 'invalidManifestFormat.json'),
  validManifest: path.join(assetsDirectory, 'manifest.json'),
  issue88Manifest: path.join(assetsDirectory, 'manifest_#88.json')
};

var outputFiles = {
  invalidManifestPath: path.join(assetsDirectory, 'notExistingDirectory', 'notExistingFile.json'),
  validManifestPath: path.join(assetsDirectory, 'output-manifest.json')
};

// configure test platforms
var platformConfig = require('../test-assets/platformConfig');
platformConfig();

describe('Manifest Tools', function () {
  describe('getManifestFromFile()', function () {
    it('Should return an Error if path is invalid', function (done) {
      manifestTools.getManifestFromFile(inputFiles.notExistingFile, function (err){
        should.exist(err);
        done();
      });
    });

    it('Should return an Error if JSON format is invalid', function (done) {
      manifestTools.getManifestFromFile(inputFiles.invalidManifest, function (err){
        should.exist(err);
        err.should.have.property('message', 'Invalid manifest format.');
        done();
      });
    });

    it('Should return an Error if manifest format is invalid', function (done) {
      manifestTools.getManifestFromFile(inputFiles.invalidManifestFormat, function (err){
        should.exist(err);
        err.should.have.property('message', 'Invalid manifest format.');
        done();
      });
    });

    it('Should return a manifest object if input manifest is valid', function (done) {
      manifestTools.getManifestFromFile(inputFiles.validManifest, function(err, manifestInfo){
        should.not.exist(err);
        should.exist(manifestInfo);
        manifestInfo.should.have.property('content');
        done();
      });
    });
  });

  describe('writeToFile()', function () {
    it('Should return an Error if manifest info is undefined', function (done) {
      manifestTools.writeToFile(undefined, outputFiles.invalidManifestPath, function (err){
        should.exist(err);
        err.should.have.property('message', 'Manifest content is empty or invalid.');
        done();
      });
    });

    it('Should return an Error if content property is undefined', function (done) {
      manifestTools.writeToFile({ key: 'value' }, outputFiles.invalidManifestPath, function (err){
        should.exist(err);
        err.should.have.property('message', 'Manifest content is empty or invalid.');
        done();
      });
    });

    it('Should return an Error if an error occurs while writing the file', function(done) {
      manifestTools.writeToFile({ content: { 'start_url': 'url' } }, outputFiles.invalidManifestPath, function(err){
        should.exist(err);
        done();
      });
    });

    it('Should write only the manifest information object content in file', function(done) {
      manifestTools.writeToFile({ content: { 'start_url': 'url' } }, outputFiles.validManifestPath, function(err){
        should.not.exist(err);
        done();
      });
    });

    after(function() {
      // runs after all tests in this block

      fs.exists(outputFiles.validManifestPath, function (exists) {
        if(exists) {
          fs.unlink(outputFiles.validManifestPath, function (err) {
            if (err) {
              throw err;
            }
          });
        }
      });
    });
  });

  describe('fetchManifestUrlFromSite()', function () {
    before(function () {
      server.listen(8042);
    });

    it('Should return an Error if url is invalid', function(done) {
      responseFunction = function() {
        should.fail('This function should not be called in this test');
      };

      manifestTools.fetchManifestUrlFromSite('invalid url', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Failed to retrieve manifest from site.');
        done();
      });
    });

    it('Should return an Error if server returns 404', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(404);
        res.end();
      };

      manifestTools.fetchManifestUrlFromSite('http://localhost:8042/notfound', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Failed to retrieve manifest from site.');
        done();
      });
    });

    it('Should return undefined if no manifest tag is found', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });

        res.end('<!doctype>' +
                '<html>' +
                  '<head>' +
                    '<title>test</title>' +
                  '</head>' +
                  '<body></body>' +
                '</html>');
      };

      manifestTools.fetchManifestUrlFromSite('http://localhost:8042/urlWithoutManifestTag', function(err, manifestUrl) {
        should.not.exist(err);
        should.not.exist(manifestUrl);
        done();
      });
    });

    it('Should return the manifest url if the manifest tag has a relative url', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });

        res.end('<!doctype>' +
                '<html>' +
                  '<head>' +
                    '<title>test</title>' +
                    '<link rel="manifest" href="manifest.json">' +
                  '</head>' +
                  '<body></body>' +
                '</html>');
      };

      manifestTools.fetchManifestUrlFromSite('http://localhost:8042/urlWithManifestTag', function(err, manifestUrl) {
        should.not.exist(err);
        should.exist(manifestUrl);
        manifestUrl.should.be.equal('http://localhost:8042/manifest.json');
        done();
      });
    });

    it('Should return the manifest url if the manifest tag contains other words', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });

        res.end('<!doctype>' +
        '<html>' +
        '<head>' +
        '<title>test</title>' +
        '<link rel="something manifest another thing" href="manifest.json">' +
        '</head>' +
        '<body></body>' +
        '</html>');
      };

      manifestTools.fetchManifestUrlFromSite('http://localhost:8042/urlWithManifestTag', function(err, manifestUrl) {
        should.not.exist(err);
        should.exist(manifestUrl);
        manifestUrl.should.be.equal('http://localhost:8042/manifest.json');
        done();
      });
    });

    it('Should return the manifest url if the manifest tag has an absolute url', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });

        res.end('<!doctype>' +
                '<html>' +
                  '<head>' +
                    '<title>test</title>' +
                    '<link rel="manifest" href="http://www.contoso.com/manifest.json">' +
                  '</head>' +
                  '<body></body>' +
                '</html>');
      };

      manifestTools.fetchManifestUrlFromSite('http://localhost:8042/urlWithManifestTag', function(err, manifestUrl) {
        should.not.exist(err);
        should.exist(manifestUrl);
        manifestUrl.should.be.equal('http://www.contoso.com/manifest.json');
        done();
      });
    });

    afterEach(function () {
      responseFunction = undefined;
    });

    after(function () {
      server.close();
    });
  });

  describe('downloadManifestFromUrl()', function () {
    before(function () {
      server.listen(8042);
    });

    it('Should return an Error if url is invalid', function(done) {
      responseFunction = function() {
        should.fail('This function should not be called in this test');
      };

      manifestTools.downloadManifestFromUrl('invalid url', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Failed to download manifest data.');
        done();
      });
    });

    it('Should return an Error if server returns 404', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(404);
        res.end();
      };

      manifestTools.downloadManifestFromUrl('http://localhost:8042/notfound', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Failed to download manifest data.');
        done();
      });
    });

    it('Should return an Error if downloaded manifest is invalid', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });

        res.end('invalid json');
      };

      manifestTools.downloadManifestFromUrl('http://localhost:8042/invalidJson', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Invalid manifest format.');
        done();
      });
    });

    it('Should return the manifest info object from a site', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });

        res.end(JSON.stringify({'start_url': 'http://www.contoso.com/'}));
      };

      manifestTools.downloadManifestFromUrl('http://localhost:8042/validManifest.json', function(err, manifestInfo) {
        should.not.exist(err);
        should.exist(manifestInfo);
        manifestInfo.should.have.properties('content', 'format');
        done();
      });
    });

    afterEach(function () {
      responseFunction = undefined;
    });

    after(function () {
      server.close();
    });
  });

  describe('getManifestFromSite()', function () {
    before(function () {
      server.listen(8042);
    });

    it('Should return an Error if url is invalid', function(done) {
      responseFunction = function() {
        should.fail('This function should not be called in this test');
      };

      manifestTools.getManifestFromSite('invalid url', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Failed to retrieve manifest from site.');
        done();
      });
    });

    it('Should return an Error if server returns 404', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(404);
        res.end();
      };

      manifestTools.getManifestFromSite('http://localhost:8042/notfound', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Failed to retrieve manifest from site.');
        done();
      });
    });

    it('Should return the manifest info object from a site', function(done) {
      responseFunction = function(req, res) {
        var url_parts = url.parse(req.url);
        var route = url_parts.pathname;

        if (route === '/manifest.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });

          res.end(JSON.stringify({'start_url': 'http://www.contoso.com/'}));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });

          res.end('<!doctype>' +
          '<html>' +
            '<head>' +
              '<title>test</title>' +
              '<link rel="manifest" href="http://localhost:8042/manifest.json">' +
            '</head>' +
            '<body></body>' +
          '</html>');
        }
      };

      manifestTools.getManifestFromSite('http://localhost:8042/urlWithManifestTag', function(err, manifestInfo) {
        should.not.exist(err);
        should.exist(manifestInfo);
        manifestInfo.should.have.properties('content', 'format');
        manifestInfo.content.should.have.property('start_url', 'http://www.contoso.com/');
        done();
      });
    });

    it('Should create a manifest info object if no manifest tag is found', function(done) {
      responseFunction = function(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });

        res.end('<!doctype>' +
        '<html>' +
          '<head>' +
            '<title>test</title>' +
          '</head>' +
          '<body></body>' +
        '</html>');
      };

      var siteUrl ='http://localhost:8042/urlWithoutManifestTag';

      manifestTools.getManifestFromSite(siteUrl, function(err, manifestInfo) {
        should.not.exist(err);
        should.exist(manifestInfo);
        manifestInfo.should.have.properties('content', 'format');
        manifestInfo.content.should.have.property('start_url', siteUrl);
        done();
      });
    });

    afterEach(function () {
      responseFunction = undefined;
    });

    after(function () {
      server.close();
    });
  });

  describe('convertTo()', function () {
    it('Should return an Error if manifest info is undefined', function(done) {
      manifestTools.convertTo(undefined, 'W3C', function(err){
        should.exist(err);
        err.should.have.property('message', 'Manifest content is empty or not initialized.');
        done();
      });
    });

    it('Should return an Error if content property is undefined', function(done) {
      manifestTools.convertTo({ key: 'value' }, 'W3C', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Manifest content is empty or not initialized.');
        done();
      });
    });

    it('Should return the same object if the format is the same', function (done) {
      var manifestInfo = { content: { 'start_url': 'url' }, format: 'W3C' };
      manifestTools.convertTo(manifestInfo, 'W3C', function(err, result) {
        should.not.exist(err);
        result.should.be.exactly(manifestInfo);
        done();
      });
    });

    it('Should use w3c as default format', function (done) {
      var manifestInfo = { content: { 'start_url': 'url' } };
      manifestTools.convertTo(manifestInfo, undefined, function(err, result) {
        should.not.exist(err);
        result.should.be.exactly(manifestInfo);
        result.should.have.property('format', 'w3c');
        done();
      });
    });

    it('Should return an Error if input format is invalid', function(done) {
      var manifestInfo = { content: { 'start_url': 'url' }, format: 'invalid format' };
      manifestTools.convertTo(manifestInfo, 'W3C', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Manifest format is not recognized.');
        done();
      });
    });

    it('Should return an Error if output format is invalid', function(done) {
      var manifestInfo = { content: { 'start_url': 'url' }, format: 'W3C' };
      manifestTools.convertTo(manifestInfo, 'invalid format', function(err) {
        should.exist(err);
        err.should.have.property('message', 'Manifest format is not recognized.');
        done();
      });
    });

    it('Convert from chromeOS to W3C', function (done) {
      var manifestInfo = {
        content: {
          'name': 'Google Mail',
          'description': 'Read your gmail',
          'version': '1',
          'app': {
            'urls': [
            '*://mail.google.com/mail/',
            '*://www.google.com/mail/'
            ],
            'launch': {
              'web_url': 'http://mail.google.com/mail/'
            }
          },
          'icons': {
            '64': 'icon_64.png',
            '128': 'icon_128.png'
          },
          'permissions': [ 'unlimitedStorage', 'notifications']
        },
        format: 'chromeos'
      };

      var expectedManifestInfo = {
        content: {
          'name': 'Google Mail',
          'start_url': 'http://mail.google.com/mail/',
          'icons': [{
            'src': 'icon_64.png',
            'sizes': '64x64'
          }, {
            'src': 'icon_128.png',
            'sizes': '128x128'
          }]
        },
        format: 'w3c'
      };

      manifestTools.convertTo(manifestInfo, 'W3C', function(err, result) {
        should.not.exist(err);
        result.should.be.eql(expectedManifestInfo);
        done();
      });
    });
  });
  
  describe('chromeToW3c()', function () {
    it('Should convert from Chrome OS manifest format to W3C manifest format', function() {
        var manifestObj = {
            'name': 'Sample',
            'description': 'Chrome Web App Sample',
            'version': '0.0.1',
            'app': {
                'launch': {
                    'web_url': 'http://example.com'
                }
            },
            'icons': {
                '16': 'icon-16.png',
                '48': 'icon-48.png',
                '128': 'icon-128.png'
            },
            'permissions': [
                'notifications',
                'background'
            ]
        };
  
        manifestObj = chromeToW3c.chromeToW3CManifest(manifestObj);
        var result = manifestTypeDetector.detect(manifestObj);
  
        should.exist(result);
        result.should.be.equal('w3c');
    });
  });

  describe('validateManifest()', function () {
    it('Should validate only the general rules if no platforms are passed', function (done) {
      var manifestInfo = {
        content: {
          'name': 'Google Mail',
          'start_url': 'http://mail.google.com/mail/',
          'icons': [{
            'src': 'icon_64.png',
            'sizes': '64x64'
          }, {
            'src': 'icon_128.png',
            'sizes': '128x128'
          }]
        },
        format: 'w3c'
      };

      manifestTools.validateManifest(manifestInfo, undefined, function(){
        done();
      });
    });
    
    it('Issue #88', function (done) {      
      manifestTools.getManifestFromFile(inputFiles.issue88Manifest, function (err, manifestObject){
        var w3cmanifest = {
          content: manifestObject,
          format: 'w3c'};
        manifestTools.validateAndNormalizeStartUrl ('http://thishereweb.com', w3cmanifest.content, function(err){
          should.not.exist(err);
        done();
        });
      });
    });

    it('Should validate platforms that are passed as parameter', function (done) {
      var manifestInfo = {
        content: {
          'name': 'Google Mail',
          'start_url': 'http://example.com/',
        },
        format: 'w3c'
      };

      manifestTools.validateManifest(manifestInfo, ['test'], function() {
        done();
      });
    });

    it('Should validate short name is required', function (done) {
      var manifestInfo = {
        content: {
          'short_name': '',
          'start_url': 'http://example.com/'
        },
        format: 'w3c'
      };

      var expectedValidation = {
        'description': 'A short name for the application is required',
        'platform': validationConstants.platforms.all,
        'level': validationConstants.levels.error,
        'member': validationConstants.manifestMembers.short_name,
        'code': validationConstants.codes.requiredValue
      };

      manifestTools.validateManifest(manifestInfo, ['test'], function (err, validationResults) {
        should.not.exist(err);
        validationResults.should.containEql(expectedValidation);
        done();
      });
    });

    it('Should validate start url is required', function (done) {
      var manifestInfo = {
        content: {
          'short_name': 'MyApp',
          'start_url': ''
        },
        format: 'w3c'
      };

      var expectedValidation = {
        'description': 'The start URL for the target web site is required',
        'platform': validationConstants.platforms.all,
        'level': validationConstants.levels.error,
        'member': validationConstants.manifestMembers.start_url,
        'code': validationConstants.codes.requiredValue
      };

      manifestTools.validateManifest(manifestInfo, ['test'], function (err, validationResults) {
        should.not.exist(err);
        validationResults.should.containEql(expectedValidation);
        done();
      });
    });

    it('Should recommend to specify scope rules', function (done) {
      var manifestInfo = {
        content: {
          'short_name': 'MyApp',
          'start_url': 'http://example.com/'
        },
        format: 'w3c'
      };

      var expectedValidation = {
        'description': 'It is recommended to specify a set of rules that represent the navigation scope of the application',
        'platform': validationConstants.platforms.all,
        'level': validationConstants.levels.suggestion,
        'member': validationConstants.manifestMembers.mjs_extended_scope,
        'code': validationConstants.codes.requiredValue
      };

      manifestTools.validateManifest(manifestInfo, ['test'], function (err, validationResults) {
        should.not.exist(err);
        validationResults.should.containEql(expectedValidation);
        done();
      });
    });
  });
});
