'use strict';

var path = require('path'),
    fs = require('fs'),
    Q = require('q'),
    url = require('url');

var constants = require('../constants'),
    log = require('../log'),
    platformTools = require('../platformTools'),
    utils = require('../utils');

var toStringFunction = Object.prototype.toString;

// load the rule(s) from a folder or file
function loadValidationRules(fileOrDir, platforms, callback) {

  var stat = Q.nfbind(fs.stat); 

  // list contents of the validation rules folder
  return Q.nfcall(fs.readdir, fileOrDir).then(function (files) {
    return Q.allSettled(files.map(function (file) {
      var filePath = path.join(fileOrDir, file);
      return stat(filePath).then(function (info) {
        // test if file system object is a directory or a file
        if (info.isDirectory()) {
          // ignore any directory that doesn't  match one of the requested platforms 
          if (platforms.indexOf(file) < 0) {
              return Q.resolve();
          }
          
          // process the rules in the platform folder
          return loadValidationRules(filePath, []);
        }
        
        // load the rules defined in the file
        var rulePath = path.join(fileOrDir, file);
        try {
          // load the rule from the file
          return require(rulePath);
        }
        catch (err) {
          return Q.reject(new Error('Failed to load validation rule from file: \'' + rulePath + '\'. ' + err.message + '.'));
        }
      });
    }))
    .then (function (results) {
      // verify the results and consolidate the loaded rules  
      return results.reduce(function (validationRules, result) {
        if (result.state === 'fulfilled') {
          if (result.value) {
            if (Array.isArray(result.value)) {
              validationRules.push.apply(validationRules, result.value);
            }
            else {
              validationRules.push(result.value);            
            }              
          }            
        }
        else {
          log.error(result.reason.getMessage());
        }
        
        return validationRules;
      }, []);
    });
  })
  .catch (function (err) {
    if (err.code !== 'ENOTDIR') {
      throw err;
    }
    
    // fileOrDir is a file
    var rules = require(fileOrDir);
    return Array.isArray(rules) ? rules : [rules];
  })  
  .catch(function (err) {
    return Q.reject(new Error('Failed to read validation rules from the specified location: \'' + fileOrDir + '\'. ' + err.message + '.'));
  })
  .nodeify(callback);
}

function runValidationRules(w3cManifestInfo, rules, callback) {

  var results = [];
  var pendingValidations = [];

  rules.forEach(function (validationRule) {
    var validationTask = Q.defer();
    pendingValidations.push(validationTask.promise);

    validationRule(w3cManifestInfo.content, function (err, ruleResult) {
      if (err) {
        return validationTask.reject(err);
      }

      if (toStringFunction.call(ruleResult) === '[object Array]') {
        results.push.apply(results, ruleResult);
      } else if (ruleResult) {
        results.push(ruleResult);
      }

      validationTask.resolve();
    });
  });

  return Q.allSettled(pendingValidations)
    .thenResolve(results)
    .nodeify(callback);
}

function applyValidationRules(w3cManifestInfo, platformModules, platforms) {

  var allResults = [];

  function validateAllPlatforms() {
    // load and run validation rules for "all platforms"
    var validationRulesDir = path.join(__dirname, 'validationRules');
    return loadValidationRules(validationRulesDir).then(function (rules) {
      return runValidationRules(w3cManifestInfo, rules).then(function (results) {
        allResults.push.apply(allResults, results);
      });
    });
  }

  function validatePlatform() {
    // run platform-specific validation rules 
    var platformTasks = platformModules.map(function (platform) {
      return platform.getValidationRules(platforms).then(function (rules) {
        return runValidationRules(w3cManifestInfo, rules).then(function (results) {
          allResults.push.apply(allResults, results);
        });
      });
    });

    return Q.allSettled(platformTasks);
  }
  
  // Don't run the "All Platform" validattion for Edge Extensions since they are not w3c compliant
  if (platforms.length === 1 && platforms[0] === constants.EDGE_EXTENSION_FORMAT) {
    return validatePlatform()
      .thenResolve(allResults);
  } else {
    return validateAllPlatforms()
      .then(validatePlatform)
      .thenResolve(allResults);
  } 
}

function validateManifest(w3cManifestInfo, platforms, callback) {

  if (!w3cManifestInfo || !w3cManifestInfo.content) {
    return Q.reject(new Error('Manifest content is empty or invalid.')).nodeify(callback);
  }

  if (w3cManifestInfo.format !== constants.BASE_MANIFEST_FORMAT) {
    return Q.reject(new Error('The manifest passed as argument is not a W3C manifest.')).nodeify(callback);
  }

  return platformTools.loadPlatforms(platforms).then(function (platformModules) {
    return applyValidationRules(w3cManifestInfo, platformModules, platforms);
  })
  .nodeify(callback);    
}

