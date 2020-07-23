'use strict';

var path = require('path');

var Q = require('q');

var CustomError = require('./customError'),
  fileTools = require('./fileTools'),
  log = require('./log'),
  manifestTools = require('./manifestTools'),
  platformTools = require('./platformTools'),
  projectTools = require('./projectTools'),
  projectValidation = require('./validations').projectValidation,
  utils = require('./utils'),
  constants = require('./constants'),
  validationConstants = require('./constants').validation;

function processPlatformTasks(tasks) {
  return Q.allSettled(tasks).then(function (results) {
    var errorMessage = "";
    var result = results.reduce(function (success, result) {
      if (result.state !== 'fulfilled') {
        errorMessage = result.reason.getMessage();
        log.error("Error generating platform", errorMessage);
        return false;
      }

      return success;
    }, true);

    if (!result) {
      var errorMessageAppend = errorMessage ? " \n" + errorMessageAppend : "";
      return Q.reject(new Error('One or more platforms could not be generated successfully.' + errorMessageAppend));
    } else {
      return Q.resolve(results.map(function (result) {
        return result.value;
      }));
    }
  });
}

function validateManifest(w3cManifestInfo, platformModules, platforms) {
  return manifestTools.applyValidationRules(w3cManifestInfo, platformModules, platforms).then(function (validationResults) {
    // output validation results
    var invalidManifest = false;
    var maxLenSeverity = 10;
    validationResults.forEach(function (result) {
      var severity = result.level.toUpperCase();
      var validationMessage = 'Manifest validation ' + severity + new Array(Math.max(maxLenSeverity - severity.length + 1, 0)).join(' ') + ' - ' + result.description + '(member: ' + result.member + ').';
      if (result.level === validationConstants.levels.suggestion || result.level === validationConstants.levels.warning) {
        log.warn(validationMessage, result.platform);
      } else if (result.level === validationConstants.levels.error) {
        // handle expected errors rather than deeming it as invalid
        if (projectValidation.isExpectedValidationError(result) && projectValidation.isExpectedCase(result, w3cManifestInfo)) {
          log.warn('Manifest validation ' + "WARNING" + new Array(Math.max(maxLenSeverity - severity.length + 1, 0)).join(' ') + ' - ' + result.description + '(member: ' + result.member + ').', result.platform);
        } else {
          log.error(validationMessage, result.platform);
          invalidManifest = true;
        }
      }
    });

    // report manifest validation errors
    if (invalidManifest) {
      return Q.reject(new Error('The manifest is not valid. Review the validation messages above for additional information.'));
    }
  });
}

function generateImages(w3cManifestInfo, options, callback) {
  if (options.image) {
    return fileTools.readFile(options.image).then(function (fileContent) {
      return manifestTools.generateImagesForManifest(fileContent, w3cManifestInfo.content).then(function (updatedManifest) {
        w3cManifestInfo.content = updatedManifest;
        options.assets = options.assets || [];
        options.assets.push({
          fileName: path.basename(options.image),
          data: fileContent
        });

        return Q.resolve();
      });
    }).nodeify(callback);
  }

  return Q.resolve.nodeify(callback);
}

function copyAssets(assets, generatedAppDir, callback) {
  if (assets && assets instanceof Array && assets.length > 0) {
    var assetsDir = path.join(generatedAppDir, constants.ASSETS_FOLDER);
    return fileTools.mkdirp(assetsDir).then(function () {
      var tasks = assets.map(function (asset) {
        log.debug('Copying asset \'' + asset.fileName + '\' to the \'' + assetsDir + '\' folder...');
        return fileTools.writeFile(path.join(assetsDir, asset.fileName), asset.data);
      });

      return Q.all(tasks);
    }).nodeify(callback);
  }

  return Q.resolve().nodeify(callback);
}

