'use strict';

var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    semver = require('semver'),
    url = require('url'),
    Q = require('q');

var CustomError = require('./customError'),
    exec = require('./processTools').exec,
    log = require('./log'),
    utils = require('./utils');
    
var node_modules = 'node_modules';
var packageJson = 'package.json';

var installTask;
var installQueue = [];

function downloadFile (inputUri, callback) {

  var uri = url.parse(inputUri);

  var options = {
    host: uri.hostname,
    port: uri.port || (uri.protocol === 'https:' ? 443 : 80),
    path: uri.path,
    agent: false
  };

  var protocol = uri.protocol === 'https:' ? https : http;

  var deferred = Q.defer();
  protocol.get(options, function (res) {
    
    var buffer = '';
    res.on('data', function(data) {
      buffer += data;
    }).on('end', function() {
      if (res.statusCode === 200) {
        return deferred.resolve({ 'statusCode': res.statusCode, 'statusMessage': res.statusMessage, 'contentType': res.headers['content-type'], 'data': buffer });
      }
      
      if ([301, 302].indexOf(res.statusCode) > -1) {
        return downloadFile(res.headers.location)
          .then(function (result) { deferred.resolve(result); })
          .catch(function (err) { deferred.reject(err); });
      }
      
      return deferred.reject(new Error('Error downloading \'' + inputUri + '\'. Response was \'' + res.statusCode + ' - ' + res.statusMessage + '\'.'));        
    }).on('error', function(err) {
      return deferred.reject(err);
    });
  }).on('error', function (err) {
    return deferred.reject(err);
  });

  return deferred.promise.nodeify(callback);
}

function getPackageInformation (packageName, parentPackagePath) {

  try {
    if (!parentPackagePath) {
      parentPackagePath = path.dirname(utils.getRootPackagePath());
    }

    var modulePath = parentPackagePath;
    
    if (packageName) {
      modulePath = (path.basename(modulePath) === node_modules) ? modulePath : path.join(modulePath, node_modules);
      modulePath = path.join(modulePath, packageName);      
    }
    modulePath = path.join(modulePath, packageJson);

    return require(modulePath);
  }
  catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    
    var next = path.resolve(parentPackagePath, '..');
    if (parentPackagePath !== next) {
      return getPackageInformation(packageName, next);      
    }    
  }
  
  throw new Error('Error retrieving information for module: \'' + (packageName || 'main') + '\'.');
}

function getModuleInformation (dir) {
    
  try {
    if (!dir) {
      dir = utils.getRootPackagePath();
    }

    var info = fs.statSync(dir);
    if (info.isFile()) {
      dir = path.dirname(dir);
    }
    
    var packagePath = path.resolve(path.join(dir, packageJson));
    return require(packagePath);
  }
  catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    
    var next = path.resolve(dir, '..');
    if (dir !== next) {
      return getModuleInformation(next);      
    }    
  }
  
  throw new Error('Error retrieving information for module: \'' + (dir || 'main') + '\'.');
} 

function getNpmPackageInfo (packageName, callback) {
  var deferred = Q.defer();
  http.get('http://registry.npmjs.org/' + packageName + '/latest', function (res) {
    var data = '';
    
    res.on('data', function (chunk) {
      data += chunk;
    });
    
    res.on('end', function () {
      try
      {
        var packageJson = JSON.parse(data);
        if (packageJson.name && packageJson.version) {
          return deferred.resolve(packageJson);          
        }
        
        deferred.reject(new Error('Failed to retrieve information for npm package: \'' + packageName + '\'. npm registry returned: ' + packageJson.error + '-' + packageJson.reason + '.'));
      }
      catch (err) {
        return deferred.reject(new Error('Error parsing version information for npm package: \'' + packageName + '\'. ' + err.message + '.'));
      }
    });
  }).on('error', function (err) {
    deferred.reject(new Error('Error retrieving version information for npm package: \'' + packageName + '\'. ' + err.message + '.'));
  });
  
  return deferred.promise.nodeify(callback);
}

