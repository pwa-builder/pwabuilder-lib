'use strict';

var fs = require('fs'),
    path = require('path');

var _mkdirp = require('mkdirp'),
    ncp = require('ncp'), 
    Q = require('q');
    
var utils = require('./utils');

function readFile (source, callback) {
  return Q.nfcall(fs.readFile, source, 'utf8')
          .nodeify(callback);
}

function copyFile (source, target, callback) {

  var deferred = Q.defer();

  var rd = fs.createReadStream(source);
  rd.on('error', function (err) {
    deferred.reject(err);
  });

  var wr = fs.createWriteStream(target);
  wr.on('error', function (err) {
    deferred.reject(err);
  });

  wr.on('close', function () {
    deferred.resolve();
  });

  rd.pipe(wr);

  return deferred.promise.nodeify(callback);
}

function copyFolder (source, target, options, callback) {

  if (arguments.length === 3) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};      
    }
  }
  
  return Q.nfcall(ncp, source, target, options || {})
          .catch(function (err) {
            // flatten errors, otherwise it breaks things downstream
            // see https://github.com/AvianFlu/ncp/issues/52
            if (Array.isArray(err)) {
              var msg = err.reduce(function (previous, current) {
                return previous += (previous.length ? '\n' : '') + current.message;
              }, '');
              
              err = new Error(msg);              
            }
            
            return Q.reject(err);
          })
          .nodeify(callback);
}

function replaceFileContent (source, replacementFunc, callback) {
  return Q.nfcall(fs.readFile, source, 'utf8')
    .then(function (data) {
      var result = replacementFunc(data);
      return Q.nfcall(fs.writeFile, source, result, 'utf8');
    })
    .nodeify(callback);
}

function mkdirp (filePath, callback) {
  
  // ensure filePath points to a valid drive
  var fullPath = path.resolve(filePath);
  var rootPath = path.parse(fullPath).root;
  
  // create directory recursively
  return Q.nfcall(fs.stat, rootPath)
    .then(function () {
      return Q.nfcall(_mkdirp, filePath);
    })
    .nodeify(callback);
}

function createShortcut (srcpath, dstpath, callback) {
  return Q.nfcall(fs.symlink, srcpath, dstpath, 'junction')
          .nodeify(callback);
}

function searchFile (dir, fileName, callback) {
  var results = [];
  fs.readdir(dir, function (err, list) {
    if (err) {
      return callback(err);
    }

    var pending = list.length;
    if (!pending) {
      return callback(null, results);
    }

    list.forEach(function (file) {
      file = path.resolve(dir, file);
      fs.stat(file, function (err, stat) {
        if (stat && stat.isDirectory()) {
          searchFile(file, fileName, function (err, res) {
            results = results.concat(res);
            if (!--pending){
              callback(null, results);
            }
          });
        } 
        else {
          if (path.basename(file) === fileName) {
            results.push(file);
          }

          if (!--pending) {
            callback(null, results);
          }
        }
      });
    });
  });
}

module.exports = {
  readFile: readFile,
  copyFile: copyFile,
  copyFolder: copyFolder,
  mkdirp: mkdirp,
  createShortcut: createShortcut,
  replaceFileContent: replaceFileContent,
  searchFile: searchFile
};
