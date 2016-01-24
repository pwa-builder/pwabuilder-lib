'use strict';

var fs = require('fs'),
    path = require('path'),
    Q = require('q');

var CustomError = require('./customError'),
    exec = require('./processTools').exec, 
    log = require('./log'),
    platformTools = require('./platformTools');

function openVisualStudioProject (visualStudioFilePath, callback) {
  log.info('Opening the Visual Studio project \'' + visualStudioFilePath + '\'...');
  return exec('cmd', ['/c', visualStudioFilePath], { statusMessage: 'Opening project ' }).catch(function (err) {
    return Q.reject(new CustomError('Failed to open the Visual Studio file "' + visualStudioFilePath + '".', err));
  })
  .nodeify(callback);
}

// searches for the telemetry file present in every platform project
function searchForTelemetryFile (dir) {
 
  var telemetryFile = path.join(dir, 'generationInfo.json');
  return Q.nfcall(fs.stat, telemetryFile).then(function (info) {
    // return current directory if the name matches and it's a file
    if (info.isFile()) {
      return dir;
    }
  })
  .catch (function (err) {
    // report any error other than not found
    if (err.code !== 'ENOENT') {
      throw err;
    }    
  })
  .then (function (root) {
    // if a result was found, return it
    if (root) {
      return root;
    }
    
    // search parent directory unless we are already at the root
    var parentPath = path.resolve(dir, '..');    
    if (parentPath !== dir) {
      return searchForTelemetryFile(parentPath);    
    }
  });
}

function isProjectRoot (dir) {
  // get available platform IDs  
  var platforms = platformTools.listPlatforms();
  
  // search child platform folders  
  return Q.nfcall(fs.readdir, dir).then(function (files) {    
    var searchTasks = files.map(function (file) {

      // skip folders not matching a platform ID
      if (platforms.indexOf(file) < 0) {
        return Q.resolve(false);
      }

      // search for telemetry file in the platform folder      
      var platformDir = path.join(dir, file);
      return searchForTelemetryFile(platformDir).then(function (result) {
        return !!result;
      });
    });
    
    return Q.all(searchTasks).then (function (values) {
      // verify if any platform folder contained a telemetry file      
      return values.some(function (result) {
        return result;
      });
    });
  });
}

// given a path within a manifoldjs project, returns its root
function getProjectRoot (dir) {

  // check if this is the project root
  return isProjectRoot(dir).then(function (isRoot) {
    if (isRoot) {
      return dir;
    }
        
    // search for a platform folder containing telemetry file
    return searchForTelemetryFile(dir).then(function (filePath) {
      if (filePath) {
        // start search for project root from the platform folder
        var parentPath = path.resolve(filePath, '..');    
        if (parentPath !== dir) {
          return getProjectRoot(parentPath);
        }
      }
    });
  })
  .then(function (rootPath) {
    // could be a false positive (e.g. 'cordova/platforms' folder)
    // search parent directories unless already at the root
    if (rootPath) {
      var parentPath = path.resolve(rootPath, '..');    
      if (parentPath !== dir) {
        return getProjectRoot(parentPath).then(function (result) {          
          return result || rootPath;
        });
      }
    }
  });
}

module.exports = {
  openVisualStudioProject: openVisualStudioProject,
  isProjectRoot: isProjectRoot,
  getProjectRoot: getProjectRoot
};
