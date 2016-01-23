'use strict';

var constants = require('../constants'),
    transformations = require('./transformations'),
    utils = require('../utils');

function convertTo(manifestInfo, outputFormat, callback) {
  if (!manifestInfo || !manifestInfo.content) {
    return callback(new Error('Manifest content is empty or not initialized.'));
  }

  var inputFormat = constants.BASE_MANIFEST_FORMAT;
  if (manifestInfo.format && utils.isString(manifestInfo.format)) {
    inputFormat = manifestInfo.format.toLowerCase();
  }

  if (outputFormat && utils.isString(outputFormat)) {
    outputFormat = outputFormat.toLowerCase();
  } else {
    outputFormat = constants.BASE_MANIFEST_FORMAT;
  }

  if (inputFormat === outputFormat) {
    if (!manifestInfo.format) {
      manifestInfo.format = outputFormat;
    }
    return callback(undefined, manifestInfo);
  }

  var inputTransformation = transformations[inputFormat];
  var outputTransformation = transformations[outputFormat];

  if (!inputTransformation || !outputTransformation) {
    return callback(new Error('Manifest format is not recognized.'));
  }

  inputTransformation.convertToBase(manifestInfo, function (err, resultManifestInfo) {
    if (err) {
      return callback(err, resultManifestInfo);
    }

    outputTransformation.convertFromBase(resultManifestInfo, callback);
  });
}

module.exports = {
  convertTo: convertTo
};