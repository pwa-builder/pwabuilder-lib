'use strict';

var path = require('path');

var Q = require('q');    

var fileTools = require('./fileTools'),
    log = require('./log'),
    manifestTools = require('./manifestTools'),
    platformTools = require('./platformTools'),
    utils = require('./utils'),
		validationConstants = require('./constants').validation;

function processPlatformTasks (tasks) {
  return Q.allSettled(tasks).then(function (results) {
    var result = results.reduce(function (success, result) {
      if (result.state !== 'fulfilled') {
        log.error(result.reason.getMessage());
        return false;
      }
      
      return success;
    }, true);
    
    if (!result) {
      return Q.reject(new Error('One or more platforms could not be generated successfully.'));
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
      var validationMessage = 'Manifest validation ' + severity + new Array(Math.max(maxLenSeverity - severity.length + 1, 0)).join(' ') + ' - ' +  result.description + '(member: ' + result.member + ').';
      if (result.level === validationConstants.levels.suggestion || result.level === validationConstants.levels.warning) {
        log.warn(validationMessage, result.platform);        
      } else if (result.level === validationConstants.levels.error) {
        log.error(validationMessage, result.platform);        
        invalidManifest = true;
      }
    });
    
    // report manifest validation errors
    if (invalidManifest) {
      return Q.reject(new Error('The manifest is not valid. Review the validation messages above for additional information.'));
    }
  });
}

function createApps (w3cManifestInfo, rootDir, platforms, options, callback) {

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
  
  // determine the path where the app will be created
  options.appName = utils.sanitizeName(w3cManifestInfo.content.short_name);
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
    // create apps for each platform
    var tasks = platformModules.map(function (platform) {
      if (platform) {
        log.debug('Creating the app for the \'' + platform.name + '\' platform...');
        return Q.ninvoke(platform, 'create', w3cManifestInfo, generatedAppDir, options);
      }
            
      return Q.resolve();
    });

    return processPlatformTasks(tasks);
  })
  .nodeify(callback);
}

function packageApps (platforms, rootDir, options, callback) {

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
  
  // load all platforms specified in the command line
  return platformTools.loadPlatforms(platforms).then(function (platformModules) {
    // package apps for each platform
    var tasks = platformModules.map(function (platform) {
      if (platform) {
        log.debug('Packaging the app for the \'' + platform.name + '\' platform...');
        return Q.ninvoke(platform, 'package', rootDir, options);
      }

      return Q.resolve();
    });

    return processPlatformTasks(tasks);
  })
  .nodeify(callback);
}

function runApp (platformId, options, callback) {
  // validate arguments
  if (arguments.length < 1) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }
  
  if (arguments.length === 2) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }
    
  // load the specified platform
  return platformTools.loadPlatforms([platformId]).then(function (platformModules) {
    // run the app for the platform
    if (platformModules && platformModules.length > 0) {
      var platform = platformModules[0];
      return Q.ninvoke(platform, 'run', options);
    }

    return Q.resolve();
  })
  .nodeify(callback);  
}

function openApp (platformId, options, callback) {
  // validate arguments
  if (arguments.length < 1) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }
  
  if (arguments.length === 2) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }
    
  // load the specified platform
  return platformTools.loadPlatforms([platformId]).then(function (platformModules) {
    // open the app for the platform
    if (platformModules && platformModules.length > 0) {
      var platform = platformModules[0];    
      return Q.ninvoke(platform, 'open', options);
    }

    return Q.resolve();
  })
  .nodeify(callback);  
}

module.exports = {
  createApps: createApps,
  packageApps: packageApps,
  runApp: runApp,
  openApp: openApp
};
