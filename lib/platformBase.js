'use strict';

var fs = require('fs'),
    path = require('path'),
    Q = require('q');
    
var	manifestTools = require('./manifestTools'),
    iconTools = require('./iconTools'),
    fileTools = require('./fileTools'),
    packageTools = require('./packageTools'),
    log = require('./log'),
    utils = require('./utils');

function PlatformBase (id, name, packageName, baseDir) {
  var self = this;
  
  self.id = id;
  self.name = name;
  self.packageName = packageName;
  self.baseDir = baseDir;
  self.log = log;
}

/**
 * This function must be overridden by subclasses.
 * 
 * Creates a fully-functional hosted web application application for the given platform.
 */
PlatformBase.prototype.create = function (w3cManifestInfo, rootDir, options, callback) {
  return Q.reject(new Error('The \'create\' operation is not implemented for platform: ' + this.id))
          .nodeify(callback);
};

/**
 * This function is optional. It should be overridden by subclasses. 
 * 
 * Runs the application created using the `create` operation for the given platform.
 */
PlatformBase.prototype.run = function (options, callback) {
  this.warn('The \'run\' command is not implemented for platform: ' + this.id);
  return Q.resolve().nodeify(callback);
};

/**
 * This function is optional. It should be overridden by subclasses. 
 * 
 * Packages the application created using the `create` operation to be published in the platform's store.
 */
PlatformBase.prototype.package = function (rootDir, options, callback) {
  this.warn('The \'package\' command is not implemented for platform: ' + this.id);
  return Q.resolve().nodeify(callback);
};

/**
 * This function is optional. It should be overridden by subclasses. 
 * 
 * Opens the source code for the application created using the `create` operation for the given platform.
 */
PlatformBase.prototype.open = function (options, callback) {
  this.warn('The \'open\' command is not implemented for platform: ' + this.id);
  return Q.resolve().nodeify(callback);
};

/**
 * This function is optional. It should return the validation rules to make sure the W3C manifest meets the
 * requirements for your platform.
 * 
 * By default, it loads validation rules from the 'validationRules' folder of the platform project. 
 */
PlatformBase.prototype.getValidationRules = function (platforms, callback) {
  
  var self = this;
  if (!this.baseDir) {
    this.warn('Missing base directory for platform: ' + this.id + '.');
    return Q.resolve([]).nodeify(callback);
  }

  // first look for a 'validationRules' directory  
  var validationRulesDir = path.join(this.baseDir, 'validationRules');
  return Q.nfcall(fs.stat, validationRulesDir).then(function (stats) {
    if (stats.isDirectory()) {
      return manifestTools.loadValidationRules(validationRulesDir, platforms);
    }              
  })
  .catch(function () {
    // then look for a 'validationRules.js' file
    var validationRulesFile = validationRulesDir + '.js';
    return Q.nfcall(fs.stat, validationRulesFile).then(function (stats) {
      if (stats.isFile()) {
        return manifestTools.loadValidationRules(validationRulesFile, platforms);
      }
      
      self.warn('Failed to retrieve the validation rules for platform: ' + self.id + '. The validation rules folder is missing or invalid.');
      return Q.resolve([]);
    });
  })
  .nodeify(callback);
};
    
/**
 * Copies the default platform icon to the generated app's folder.
 * 
 * The icon must be placed in the 'assets' folder of the platform and named 'defaultIcon.png'.
 */
PlatformBase.prototype.copyDefaultPlatformIcon = function (manifestInfo, iconSize, targetPath, callback) {
  if (this.baseDir) {
    var iconFilepath = path.join(this.baseDir, 'assets', 'defaultIcon.png');
    var stats = fs.statSync(iconFilepath);
    if (stats.isFile()) {
      return iconTools.copyDefaultIcon(manifestInfo.content, this.id, iconSize, iconFilepath, targetPath).nodeify(callback); 
    }
  }
  
  this.warn('A default icon for platform \'' + this.id + '\' was not found. Place the icon in \'assets/defaultIcon.png\'.');
  return Q.resolve().nodeify(callback);
};

/**
 * Copies the documentation to the generated app's folder.
 * 
 * All documents must be placed in the 'docs' folder of the platform. 
 */
PlatformBase.prototype.copyDocumentation = function (targetPath, platform, callback) {

  if (arguments.length > 1) {
    if (utils.isFunction(platform)) {
      callback = platform;
      platform = '';
    }
  }
  
  var sourcePath = path.join(this.baseDir, 'docs', platform || '');

  this.info('Copying documentation from \'' + sourcePath + '\' to \'' + targetPath + '\'...');

  return fileTools.copyFolder(sourcePath, targetPath).catch (function (err) {
    // failure to copy the documentation is not considered fatal, so catch the error and log as a warning
    this.warn('Failed to copy the documentation for the \'' + platform + '\' Cordova platform. ' + err.getMessage());
  })
  .nodeify(callback);
};

PlatformBase.prototype.writeGenerationInfo = function (manifestInfo, targetPath, callback) {

  var appModule = packageTools.getPackageInformation();
  if (!appModule) {    
    this.warn('Failed to retrieve the metadata for the app generation tool.');
    appModule = { version: 'Unknown' };
  }

  var platformModule = packageTools.getPackageInformation(this.packageName);
  if (!platformModule) {
    this.warn('Failed to retrieve the metadata for the \'' + this.id + '\' platform package.');
    platformModule = { version: 'Unknown' };
  }

  var timestamp = manifestInfo.timestamp || new Date().toISOString().replace(/T/, ' ').replace(/\.[0-9]+/, ' ');

  var generationInfo = {
    'manifoldJSVersion': appModule.version,
    'platformId' : this.id,
    'platformPackage' : this.packageName,
    'platformVersion': platformModule.version,
    'generatedFrom': manifestInfo.generatedFrom || 'API',
    'generationDate': timestamp,
  };

  if (manifestInfo.generatedUrl) {
    generationInfo['generatedURL'] = manifestInfo.generatedUrl;
  }

  var filePath = path.join(targetPath, 'generationInfo.json');
  this.info('Writing the generation information for the \'' + this.name + '\' platform to \'' + filePath + '\'...');
  return Q.nfcall(fs.writeFile, filePath, JSON.stringify(generationInfo, null, 4))
          .nodeify(callback);
};

/**
 * Outputs a debug message to the log.
 */
PlatformBase.prototype.debug = function (message, source) {
  this.log.debug(message, source || this.id);
};

/**
 * Outputs an informational message to the log.
 */
PlatformBase.prototype.info = function (message, source) {
  this.log.info(message, source || this.id);
};

/**
 * Outputs a warning message to the log.
 */
PlatformBase.prototype.warn = function (message, source) {
  this.log.warn(message, source || this.id);
};

/**
 * Outputs an informational message to the log.
 */
PlatformBase.prototype.error = function (message, source) {
  this.log.error(message, source || this.id);
};

/**
 * Outputs a message to the log regardless of the configured logging level.
 */
PlatformBase.prototype.write = function (message, source) {
  this.log.write(message, source || this.id);
};

module.exports = PlatformBase;