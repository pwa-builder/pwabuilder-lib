'use strict';

var http = require('http');
var should = require('should');

var manifestCreator = require('../../../lib/manifestTools/manifestation');

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

  it('Should get manifest from empty HTML with french body', function(done) {
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

    manifestCreator({ url: 'http://localhost:8042/french_it' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('lang', 'fr');
      done();
    });
  });

  it('Should get manifest from empty HTML with arabic body', function(done) {
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

    manifestCreator({ url: 'http://localhost:8042/arabic_it' }, function (err, manifest) {
      should.not.exist(err);
      should.exist(manifest);
      manifest.should.have.property('lang', 'ar');
      done();
    });
  });  
});