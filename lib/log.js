'use strict';

var log = global.manifoldjs_logger;

var packageTools = require('./packageTools');

if (!log) {
  log = require('loglevel');
  
  var maxLenSeverity = 5;
  var maxLenSource = 12;

  var originalFactory = log.methodFactory;
  log.methodFactory = function (methodName, logLevel, loggerName) {
    var rawMethod = originalFactory(methodName, logLevel, loggerName);
    
    return function (message, source, severity) {
      message = message.replace(/\n/g, '\n' + new Array(maxLenSeverity + maxLenSource + 6).join(' '));
      
      if (methodName !== 'write') {
        source = source || loggerName || packageTools.getApplicationName();      
        severity = severity || methodName;
        rawMethod(
          '[' + severity + new Array(Math.max(maxLenSeverity - severity.length + 1, 0)).join(' ') + '] ' +
          source + new Array(Math.max(maxLenSource - source.length + 1, 0)).join(' ') + ': ' +
          message);        
      }
      else {
        rawMethod(message);
      } 
    };
  };
  
  log.write = log.methodFactory('write', log.levels.INFO, '');
  
  // call setLevel to apply the changes
  log.setLevel(log.getLevel());
  
  global.manifoldjs_logger = log;
}

module.exports = log;
