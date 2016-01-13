var exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path');

var log = require('./log'),
    utils = require('./utils'),
    validations = require('./validations');

var isWindows10Version = function (version) {
  return /^10/.test(version);
};

function getWindowsVersion (callback) {
  log.info('Obtaining Windows version...');
  var cmdLine = 'powershell (Get-WmiObject win32_operatingsystem).version';
  log.debug('    ' + cmdLine);
  exec(cmdLine, function (err, stdout, stderr) {
    log.debug(stdout);
    if (err) {
      log.debug(err);
      return callback(new Error('Failed to run the app for Windows platform.'));
    } else if (stderr.length) {
      log.error(stderr.trim());
    }

    callback(undefined, stdout.trim());
  });
};

var openVisualStudioFile = function (visualStudioFilePath, callback) {
  log.info('Opening the Visual Studio file "' + visualStudioFilePath + '"...');
  
  var cmdLine = 'start ' + visualStudioFilePath;
  exec(cmdLine, function (err, stdout, stderr) {
    log.debug(stdout);
    if (err) {
      log.debug(err);
      return callback(new Error('Failed to open the Visual Studio file "' + visualStudioFilePath + '".'));
    } else if (stderr.length) {
      log.error(stderr.trim());
      return callback(new Error('Failed to open the Visual Studio file "' + visualStudioFilePath + '".'));
    }
    
    callback();
  });
};

var openVisualStudio = function (callback) {
  if (!utils.isWindows) {
    return callback(new Error('Visual Studio projects can only be opened in Windows environments.'));
  }

  var windowsCordovaSolutionFileName = 'CordovaApp.sln';
  var windows10ProjectFileName = 'App.jsproj';
  
  searchFile(process.cwd(), windows10ProjectFileName, function (err, results) {
    if (err) {
      log.debug(err);
      return callback(new Error('Failed to find the Windows 10 project: "' + windows10ProjectFileName + '"'));
    }
    
    getWindowsVersion(function (error, version) {
      if (err) {
        return callback(err);
      }
      
      if (results && results.length > 0 && isWindows10Version(version)) {
        // If there is a windows 10 project file and the OS is Windows 10, open the windows 10 project
        openVisualStudioFile(results[0], function (err) {
          callback(err);
        });
      } else {
        // If there is a windows 8.1 solution file, open the windows 8.1 solution
        searchFile(process.cwd(), windowsCordovaSolutionFileName, function (err, results) {
          if (err) {
            log.debug(err);
            return callback(new Error('Failed to find the Visual Studio solution: "' + windowsCordovaSolutionFileName + '"'));
          }
          
          if (!results || results.length === 0) {
            return callback(new Error('Could not find a Visual Studio project/solution to open. Make sure you are positioned in the right app folder.'));
          }
          
          openVisualStudioFile(results[0], function (err) {
            callback(err);
          });
        });
      }
    });
  });
};

module.exports = {
  openVisualStudio: openVisualStudio,
  getWindowsVersion: getWindowsVersion
};
