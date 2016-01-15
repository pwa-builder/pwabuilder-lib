'use strict';

var loader = require('./loader'),
    validation = require('./validation');

module.exports = {
  getManifestFromSite: loader.getManifestFromSite,
  getManifestFromFile: loader.getManifestFromFile,
  writeToFile: loader.writeToFile,
  fetchManifestUrlFromSite: loader.fetchManifestUrlFromSite,
  downloadManifestFromUrl: loader.downloadManifestFromUrl,
  validateAndNormalizeStartUrl: loader.validateAndNormalizeStartUrl,
  convertTo: loader.convertTo,
  validateManifest: validation.validateManifest,
  loadValidationRules: validation.loadValidationRules,
  runValidationRules: validation.runValidationRules,
  imageValidation: validation.imageValidation,
  imageGroupValidation: validation.imageGroupValidation
};
