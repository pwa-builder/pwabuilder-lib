var path = require('path');

var Q = require('q');    

var fileTools = require('./fileTools'),
    log = require('./log'),
    manifestTools = require('./manifestTools'),
    platformTools = require('./platformTools'),
    utils = require('./utils'),
		validationConstants = require('./constants').validation;

function processPlatformTasks(tasks) {
  return Q.allSettled(tasks).then(function (results) {
    results.forEach(function (result) {
      if (result.state !== 'fulfilled') {
        log.error(result.reason.getMessage());
      }
    });
  });
}

// TODO: platform windows should also generate windows10
var createApps = function (w3cManifestInfo, rootDir, platforms, options, callback) {

  // validate arguments
  if (arguments.length < 3) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }
  
  if (arguments.length == 4) {
    if (typeof options === "function") {
      callback = options;
      options = {};      
    }
  }
  
  // determine the path where the app will be created
  options.appName = utils.sanitizeName(w3cManifestInfo.content.short_name);
  var generatedAppDir = path.join(rootDir, options.appName);

  // Add timestamp to manifest information for telemetry purposes only
  w3cManifestInfo.timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\.[0-9]+/, ' ');
  
  // enable all registered platforms
	var platformModules;
  return Q.fcall(platformTools.enablePlatforms)
    .then(function () {
      // load all platforms specified in the command line
      return platformTools.loadPlatforms(platforms).then(function (modules) {
        // save loaded modules
        return platformModules = modules;
      })
    })
    // validate the manifest
    .then(function (modules) {
      return manifestTools.validateManifest(w3cManifestInfo, modules, platforms).then(function (validationResults) {
        // output validation results
        var invalidManifest = false;
        var maxLenSeverity = 10;
        validationResults.forEach(function (result) {
          var severity = result.level.toUpperCase();          
          var validationMessage = 'Manifest validation ' + severity + Array(Math.max(maxLenSeverity - severity.length + 1, 0)).join(' ') + ' - ' +  result.description + '(member: ' + result.member + ').';
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
    })
    .then(function () {
      // create app directory
      return fileTools.mkdirp(generatedAppDir);
    })
    .then(function () {
      // create apps for each platform
      var tasks = platformModules.map(function (platform) {
        if (platform) {
          log.debug('Creating the app for the \'' + platform.name + '\' platform...');
          return Q.ninvoke(platform, 'create', w3cManifestInfo, generatedAppDir, options);
        };
              
        return Q.resolve();
      });

      return processPlatformTasks(tasks);
    })
    .nodeify(callback);
}

function packageApps (platforms, options, callback) {

  // validate arguments
  if (arguments.length < 1) {
    return Q.reject(new Error('One or more required arguments are missing.')).nodeify(callback);
  }
  
  if (arguments.length == 2) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
  }
  
  var rootDir = process.cwd();
   
  // enable all registered platforms
  return Q.fcall(platformTools.enablePlatforms).then(function () {
    // load all platforms specified in the command line
    return platformTools.loadPlatforms(platforms);
  })
  .then(function (platformModules) {
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
  
  if (arguments.length == 2) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
  }
    
  // enable all registered platforms
  return Q.fcall(platformTools.enablePlatforms).then(function () {
    // load all platforms specified in the command line
    return platformTools.loadPlatforms([platformId]);
  })
  .then(function (platformModules) {
    // package apps for each platform
    if (platformModules && platformModules.length > 0) {
      var platform = platformModules[0];    
      return Q.ninvoke(platform, 'run', options);
    }

    return Q.resolve();
  })
  .nodeify(callback);  
}

module.exports = {
  createApps: createApps,
  packageApps: packageApps,
  runApp: runApp
};
