'use strict';

var fs = require('fs'),
    path = require('path');

require('should');

var validation = require('../../lib/manifestTools/validation');

var validationRulesPath = path.join(__dirname, '..', '..', 'lib', 'manifestTools', 'validationRules');

describe('validationRules', function () {
  describe('Loaded modules', function () {
    it('Should load all modules (files) in the validationRules folder', function(done) {
      validation.loadValidationRules(validationRulesPath).then(function (validationRules) {
        fs.readdir(validationRulesPath, function (err, files) {
          var validationRulesLoadedLength = validationRules.length;
          validationRulesLoadedLength.should.be.above(0);
          validationRulesLoadedLength.should.be.equal(files.length);

          done();
        });
      });
    });

    it('All loaded modules should have the same interface', function(done) {
      validation.loadValidationRules(validationRulesPath).then(function (validationRules) {
        for (var validationRule in validationRules) {
          /*jshint -W030 */
          validationRules[validationRule].should.be.a.Function;
        }
        
        done();
      });
    });      
  });
});
