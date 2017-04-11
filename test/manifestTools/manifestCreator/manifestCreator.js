'use strict';

var http = require('http');
var should = require('should');

var manifestCreator = require('../../../lib/manifestTools/manifestCreator');

var responseFunction;

var server = http.createServer(function (req, res) {
  if (responseFunction) {
    responseFunction(req, res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

describe('Manifestation tool', function () {
  before(function () {
      server.listen(8042);
  });

  it('Should get manifest from emtpy HTML (defaults for all)', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype><html/>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('background_color', 'transparent');
      manifest.should.have.property('description', '');
      manifest.should.have.property('dir', 'ltr');
      manifest.should.have.property('display', 'browser');
      manifest.should.have.property('icons').with.lengthOf(0);
      manifest.should.have.property('lang', 'en');
      manifest.should.have.property('name', '');
      manifest.should.have.property('prefer_related_applications', false);
      manifest.should.have.property('related_applications').with.lengthOf(0);
      manifest.should.have.property('scope', '/home');
      manifest.should.have.property('short_name', '');
      manifest.should.have.property('start_url', '/home');
      manifest.should.have.property('theme_color', 'transparent');
      done();
    });
  });

  it('Should get manifest from HTML with arabic body (no lang recognition)', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype>' +
      '<html lang="en">' +
        '<head>' +
          '<title>هذا هو عنوان للصفحة</title>' +
        '</head>' +
        '<body>هذا هو بعض فارغة النص الجسم ولكن باللغة العربية</body>' +
      '</html>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('lang', 'en');
      manifest.should.have.property('dir', 'rtl');
      done();
    });
  });

  it('Should get manifest from emtpy HTML (using lang recognition - minimum input)', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype>' +
      '<html>' +
        '<head>' +
          '<title>Einige Titel</title>' +
        '</head>' +
      '</html>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('lang', 'de');
      manifest.should.have.property('dir', 'ltr');
      done();
    });
  });

  it('Should get manifest from HTML with french body (using lang recognition)', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype>' +
      '<html>' +
        '<head>' +
          '<title>C\'est un titre pour la page</title>' +
        '</head>' +
        '<body>C\'est un texte de corps vide, mais en français</body>' +
      '</html>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('lang', 'fr');
      manifest.should.have.property('dir', 'ltr');
      done();
    });
  });

  it('Should get manifest from HTML with arabic body (using lang recognition)', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype>' +
      '<html>' +
        '<head>' +
          '<title>هذا هو عنوان للصفحة</title>' +
        '</head>' +
        '<body>هذا هو بعض فارغة النص الجسم ولكن باللغة العربية</body>' +
      '</html>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('lang', 'ar');
      manifest.should.have.property('dir', 'rtl');
      done();
    });
  });

  it('Should get manifest from HTML having several members', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype>' +
      '<html lang="en" dir="ltr">' +
        '<head>' +
          '<title>test page</title>' +
          '<meta name="msapplication-TileColor" content="blue">' +
          '<meta name="description" content="this is the description for a simple test page">' +
          '<meta name="full-screen" content="yes">' +
          '<meta name="application-name" content="some app name">' +
          '<meta name="msApplication-ID" content="appID">' +
          '<meta name="msApplication-PackageFamilyName" content="appID.Pkg.Fam">' +
          '<meta name="theme-color" content="white">' +
        '</head>' +
        '<body>this is a simple test page</body>' +
      '</html>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('background_color', 'blue');
      manifest.should.have.property('description', 'this is the description for a simple test page');
      manifest.should.have.property('dir', 'ltr');
      manifest.should.have.property('display', 'fullscreen');
      manifest.should.have.property('lang', 'en');
      manifest.should.have.property('name', 'some app name');
      manifest.should.have.property('related_applications').with.lengthOf(1);
      manifest.related_applications[0].should.have.property('platform', 'windows');
      manifest.related_applications[0].should.have.property('url', 'ms-windows-store://pdp?PFN=appID.Pkg.Fam');
      manifest.should.have.property('short_name', 'some app name');
      manifest.should.have.property('start_url', '/home');
      manifest.should.have.property('theme_color', 'white');
      done();
    });
  });

  it('Should get manifest from HTML with persian body having several members (using lang recognition)', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      res.end('<!doctype>' +
      '<html>' +
        '<head>' +
          '<title>این عنوان است</title>' +
          '<meta name="msapplication-TileColor" content="blue">' +
          '<meta name="description" content="این توضیحات برای یک صفحه آزمایشی ساده است">' +
          '<meta name="full-screen" content="yes">' +
          '<meta name="application-name" content="some app name">' +
          '<meta name="msApplication-ID" content="appID">' +
          '<meta name="msApplication-PackageFamilyName" content="appID.Pkg.Fam">' +
          '<meta name="theme-color" content="white">' +
        '</head>' +
        '<body>این تنها خط متن است</body>' +
      '</html>');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('background_color', 'blue');
      manifest.should.have.property('description', 'این توضیحات برای یک صفحه آزمایشی ساده است');
      manifest.should.have.property('dir', 'rtl');
      manifest.should.have.property('display', 'fullscreen');
      manifest.should.have.property('lang', 'fa');
      manifest.should.have.property('name', 'some app name');
      manifest.should.have.property('related_applications').with.lengthOf(1);
      manifest.related_applications[0].should.have.property('platform', 'windows');
      manifest.related_applications[0].should.have.property('url', 'ms-windows-store://pdp?PFN=appID.Pkg.Fam');
      manifest.should.have.property('short_name', 'some app name');
      manifest.should.have.property('start_url', '/home');
      manifest.should.have.property('theme_color', 'white');
      done();
    });
  });

  it('Should create default manifest even when server returns 500', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(500, { 'Content-Type': 'text/html' });

      res.end('Internal error');
    };

    manifestCreator({ url: 'http://localhost:8042/home' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      done();
    });
  });

  it('Should get an error when calling invalid URL', function(done) {
    responseFunction = function(req, res) {
      res.writeHead(500, { 'Content-Type': 'text/html' });

      res.end('Internal error');
    };

    manifestCreator({ url: 'http://localInvalidHost:9999/' }, function (err, manifest) {
      should.exist(err);
      err.should.have.property('code', 'ENOTFOUND');
      should.not.exist(manifest);
      done();
    });
  });
});