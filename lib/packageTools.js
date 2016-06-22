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
    log = require('./log');
    
var node_modules = 'node_modules';
var packageJson = 'package.json';

var installTask;
var installQueue = [];

// downloads a file
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
      
      // If status is Moved Permanently or Found, redirect to new URL
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

// returns package information (package.json) given a package name 
function getPackageInformation (packageName, parentPackagePath) {

  try {
    if (!parentPackagePath) {
      parentPackagePath = path.dirname(require.main.filename);
    }

    var modulePath = parentPackagePath;
    
    if (packageName) {
    modulePath = modulePath.endsWith(node_modules) ? modulePath : path.join(modulePath, node_modules);
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

// returns package information (package.json) given a file or directory 
function getModuleInformation (dir) {
    
  try {
    if (!dir) {
      dir = require.main.filename;
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

// get package information from the npm registry
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

// get package information from a GitHub repository
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

// get the latest version for an npm package
function getNpmPackageLatestVersion (packageName, callback) {
  return getNpmPackageInfo(packageName).then(function (packageJson) {
    return packageJson.version;
  })
  .nodeify(callback);
}

// checks for updates to the application
function checkForUpdate (callback) {
  
  var mainModule = getPackageInformation();
  return getNpmPackageLatestVersion(mainModule.name).then(function (latestVersion) {
    var updateVersion = semver.lt(mainModule.version, latestVersion) ? latestVersion : undefined;
    return Q.resolve(updateVersion);
  })
  .nodeify(callback);
}

// installs an npm package
function installPackage (packageName, source, callback) {

  log.info('Installing new module: ' + packageName);

  // npm command in Windows is a batch file and needs to include extension to be resolved by spawn call
  var npm = (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  var appRoot = path.dirname(require.main.filename);
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

// Triggers the installation of all queued npm packages.
function installQueuedPackages () {

  if (installQueue.length === 0) {
    return;
  }

  var moduleList = installQueue.reduce(function (previous, current) { return previous + (previous ? ', ' : '') + current.packageName; }, '');

  log.info('Installing the following module(s): \'' + moduleList + '\'...');

  // npm command in Windows is a batch file and needs to include extension to be resolved by spawn call
  var npm = (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  var appRoot = path.dirname(require.main.filename);

  // build package list                    
  var sources = installQueue.map(function (item) { 
    return item.source;
  });
  
  // launch npm  
  return exec(npm, ['install'].concat(sources), { cwd: appRoot, statusMessage: 'Installing packages '  }).then(function () {
    // signal completion
    installTask.resolve(installQueue);
  })
  .catch(function (err) {
    return installTask.reject(new CustomError('Failed to install the following module(s): \'' + moduleList + '\'.', err));
  })
  .finally(function () {
    // clear queue
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
