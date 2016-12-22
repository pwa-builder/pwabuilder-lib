'use strict';

var fs = require('fs'),
    path = require('path'),
    Q = require('q'),
    url = require('url');
    
var constants = require('./constants'),
    fileTools = require('./fileTools'),
    iconTools = require('./iconTools'),
    log = require('./log'),
    manifestTools = require('./manifestTools'),
    packageTools = require('./packageTools'),
    utils = require('./utils');

function PlatformBase (id, name, packageName, baseDir, extendedCfg) {
  var self = this;
  
  self.id = id;
  self.name = name;
  self.packageName = packageName;
  self.baseDir = baseDir;
  self.log = log;

  // get extended configuration settings if available
  if (extendedCfg) {
    self.isPWA = extendedCfg.isPWA;
    self.targetFolder = extendedCfg.targetFolder;
  } else {
    self.isPWA = false;
  }

  /**
   * Creates a fully-functional hosted web application application for the platform.
   * 
   * This function must be overridden by subclasses.
   */
  self.create = function (w3cManifestInfo, rootDir, options, callback) {
    return Q.reject(new Error('The \'create\' operation is not implemented for platform: ' + self.id))
            .nodeify(callback);
  };
  
  /**
   * Runs the application created using the `create` operation.
   * 
   * This function is optional. It can be overridden by subclasses. 
   */
  self.run = function (projectDir, options, callback) {
    self.warn('The \'run\' command is not implemented for platform: ' + self.id);
    return Q.resolve().nodeify(callback);
  };

  /**
   * Packages the application for publication to the platform's store.
   * 
   * This function is optional. It can be overridden by subclasses. 
   */
  self.package = function (projectDir, options, callback) {
    self.warn('The \'package\' command is not implemented for platform: ' + self.id);
    return Q.resolve().nodeify(callback);
  };
  
  /**
   * Opens the source code for the platform.
   * 
   * This function is optional. It can be overridden by subclasses. 
   */
  self.open = function (projectDir, options, callback) {
    self.warn('The \'open\' command is not implemented for platform: ' + self.id);
    return Q.resolve().nodeify(callback);
  };

  /**
   * Loads validation rules from the 'validationRules' folder of the platform project. The 
   * validation rules ensure the W3C manifest meets the requirements for your platform.
   * 
   * This function is optional. A platform should override it to use a different strategy for 
   * loading its validation rules.
   */
  self.getValidationRules = function (platforms, callback) {
    
    if (!self.baseDir) {
      self.warn('Missing base directory for platform: ' + self.id + '.');
      return Q.resolve([]).nodeify(callback);
    }

    // first look for a 'validationRules' directory  
    var validationRulesDir = path.join(self.baseDir, 'validationRules');
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
   * Returns an array of icons files as defined in the manifest. The method assumes that all icons 
   * are are square and defined as properties of an 'icons' member, for example:
   *   "icons": {
   *       "30": "/images/smalllogo.png",
   *       "50": "/images/storelogo.png",
   *       "150": "/images/logo.png"
   *    }
   * Platforms should override this method if the manifest icons use a different format.
   */
  self.getManifestIcons = function (manifest) {
    return Object.keys(manifest.icons || {}).map(function (size) { return manifest.icons[size]; });
  };
  
  /**
   * Receives the size (e.g. '50x50') of an icon and returns the corresponding icon element 
   * from the manifest or undefined if not found. The method assumes that all icons 
   * are square and defined as properties of an 'icons' member, for example:
   *   "icons": {
   *       "30": "/images/smalllogo.png",
   *       "50": "/images/storelogo.png",
   *       "150": "/images/logo.png"
   *    }
   * Platforms should override this method if the manifest icons use a different format.
   */
  self.getManifestIcon = function (manifest, size) {
    // assumes icons are square
    var dimensions = size.toLowerCase().split('x');    
    return manifest.icons && manifest.icons[dimensions[0]];
  };

  /**
   * Adds an icon file with the specified size (e.g. '50x50') to the manifest. The method
   * assumes that all icons are square and defined as properties of an 'icons' member, for example:
   *   "icons": {
   *       "30": "/images/smalllogo.png",
   *       "50": "/images/storelogo.png",
   *       "150": "/images/logo.png"
   *    }
   * Platforms should override this method if the manifest icons use a different format.
   */
  self.addManifestIcon = function (manifest, fileName, size) {
    if (!manifest.icons) {
      manifest.icons = {};
    }
    
    // assumes icons are square
    var dimensions = size.toLowerCase().split('x');    
    manifest.icons[dimensions[0]] = fileName;
  };

  /**
   * Downloads the platform icons to the generated app's folder. 
   */
  self.downloadIcons = function (manifest, baseUrl, imagesDir, callback) {
    self.debug('Downloading the ' + self.id + ' icons...');
    
    // download the icons specified in the manifest
    var iconList = manifest.icons;
    return Q.resolve().then(function () {
      if (iconList) {
        var icons = self.getManifestIcons(manifest);
        
        var downloadTasks = icons.map(function (icon) {
          var iconPath = icon.url || icon;
          var iconUrl = url.resolve(baseUrl, iconPath);
          var pathname = icon.fileName || url.parse(iconUrl).pathname; 
          var iconFilePath = path.join(imagesDir, pathname);
          return iconTools.getIcon(iconUrl, iconFilePath);
        });
        
        return Q.allSettled(downloadTasks).then(function (results) {
          results.forEach(function (result) {
            if (result.state === 'rejected') {
              self.warn('Error downloading an icon file. ' + result.reason.message);
            }
          });
        });
      }
    })
    // copy default platform icons to replace any missing icons
    .then(function () {
      var defaultImagesDir = path.join(self.baseDir, 'assets', 'images');
      return fileTools.syncFiles(defaultImagesDir, imagesDir, {
        // filter out default images that do not need to be moved over
        filter: function (file) {
          // determine the icon dimensions assuming a convention where 
          // the file name specifies the icon's size (e.g. '50x50.png')
          var size = path.basename(file, path.extname(file));
          return !self.getManifestIcon(manifest, size);
        }
      }).then(function (files) {        
        files.forEach(function (file) {
          // make path relative to imagesDir
          var filePath = path.relative(imagesDir, file);
          
          // convention is for file name to specify the icon's size
          var size = path.basename(file, path.extname(file));
          self.addManifestIcon(manifest, filePath, size);
        });
      })
      .catch(function (err) {
        if (err.code !== 'ENOENT') {
          return Q.reject(err);
        }
        
        self.debug('No default icons were found to copy for the \'' + self.id + '\' platform.');
      });
    })
    .nodeify(callback);
  };

  /**
  * Copies the documentation to the generated app's folder. All documents must be placed in 
  * the 'docs' folder of the platform. 
  */
  self.copyDocumentation = function (targetPath, platform, callback) {

    if (arguments.length > 1) {
      if (utils.isFunction(platform)) {
        callback = platform;
        platform = '';
      }
    }
    
    var sourcePath = path.join(self.baseDir, 'docs', platform || '');

    self.info('Copying documentation from \'' + sourcePath + '\' to \'' + targetPath + '\'...');

    return fileTools.copyFolder(sourcePath, targetPath).catch (function (err) {
      // failure to copy the documentation is not considered fatal, so catch the error and log as a warning
      self.warn('Failed to copy the documentation for the \'' + platform + '\' Cordova platform. ' + err.getMessage());
    })
    .nodeify(callback);
  };

  /**
  * Writes 'telemetry' information to the generated app's folder, including generation tool version, 
  * platform package version, generated app URL, and generation date.
  */
  self.writeGenerationInfo = function (manifestInfo, targetPath, callback) {

    var appModule = packageTools.getPackageInformation();
    if (!appModule) {    
      self.warn('Failed to retrieve the metadata for the app generation tool.');
      appModule = { version: 'Unknown' };
    }

    var platformModule = packageTools.getPackageInformation(self.packageName);
    if (!platformModule) {
      self.warn('Failed to retrieve the metadata for the \'' + self.id + '\' platform package.');
      platformModule = { version: 'Unknown' };
    }

    var timestamp = manifestInfo.timestamp || new Date().toISOString().replace(/T/, ' ').replace(/\.[0-9]+/, ' ');

    var generationInfo = {
      'generationTool': appModule.name,
      'generationToolVersion': appModule.version,
      'platformId' : self.id,
      'platformPackage' : self.packageName,
      'platformVersion': platformModule.version,
      'generatedFrom': manifestInfo.generatedFrom || 'API',
      'generationDate': timestamp,
    };

    if (manifestInfo.generatedUrl) {
      generationInfo['generatedURL'] = manifestInfo.generatedUrl;
    }

    var filePath = path.join(targetPath, constants.TELEMETRY_FILE_NAME);
    self.info('Writing the generation information for the \'' + self.name + '\' platform to \'' + filePath + '\'...');
    return Q.nfcall(fs.writeFile, filePath, JSON.stringify(generationInfo, null, 4))
            .nodeify(callback);
  };

  /**
  * Returns bool value indicating if the module is PWA or not
  */
  self.isPWAPlatform = function() {
    return self.isPWA;
  }

  /**
  * Returns the intermediate output folder
  */
  self.getOutputFolder = function(rootDir) {
    var targetFolder = self.targetFolder ? self.targetFolder : self.id;
    return path.join(rootDir, targetFolder);
  }

  /**
   * Outputs a debug message to the log.
   */
  self.debug = function (message, source) {
    self.log.debug(message, source || self.id);
  };

  /**
   * Outputs an informational message to the log.
   */
  self.info = function (message, source) {
    self.log.info(message, source || self.id);
  };

  /**
   * Outputs a warning message to the log.
   */
  self.warn = function (message, source) {
    self.log.warn(message, source || self.id);
  };

  /**
   * Outputs an informational message to the log.
   */
  self.error = function (message, source) {
    self.log.error(message, source || self.id);
  };

  /**
   * Outputs a message to the log regardless of the configured logging level.
   */
  self.write = function (message, source) {
    self.log.write(message, source || self.id);
  };
}

module.exports = PlatformBase;
