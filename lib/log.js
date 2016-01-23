'use strict';

var ansi = require('ansi'),
    path = require('path');

// When the source for manifoldjs-lib is a GitHub repository, npm installs 
// separate copies of manifoldjs-lib for each platform. The singleton ensures 
// that all access the global instance; otherwise, each one gets a separate 
// instance of the logger.
var log = global.manifoldjs_logger,
    cursor = ansi(process.stdout);

var colorMap = {
  'debug': 'green',
  'info':  'brightGreen',
  'warn':  'brightYellow',
  'error': 'brightRed',
  'default': 'white'
};

function getApplicationName (appPath) {
    
  try {
    if (!appPath) {
      appPath = path.dirname(require.main.filename);
    }
    
    var mainModule = path.join(appPath, 'package.json');
    return require(mainModule).name;
  }
  catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    
    var next = path.resolve(appPath, '..');
    if (appPath !== next) {
      return getApplicationName(next);   
    }    
  }
} 

if (!log) {
  log = require('loglevel');
  
  var maxLenSeverity = 5;
  var maxLenSource = 12;

  var originalFactory = log.methodFactory;
  log.methodFactory = function (methodName, logLevel, loggerName) {
    var rawMethod = originalFactory(methodName, logLevel, loggerName);
    
    return function (message, source, severity) {
      
      severity = severity || methodName;
      var color = colorMap[severity] || colorMap['default'];
      cursor[color]();

      message = message.replace(/\n/g, '\n' + new Array(maxLenSeverity + maxLenSource + 6).join(' '));
      
      if (methodName !== 'write') {
        source = source || loggerName || getApplicationName();
        rawMethod(
          '[' + severity + new Array(Math.max(maxLenSeverity - severity.length + 1, 0)).join(' ') + '] ' +
          source + new Array(Math.max(maxLenSource - source.length + 1, 0)).join(' ') + ': ' +
          message);        
      }
      else {
        rawMethod(message);
      }
       
      cursor.reset();  
    };
  };
  
  log.write = log.methodFactory('write', log.levels.INFO, '');
  
  // call setLevel to apply the changes
  log.setLevel(log.getLevel());
  
  global.manifoldjs_logger = log;
}

module.exports = log;
