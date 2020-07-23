'use strict';

var fs = require('fs'),
    path = require('path'),
    Q = require('q');

var constants = require('./constants'),
    CustomError = require('./customError'),
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

function searchForTelemetryFile (dir) {
  var telemetryFile = path.join(dir, constants.TELEMETRY_FILE_NAME);
  return Q.nfcall(fs.stat, telemetryFile).then(function (info) {
    if (info.isFile()) {
      return dir;
    }
  })
  .catch (function (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  })
  .then (function (root) {
    if (root) {
      return root;
    }

    var parentPath = path.resolve(dir, '..');
    if (parentPath !== dir) {
      return searchForTelemetryFile(parentPath);
    }
  });
}

function isProjectRoot (dir) {
  var appTypes = [ constants.PWA_FOLDER, constants.POLYFILLS_FOLDER ];
  var platforms = platformTools.listPlatforms();

  return Q.nfcall(fs.readdir, dir).then(function (files) {
    var searchTasks = files.map(function (file) {

      // if we have PWA or Polyfills folders we are in root
      if (appTypes.indexOf(file) >= 0) {
        return Q.resolve(true);
      }

      // skip folders not matching any platform to continue
      if (platforms.indexOf(file) < 0) {
        return Q.resolve(false);
      }

      var platformDir = path.join(dir, file);
      return searchForTelemetryFile(platformDir).then(function (result) {
        return result;
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

function getProjectRoot (dir) {
  var insidePWA = new RegExp(constants.PWA_FOLDER + '$');
  var insidePolyfills = new RegExp(constants.POLYFILLS_FOLDER + '$');

  return isProjectRoot(dir).then(function (isRoot) {
    if (isRoot) {
      return dir;
    } else if (dir.match(insidePWA) || dir.match(insidePolyfills)) {
      return getProjectRoot(path.resolve(dir, '..'));
    }

    return searchForTelemetryFile(dir).then(function (filePath) {
      if (filePath) {
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

function getProjectPlatformsRecursivelly (dir, configuredPlatforms, foundPlatforms) {
    if (!foundPlatforms) { foundPlatforms = []; }

    return Q.nfcall(fs.readdir, dir).then(function (files) {
      var searchPlatformTasks = files.map(function (file) {
        var extendedDir = path.join(dir, file);
        return Q.nfcall(fs.stat, extendedDir).then(function (info) {
          if (info.isFile()) {
            if (file.match(constants.TELEMETRY_FILE_NAME)) {
              return Q.nfcall(fs.readFile, extendedDir, 'utf8').then(function(data) {
                var generationInfo = JSON.parse(data);
                if (foundPlatforms.indexOf(generationInfo.platformId) < 0 &&
                      configuredPlatforms[generationInfo.platformId]) {
                  foundPlatforms.push(generationInfo.platformId);
                }
              });
            }
          } else if (configuredPlatforms[file]) {
            var telemetryFile = path.join(extendedDir, constants.TELEMETRY_FILE_NAME);
            return Q.nfcall(fs.readFile, telemetryFile, 'utf8').then(function(data) {
              var generationInfo = JSON.parse(data);
              if (foundPlatforms.indexOf(file) < 0 &&
                    configuredPlatforms[file] &&
                    configuredPlatforms[file].packageName.match(generationInfo.platformPackage)) {
                foundPlatforms.push(file);
              }
            });
          } else {
            return getProjectPlatformsRecursivelly(extendedDir, configuredPlatforms, foundPlatforms);
          }
        });
      });

      return Q.allSettled(searchPlatformTasks).then(function() {
        return foundPlatforms;
      });
    });
}

function getProjectPlatforms (dir) {
  var configuredPlatforms = platformTools.getConfiguredPlatforms();

  return getProjectRoot(dir || process.cwd()).then(function (rootDir) {
    if (!rootDir) {
      return Q.reject(new Error('The specified directory does not appear to contain a valid pwabuilder project.'));
    }

    return getProjectPlatformsRecursivelly(rootDir, configuredPlatforms);
  });
}

module.exports = {
  openVisualStudioProject: openVisualStudioProject,
  isProjectRoot: isProjectRoot,
  getProjectRoot: getProjectRoot,
  getProjectPlatforms: getProjectPlatforms
};
