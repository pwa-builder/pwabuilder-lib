'use strict';

var validation = require('../../../lib/manifestTools/validationRules/w3cManifestSchema');
var validationConstants = require('../../../lib/constants').validation;
var should = require('should');

describe('Validation - All', function () {
  describe('w3cManifestSchema', function () {
    it('Should return errors for members with invlid types', function(done) {

      var manifestObj = {
          'name': 'Sample App',
          'description': 'Web App Sample',
          'short_name': 'Sample',
          'display': 'test',
          'orientation': 'any',
          'dir': 'invalidValue',
          'prefer_related_applications': 'testValue',          
      };

      validation(manifestObj, function(err, error) {
        should.not.exist(err);
        error.should.have.length(3);
        error[0].should.have.property('platform', validationConstants.platforms.all);
        error[0].should.have.property('level', validationConstants.levels.error);
        error[0].should.have.property('member', '/' + validationConstants.manifestMembers.display);
        error[1].should.have.property('platform', validationConstants.platforms.all);
        error[1].should.have.property('level', validationConstants.levels.error);
        error[1].should.have.property('member', '/' + validationConstants.manifestMembers.dir);
        error[2].should.have.property('platform', validationConstants.platforms.all);
        error[2].should.have.property('level', validationConstants.levels.error);
        error[2].should.have.property('member', '/' + validationConstants.manifestMembers.prefer_related_applications);
        done();
      });
    });

    it('Should return warning for unknown member', function(done) {

      var manifestObj = {
          'name': 'Sample App',
          'description': 'Web App Sample',
          'short_name': 'Sample',
          'unknownMember': 'test'      
      };

      validation(manifestObj, function(err, error) {
        should.not.exist(err);
        error.should.have.length(1);
        error[0].should.have.property('level', validationConstants.levels.warning);
        error[0].should.have.property('member', '/unknownMember');
        done();
      });
    });

    it('Should not return errors if manifest schema is valid', function(done) {

      var manifestObj = {
          'name': 'Sample App',
          'description': 'Web App Sample',
          'short_name': 'Sample',
          'start_url': 'http://www.test.com',
          'orientation': 'any',
          'display': 'fullscreen',
          'prefer_related_applications': false,
          'dir': 'ltr'
      };

      validation(manifestObj, function(err, error) {
        should.not.exist(err);
        error.should.have.length(0);
        done();
      });
    });
  });
});