function getGitHubPackageInformation (repositoryUrl, callback) {
  
  var src = url.parse(repositoryUrl);
  if (!src.protocol) {
    return Q.reject(new Error('Repository URL is not a valid URL.')).nodeify(callback);
  }
 
  if (src.protocol === 'git:') {
    src.protocol = 'https:';
  }
  
  if (src.protocol !== 'http:' && src.protocol !== 'https:') {
    return Q.reject(new Error('Source parameter uses an unsupported protocol \'' + src.protocol + '\'.')).nodeify(callback);
  }

  var gitUrl = url.format({
    protocol: src.protocol,
    host: src.host.replace(/^github.com/, 'raw.githubusercontent.com'),
    pathname: src.pathname.replace(/.git$/, '') + 
                  (/\/$/.test(src.pathname) ? '' : '/') + 
                  'master/package.json' 
  });   
  
  return downloadFile(gitUrl).then(function (response) {
    return JSON.parse(response.data);
  })
  .catch(function (err) {
    return Q.reject(new CustomError('Failed to retrieve the package information from GitHub.', err));
  });
}

function getNpmPackageLatestVersion (packageName, callback) {
  return getNpmPackageInfo(packageName).then(function (packageJson) {
    return packageJson.version;
  })
  .nodeify(callback);
}

function checkForUpdate (callback) {
  
  var mainModule = getPackageInformation();
  return getNpmPackageLatestVersion(mainModule.name).then(function (latestVersion) {
    var updateVersion = semver.lt(mainModule.version, latestVersion) ? latestVersion : undefined;
    return Q.resolve(updateVersion);
  })
  .nodeify(callback);
}

function installPackage (packageName, source, callback) {

  log.info('Installing new module: ' + packageName);

  var npm = (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  var appRoot = path.dirname(utils.getRootPackagePath());
  return exec(npm, ['install', source], { cwd: appRoot, statusMessage: 'Installing package ' }).then(function () {
    var module = require(packageName);
    return Q.resolve(module);
  })
  .catch(function (err) {
    return Q.reject(new CustomError('Failed to install module: \'' + packageName + '\'.', err));
  })
  .nodeify(callback);
}

// Returns a promise that is fulfilled when the requested package is installed.
//
// Queued installation is recommended when installing multiple packages. This builds a queue of packages to install and then 
// launches a single npm instance to install all of them in a single operation. Launching multiple npm instances in parallel 
// sometimes runs into issues if an npm instance detects that some dependencies are missing because they are still being installed 
// by a different instance (npm WARN unmet dependency ...)
function queuePackageInstallation (packageName, source, callback) {

  installQueue.push({ packageName: packageName, source: source });
  if (!installTask) {
    installTask = Q.defer();
  }
  
  return installTask.promise.nodeify(callback);
}

function installQueuedPackages () {

  if (installQueue.length === 0) {
    return;
  }

  var moduleList = installQueue.reduce(function (previous, current) { return previous + (previous ? ', ' : '') + current.packageName; }, '');

  log.info('Installing the following module(s): \'' + moduleList + '\'...');

  var npm = (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  var appRoot = path.dirname(utils.getRootPackagePath());

  var sources = installQueue.map(function (item) { 
    return item.source;
  });
  
  return exec(npm, ['install'].concat(sources), { cwd: appRoot, statusMessage: 'Installing packages '  }).then(function () {
    installTask.resolve(installQueue);
  })
  .catch(function (err) {
    return installTask.reject(new CustomError('Failed to install the following module(s): \'' + moduleList + '\'.', err));
  })
  .finally(function () {
    installTask = undefined;
    installQueue = [];      
  });
}

module.exports = {
  getPackageInformation: getPackageInformation,
  getModuleInformation: getModuleInformation,
  getGitHubPackageInformation: getGitHubPackageInformation,
  getNpmPackageInfo: getNpmPackageInfo,
  getNpmPackageLatestVersion: getNpmPackageLatestVersion,
  checkForUpdate: checkForUpdate,
  installPackage: installPackage,
  queuePackageInstallation: queuePackageInstallation,
  installQueuedPackages: installQueuedPackages
};
