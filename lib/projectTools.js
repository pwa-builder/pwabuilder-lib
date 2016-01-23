'use strict';

var Q = require('q');

var CustomError = require('./customError'),
    exec = require('./processTools').exec, 
    log = require('./log');

function openVisualStudioProject (visualStudioFilePath, callback) {
  log.info('Opening the Visual Studio project \'' + visualStudioFilePath + '\'...');
  return exec('cmd', ['/c', visualStudioFilePath], { statusMessage: 'Opening project ' }).catch(function (err) {
    return Q.reject(new CustomError('Failed to open the Visual Studio file "' + visualStudioFilePath + '".', err));
  })
  .nodeify(callback);
}

module.exports = {
  openVisualStudioProject: openVisualStudioProject
};
