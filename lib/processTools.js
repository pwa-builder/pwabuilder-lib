'use strict';

var child_process = require('child_process'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q');

var log = require('./log'),
    ProgressIndicator = require('./progress');

var progress = new ProgressIndicator();  

var node_modules = 'node_modules';

function writeOutput(text, bufferedOutput, source, title) {

  var lines = ("" + title + bufferedOutput + text).split(/\r?\n/);
  bufferedOutput = lines.pop();    
  
  lines.forEach(function (line) {
    log.debug(line, source);
  });
  
  return bufferedOutput;
}

function exec (command, args, options, callback) {
  
  var deferred = Q.defer();
  
  var stdout = '';
  var stderr = '';
  var bufferedStdout  = '';
  var bufferedStderr  = '';
  
  if (arguments.length === 2) {
    if (Array.isArray(args)) {
      options = {};
    } else {
      options = args;
      args = [];
    }
  }

  var title = 'Launching external process: \'' + command + ' ' + args.join(' ') + '\'\n';
  var childProcess = child_process.spawn(command, args, options);

  if (!options.suppressOutput) {
    progress.start(options.statusMessage);
  }  
  
  var source = 'pid:' + childProcess.pid;

  childProcess.stdout.on('data', function (data) {      
    var text = data.toString();
    stdout += text;
        
    if (!options.suppressOutput) {
      progress.reset();
      bufferedStdout = writeOutput(text, bufferedStdout, source, title);
      title = '';
      progress.start(options.statusMessage);
    }    
  });

  childProcess.stderr.on('data', function (data) {
    var text = data.toString();
    stderr += text;
    
    if (!options.suppressOutput) {
      progress.reset();
      bufferedStderr = writeOutput(text, bufferedStderr, source, title);
      title = '';
      progress.start(options.statusMessage);
    }
  });
  
  childProcess.on('error', function (err) {
    return deferred.reject(err);
  });
    
  childProcess.on('exit', function (code) {
    if (bufferedStdout) {
      writeOutput(bufferedStdout);
    }
    
    if (bufferedStderr) {
      writeOutput(bufferedStderr);
    }
    
    var result = { 'code': code, 'stdout': stdout, 'stderr': stderr };
    
    if (code !== 0) {
      var err = new Error('External process [process ID: ' + childProcess.pid + '] completed with errors. ' + stderr.replace(/\n*$/, ''));
      for (var attrname in result) { err[attrname] = result[attrname]; }
      return deferred.reject(err);
    }
    
    deferred.resolve(result);
  });
  
  return deferred.promise.finally(function () {
    if (!options.suppressOutput) {
      progress.reset();
    }
  })
  .nodeify(callback);
}

function getCommandPath(currentPath, command) {
  if (!currentPath) {
    return undefined;
  }
  
  var testPath = path.join(currentPath, node_modules, '.bin', command);
  return Q.nfcall(fs.stat, testPath).then(function (fileInfo) {
    if (fileInfo.isFile()) {
      return Q.resolve(testPath);
    }
  }).catch(function (err) {
    if (err.code !== 'ENOENT') {
      return Q.reject(err);
    }
    
    currentPath = currentPath.substring(0, currentPath.lastIndexOf(path.sep)); 
    if (currentPath.indexOf(node_modules) >= 0) {
      if (currentPath.substr(currentPath.length - node_modules.length) === node_modules) {
        currentPath = currentPath.substring(0, currentPath.length - node_modules.length);
      }      
    }
    
    return getCommandPath(currentPath, command);    
  });  
}

module.exports = {
  exec: exec,
  getCommandPath: getCommandPath
};
