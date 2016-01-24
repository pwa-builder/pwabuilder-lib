'use strict';

var manifestConverter = require('./manifestConverter'), 
    manifestLoader = require('./manifestLoader'),
    manifestValidator = require('./manifestValidator');

module.exports = {
  getManifestFromSite:          manifestLoader.getManifestFromSite,
  getManifestFromFile:          manifestLoader.getManifestFromFile,
  writeToFile:                  manifestLoader.writeToFile,
  fetchManifestUrlFromSite:     manifestLoader.fetchManifestUrlFromSite,
  downloadManifestFromUrl:      manifestLoader.downloadManifestFromUrl,
  convertTo:                    manifestConverter.convertTo,
  validateManifest:             manifestValidator.validateManifest,
  loadValidationRules:          manifestValidator.loadValidationRules,
  runValidationRules:           manifestValidator.runValidationRules,
  imageValidation:              manifestValidator.imageValidation,
  imageGroupValidation:         manifestValidator.imageGroupValidation,
  validateAndNormalizeStartUrl: manifestValidator.validateAndNormalizeStartUrl,
  applyValidationRules:         manifestValidator.applyValidationRules  
};
