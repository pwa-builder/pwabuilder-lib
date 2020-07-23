'use strict';

var path = require('path'),
  Q = require('q');

var fileTools = require('./fileTools'),
  CustomError = require('./customError'),
  log = require('./log'),
  packageTools = require('./packageTools'),
  utils = require('./utils');

var platformConfiguration;

function getDefaultConfigPath() {
  return path.resolve(path.dirname(utils.getRootPackagePath()), 'platforms.json');
}

function getPlatformModule(packageName, source) {

  if (!packageName) {
    return Q.reject(new Error('Platform name is missing or invalid.'));
  }

  if (!source) {
    return Q.reject(new Error('Platform package source is missing or invalid.'));
  }

  try {
    var module = require(packageName);
    return Q.resolve(module);
  }
  catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      return Q.reject(new CustomError('Failed to resolve module: \'' + packageName + '\'.', err));
    }

    return packageTools.queuePackageInstallation(packageName, source).then(function () {
      var module = require(packageName);
      return Q.resolve(module);
    });
  }
}

function loadPlatform(packageName, source, callback) {
  log.debug('Loading platform module: ' + packageName);
  return getPlatformModule(packageName, source).then(function (module) {
    return module.Platform;
  })
    .nodeify(callback);
}

function configurePlatforms(config) {
  if (!config) {
    config = getDefaultConfigPath();
  }

  if (config && typeof config === 'string') {
    try {
      config = require(config);
    }
    catch (err) {
      throw new Error('Platform configuration file is missing or invalid - path: \'' + config + '\'.');
    }
  }

  platformConfiguration = config;
}

function loadPlatforms(platforms, config, callback) {

  if (arguments.length < 3) {
    if (utils.isFunction(config)) {
      callback = config;
      config = undefined;
    }
  }

  configurePlatforms(config || platformConfiguration);

  var platformMap = {};
  var tasks = (platforms || []).reduce(function (taskList, platformId) {

    var platformInfo = platformConfiguration[platformId];
    if (platformInfo && platformInfo.packageName) {
      var packageName = platformInfo.packageName;

      var platformList = platformMap[packageName];

      if (!platformList) {

        platformMap[packageName] = platformList = [];
        var task = loadPlatform(packageName, platformInfo.source).then(function (Platform) {
          return { packageName: packageName, Platform: Platform, platforms: platformList };
        });

        taskList.push(task);
      }

      platformList.push(platformId);
    }
    else {
      taskList.push(Q.reject(new Error('Platform \'' + platformId + '\' is not registered!')));
    }

    return taskList;
  }, []);

  packageTools.installQueuedPackages();

  return Q.allSettled(tasks).then(function (results) {
    return results.reduce(function (modules, result) {
      if (result.state === 'fulfilled') {
        var module = result.value;
        modules.push(new module.Platform(module.packageName, module.platforms));
      }

      return modules;
    }, []);
  })
    .nodeify(callback);
}

function getPlatformPackageInfo(id, callback) {
  return packageTools.getNpmPackageInfo(id).catch(function (err) {
    log.debug('Failed to locate the plaform package in the npm registry...', err);
    return packageTools.getGitHubPackageInformation(id);
  })
    .catch(function (err) {
      log.debug('Failed to locate the plaform package in GitHub...');
      try {
        return packageTools.getModuleInformation(id);
      }
      catch (err) {
        log.debug('Failed to locate the plaform package in the local disk...', err);
        try {
          return packageTools.getPackageInformation(id);
        }
        catch (err) {
          log.debug('Failed to locate the plaform package module...');
          return Q.reject(new Error('Failed to retrieve the platform package information.'));
        }
      }
    })
    .nodeify(callback);
}

function updatePlatformConfig(configPath, updateFunction) {
  return fileTools.replaceFileContent(configPath || getDefaultConfigPath(), updateFunction);
}

function addPlatform(platformId, source, configPath, callback) {

  if (arguments.length === 3) {
    if (utils.isFunction(configPath)) {
      callback = configPath;
      configPath = undefined;
    }
  }

  return getPlatformPackageInfo(source).then(function (packageInfo) {
    var packageName = packageInfo.name;
    return updatePlatformConfig(configPath, function (data) {
      var platforms = JSON.parse(data);
      platforms[platformId] = { packageName: packageName, source: source };
      return JSON.stringify(platforms, null, 4);
    });
  })
    .nodeify(callback);
}

function removePlatform(platformId, configPath, callback) {

  if (arguments.length === 2) {
    if (utils.isFunction(configPath)) {
      callback = configPath;
      configPath = undefined;
    }
  }

  return updatePlatformConfig(configPath, function (data) {
    var platforms = JSON.parse(data);
    if (!platforms[platformId]) {
      throw new Error('Platform \'' + platformId + '\' is not registered.');
    }

    delete platforms[platformId];
    return JSON.stringify(platforms, null, 4);
  })
    .nodeify(callback);
}

function getConfiguredPlatforms(configPath) {
  configurePlatforms(configPath || platformConfiguration);

  return platformConfiguration;
}

function listPlatforms(configPath) {
  return Object.keys(getConfiguredPlatforms(configPath));
}

module.exports = {
  configurePlatforms: configurePlatforms,
  getConfiguredPlatforms: getConfiguredPlatforms,
  loadPlatform: loadPlatform,
  loadPlatforms: loadPlatforms,
  addPlatform: addPlatform,
  removePlatform: removePlatform,
  listPlatforms: listPlatforms,
  getPlatformPackageInfo: getPlatformPackageInfo
};