function createApps(w3cManifestInfo, rootDir, platforms, options, href, callback) {
  // validate arguments
  if (arguments.length < 3) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }

  if (arguments.length === 4) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }

  if (!href) {
    href = '/';
  }

  // determine the path where the app will be created
  options.appName = utils.sanitizeName(w3cManifestInfo.content.short_name.replace(/[^a-zA-Z0-9]/g, '_'));
  var generatedAppDir = path.join(rootDir, options.appName);

  // Add timestamp to manifest information for telemetry purposes only
  w3cManifestInfo.timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\.[0-9]+/, ' ');

  // create app directory
  return fileTools.mkdirp(generatedAppDir).then(function () {
    // load the platform modules
    return platformTools.loadPlatforms(platforms);
  })
    .then(function (platformModules) {
      // validate the manifest
      return validateManifest(w3cManifestInfo, platformModules, platforms).thenResolve(platformModules);
    })
    .then(function (platformModules) {
      // generate missing icons
      return generateImages(w3cManifestInfo, options).thenResolve(platformModules);
    })
    .then(function (platformModules) {
      // create apps for each platform
      var tasks = platformModules.map(function (platform) {
        if (platform) {
          log.debug('Creating the \'' + platform.name + '\' app...');
          return Q.resolve(generatedAppDir).then(function (generatedAppOutputDir) {
            return fileTools.mkdirp(generatedAppOutputDir).then(function () {
              var w3cManifestInfoCopy = JSON.parse(JSON.stringify(w3cManifestInfo));
              return Q.ninvoke(platform, 'create', w3cManifestInfoCopy, generatedAppOutputDir, options, href).then(function () {
                log.info('The ' + platform.name + ' app was created successfully!');
              })
                .catch(function (err) {
                  return Q.reject(new CustomError('Failed to create the ' + platform.name + ' app.', err));
                });
            });
          });
        }

        return Q.resolve();
      });

      return processPlatformTasks(tasks);
    })
    .then(function () {
      // copy assets to the assets folder
      return copyAssets(options.assets, generatedAppDir);
    })
    // return path to project folder
    .thenResolve(generatedAppDir)
    .nodeify(callback);
}

function packageApps(platforms, dir, options, callback) {
  // validate arguments
  if (arguments.length < 2) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }

  if (arguments.length === 3) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }

  // find the root of the project
  return projectTools.getProjectRoot(dir && path.resolve(dir) || process.cwd()).then(function (rootDir) {
    if (!rootDir) {
      return Q.reject(new Error('The specified directory does not appear to contain a valid pwabuilder project.'));
    }

    // load all platforms specified in the command line
    return platformTools.loadPlatforms(platforms).then(function (platformModules) {
      // package apps for each platform
      var tasks = platformModules.map(function (platform) {
        if (platform) {
          log.debug('Packaging the \'' + platform.name + '\' app...');
          return Q.resolve(rootDir).then(function (rootOutputDir) {
            return Q.ninvoke(platform, 'package', rootOutputDir, options).then(function (path) {
              log.info('The ' + platform.name + ' app was packaged successfully!');
              return Q.resolve(path);
            })
              .catch(function (err) {
                return Q.reject(new CustomError('Failed to package the ' + platform.name + ' app.', err));
              });
          });
        } else {
          return Q.resolve();
        }
      });

      return processPlatformTasks(tasks);
    });
  })
    .nodeify(callback);
}

function runApp(platformId, dir, options, callback) {
  // validate arguments
  if (arguments.length < 2) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }

  if (arguments.length === 3) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }

  // find the root of the project
  return projectTools.getProjectRoot(dir && path.resolve(dir) || process.cwd()).then(function (rootDir) {
    if (!rootDir) {
      return Q.reject(new Error('The specified directory does not appear to contain a valid pwabuilder project.'));
    }

    // load the specified platform
    return platformTools.loadPlatforms([platformId]).then(function (platformModules) {
      // run the app for the platform
      if (platformModules && platformModules.length > 0) {
        var platform = platformModules[0];
        log.debug('Launching the \'' + platform.name + '\' app ...');
        return Q.resolve(rootDir).then(function (rootOutputDir) {
          return Q.ninvoke(platform, 'run', rootOutputDir, options).catch(function (err) {
            return Q.reject(new CustomError('Failed to launch the ' + platform.name + ' app.', err));
          });
        });
      }

      return Q.resolve();
    });
  })
    .nodeify(callback);
}

function openApp(platformId, dir, options, callback) {
  // validate arguments
  if (arguments.length < 2) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }

  if (arguments.length === 3) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }

  // find the root of the project
  return projectTools.getProjectRoot(dir && path.resolve(dir) || process.cwd()).then(function (rootDir) {
    if (!rootDir) {
      return Q.reject(new Error('The specified directory does not appear to contain a valid pwabuilder project.'));
    }

    // load the specified platform
    return platformTools.loadPlatforms([platformId]).then(function (platformModules) {
      // open the app for the platform
      if (platformModules && platformModules.length > 0) {
        var platform = platformModules[0];
        log.debug('Opening the \'' + platform.name + '\' app...');
        return Q.resolve(rootDir).then(function (rootOutputDir) {
          return Q.ninvoke(platform, 'open', rootOutputDir, options).catch(function (err) {
            return Q.reject(new CustomError('Failed to open the ' + platform.name + ' app.', err));
          });
        });
      }

      return Q.resolve();
    });
  })
    .nodeify(callback);
}

module.exports = {
  createApps: createApps,
  packageApps: packageApps,
  runApp: runApp,
  openApp: openApp
};
