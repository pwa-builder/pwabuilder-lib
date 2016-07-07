'use strict';

var fs = require('fs'),
    path = require('path');

function convertToBase (manifestInfo, callback) {
  if (!manifestInfo || !manifestInfo.content) {
    return callback(new Error('Manifest content is empty or not initialized.'));
  }

  return callback(undefined, manifestInfo);
}

function convertFromBase (manifestInfo, callback) {
  if (!manifestInfo || !manifestInfo.content) {
    return callback(new Error('Manifest content is empty or not initialized.'));
  }

  return callback(undefined, manifestInfo);
}

function matchFormat (manifestObj) {
  var schemaFile = path.resolve(__dirname, '..', 'assets', 'web-manifest.json');
  var schema = JSON.parse(fs.readFileSync(schemaFile).toString());

  var lowercasePropName;

  for (var prop in manifestObj) {
    if (manifestObj.hasOwnProperty(prop)) {
      lowercasePropName = prop.toLowerCase();
      if (!schema.properties.hasOwnProperty(lowercasePropName) && lowercasePropName.indexOf('_') <= 0) {
        return false;
      }

      if (lowercasePropName === 'icons') {
        var icons = manifestObj[prop];
        for (var i = 0; i < icons.length; i++) {
          for (var iconProp in icons[i]) {
            if (icons[i].hasOwnProperty(iconProp) && !schema.definitions.icon.properties.hasOwnProperty(iconProp)) {
              return false;
            }
          }
        }
      }
    }
  }

  return true;
}

module.exports = {
  convertToBase: convertToBase,
  convertFromBase: convertFromBase,
  matchFormat: matchFormat
};
