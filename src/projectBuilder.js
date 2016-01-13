var path = require('path');

var Q = require('q');    

var fileTools = require('./fileTools'),
    log = require('./log'),
    manifestTools = require('./manifestTools'),
    platformTools = require('./platformTools'),
    utils = require('./utils'),
		validationConstants = require('./constants').validation;

// TODO: platform windows should also generate windows10
var createApps = function (w3cManifestInfo, rootDir, platforms, options, callback) {

	var platformModules;
	
  // determine the path where the app will be created
  options.appName = utils.sanitizeName(w3cManifestInfo.content.short_name);
  var generatedAppDir = path.join(rootDir, options.appName);

  // Add timestamp to manifest information for telemetry purposes only
  w3cManifestInfo.timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\.[0-9]+/, ' ');
  
  // enable all registered platforms
  return Q.fcall(platformTools.enablePlatforms)
    // load all platforms specified in the command line
    .then(function () {
      return platformTools.loadPlatforms(platforms).then(function (modules) {
        // save loaded modules
        return platformModules = modules;
      })
    })
    // validate the manifest
    .then(function (modules) {
      return manifestTools.validateManifest(w3cManifestInfo, modules, platforms)
        .then(function (validationResults) {
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
          return Q.ninvoke(platform, 'create', w3cManifestInfo, generatedAppDir, options);
        };
              
        return Q.resolve();
      });

      return Q.allSettled(tasks).then(function (results) {
        var errmsg = results.reduce(function (msg, result) {
          if (result.state !== 'fulfilled') {
            msg += result.reason.getMessage()
          }
          
          return msg;
        }, '');
        
        if (errmsg.length) {
          return Q.reject(new Error(errmsg));
        }
      });
    })
    .nodeify(callback);
}

function packageApps (platforms, rootDir, options, callback) {

  // enable all registered platforms
  return Q.fcall(platformTools.enablePlatforms)
    // load all platforms specified in the command line
    .then(function () {
      return platformTools.loadPlatforms(platforms);
    })
    .then(function (platformModules) {
      // create apps for each platform
      var tasks = platformModules.map(function (platform) {
        if (!platform) {
          return Q.resolve();
        };
              
        log.debug('Packaging the app for the \'' + platform.name + '\' platform...');
        return Q.ninvoke(platform, 'package', rootDir, options)
          .then(function () {
            log.info('The ' + platform.name + ' app is packaged!');
          })
          .catch(function (err) {
            log.error('The ' + platform.name + ' app could not be packaged - '+ err.getMessage());
          });
      });

      return Q.allSettled(tasks);
    })
    .nodeify(callback);
};

module.exports = {
  createApps: createApps,
  packageApps: packageApps
};