function imageValidation(manifestContent, description, platform, level, requiredIconSizes, callback) {
  var icons = manifestContent.icons;

  var result = {
    description: description,
    platform: platform,
    level: level,
    member: constants.validation.manifestMembers.icons,
    code: constants.validation.codes.missingImage,
    data: requiredIconSizes.slice()
  };

  if (!icons || icons.length === 0) {
    return callback(undefined, result);
  }

  var missingIconsSizes = [];
  var found;

  for (var i = 0; i < requiredIconSizes.length; i++) {
    var requiredIcon = requiredIconSizes[i];
    found = false;

    for (var j = 0; j < icons.length; j++) {
      if (requiredIcon === icons[j].sizes) {
        found = true;
      }
    }

    if (!found) {
      missingIconsSizes.push(requiredIcon);
    }
  }

  result.data = missingIconsSizes;

  if (!missingIconsSizes || missingIconsSizes.length === 0) {
    callback();
  } else {
    callback(undefined, result);
  }
}

function imageGroupValidation(manifestContent, description, platform, validIconSizes, callback) {
  var icons = manifestContent.icons;

  var result = {
    description: description,
    platform: platform,
    level: constants.validation.levels.warning,
    member: constants.validation.manifestMembers.icons,
    code: constants.validation.codes.missingImageGroup,
    data: validIconSizes.slice()
  };

  if (!icons || icons.length === 0) {
    return callback(undefined, result);
  }

  for (var i = 0; i < icons.length; i++) {
    var iconSizes = icons[i].sizes;

    for (var j = 0; j < validIconSizes.length; j++) {
      if (iconSizes === validIconSizes[j]) {
        return callback();
      }
    }
  }

  callback(undefined, result);
}

function validateAndNormalizeStartUrl(siteUrl, manifestInfo, callback) {
  if (manifestInfo.format !== constants.BASE_MANIFEST_FORMAT) {
    return callback(new Error('The manifest found is not a W3C manifest.'), manifestInfo);
  }
  
  if (manifestInfo.content.start_url) {
    if (!utils.isURL(manifestInfo.content.start_url)) {
      return callback(new Error('The manifest\'s start_url member is not a valid URL: \'' + manifestInfo.content.start_url + '\''), manifestInfo);
    }
  } else {
    manifestInfo.content.start_url = '/';
  }
  
  if (siteUrl) {
    if (!utils.isURL(siteUrl)) {
      return callback(new Error('The site URL is not a valid URL: \'' + siteUrl + '\''), manifestInfo);
    }
    
    var parsedSiteUrl = url.parse(siteUrl);
    var parsedManifestStartUrl = url.parse(manifestInfo.content.start_url);
    if (parsedManifestStartUrl.hostname && parsedSiteUrl.hostname !== parsedManifestStartUrl.hostname) {
       // issue #88 - bis
      var subDomainOfManifestStartUrlSplitted = parsedManifestStartUrl.hostname.split('.');
      var lengthSubDomain = subDomainOfManifestStartUrlSplitted.length;
      var subDomainOfManifestStartUrl = null;
      if(lengthSubDomain >= 2){
        subDomainOfManifestStartUrl = 
        subDomainOfManifestStartUrlSplitted[lengthSubDomain - 2] + '.' + subDomainOfManifestStartUrlSplitted[lengthSubDomain - 1];
      }
      if(!subDomainOfManifestStartUrl || !utils.isURL(subDomainOfManifestStartUrl) || parsedSiteUrl.hostname.toLowerCase() !== subDomainOfManifestStartUrl.toLowerCase()){
        return callback(new Error('The domain of the hosted site (' + parsedSiteUrl.hostname + ') does not match the domain of the manifest\'s start_url member (' + parsedManifestStartUrl.hostname + ')'), manifestInfo);
      }
    }
    
    manifestInfo.content.start_url = url.resolve(siteUrl, manifestInfo.content.start_url);
    
    manifestInfo.default = { short_name: utils.getDefaultShortName(siteUrl) };
  }

  return callback(undefined, manifestInfo);
}

module.exports = {
  validateManifest: validateManifest,
  loadValidationRules: loadValidationRules,
  runValidationRules: runValidationRules,
  imageValidation: imageValidation,
  imageGroupValidation: imageGroupValidation,
  validateAndNormalizeStartUrl: validateAndNormalizeStartUrl,
  applyValidationRules: applyValidationRules
};
