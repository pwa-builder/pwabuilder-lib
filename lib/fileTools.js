'use strict';

var fs = require('fs'),
    path = require('path');

var _mkdirp = require('mkdirp'),
    ncp = require('ncp'), 
    Q = require('q');
    
var log = require('./log'),
    utils = require('./utils');

var stat = Q.nfbind(fs.stat);

function readFile (source, options, callback) {
  return Q.nfcall(fs.readFile, source, options)
          .nodeify(callback);
}

function writeFile (target, data, options, callback) {
  return Q.nfcall(fs.writeFile, target, data, options)
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

function deleteFile(source, callback) {
  return Q.nfcall(fs.unlink, source).nodeify(callback);
}

function existsFile(source, callback) {
  return stat(source).then(function(info) {    
    return info.isDirectory() ? false : true;
  }).catch(function(err) {
    return false;
  })  
}

function readFolder(dir, options, callback) {
  return Q.nfcall(fs.readdir, dir, options).nodeify(callback);
}

function copyFolder (source, target, options, callback) {
  if (arguments.length === 3) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};      
    }
  }
  
  return Q.nfcall(ncp, source, target, options || {}).catch(function (err) {
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
  return Q.nfcall(fs.readFile, source, 'utf8').then(function (data) {
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
  return stat(rootPath).then(function () {
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

// Copies the 'source' file to 'target' if it's missing after creating the  
// required directory structure.
function syncFile (source, target, callback) {
  
  // check target file
  return stat(target).then(function (info) {
    // verify that target is a file and not a directory
    if (info.isDirectory()) {
      return Q.reject(new Error('Cannot synchronize file \'' + source + '\'. There is already a directory in the target with the same name.'));
    }
    
    // skip target if it already exists
    return;
  })
  .catch(function (err) {
    // return failure for anything other than 'not found' 
    if (err.code !== 'ENOENT') {
      return Q.reject(err);
    }

    // copy source to target
    var targetDir = path.dirname(target);
    return stat(targetDir).catch(function (err) {
      // return failure for anything other than 'not found' 
      if (err.code !== 'ENOENT') {
        return Q.reject(err);
      }

      // create target directory            
      return mkdirp(targetDir).then(function () {
        log.debug('Created target directory at \'' + targetDir + '\'.');              
      })
      .catch(function (err) {
        // ignore error if target was already created by a different "thread"
        if (err.code !== 'EEXIST') {
          return Q.reject(err);
        }
      })
      .then(function () {
        return stat(targetDir);
      });
    })
    .then(function () {
      return copyFile(source, target).then(function () {
        log.debug('Copied file \'' + source + '\' to \'' + target + '\'.');
        return target;
      });
    });
  })
  .nodeify(callback);
}

// Copies all missing files and directories in 'source' to 'target'.
// Only checks that a file exists by comparing the file names, not 
// that the contents of the source and target files the same. 
// Returns an array with the list of files that were copied.
//
// NOTE: copyFiles in this module already provides similar functionality,
// but it's based on the 'ncp' package and does not provide the list of
// copied files.
function syncFiles (source, target, options, callback) {
  
  if (arguments.length === 3 && utils.isFunction(options)) {
    callback = options;
    options = {};  
  }
  
  // read the contents of the source directory
  return Q.nfcall(fs.readdir, source).then(function (files) {
  
    // process each file and folder
    var tasks = files.map(function (fileOrDir) {
      var sourceFile = path.join(source, fileOrDir);
      return stat(sourceFile).then(function (info) {
        
        // if fileOrDir is a directory, synchronize it
        if (info.isDirectory()) {
          return syncFiles(sourceFile, path.join(target, fileOrDir), options);
        }
        
        // check to see if file should be skipped 
        if (options.filter) {
          var check = options.filter(fileOrDir);
          if (check === false) {
            return;
          }
        }
        
        // synchronize a single file        
        var targetFile = path.join(target, fileOrDir);
        return syncFile(sourceFile, targetFile);
      });
    });
  
    // wait for all pending tasks to complete
    return Q.all(tasks).then(function (values) {
      
      // build a list of the files that were copied
      return values.reduce(function (list, value) {
        if (value) {
          if (Array.isArray(value)) {
            list.push.apply(list, value);
          }
          else {
            list.push(value);            
          }
        }
        
        return list;
      }, []);
    });
  })
  .catch(function (err) {
    if (err.code !== 'ENOTDIR') {
      return Q.reject(err);
    }
    
    // specified source is a file not a directory
    var sourceFile = path.basename(source);
    var targetFile = path.basename(target);
    
    // build target file path assuming target is a directory
    // unless target already includes the file name
    if (sourceFile !== targetFile) {
      target = path.join(target, sourceFile);
    }
    
    // synchronize the file
    return syncFile(source, target).then(function (file) {
      return file ? [file] : [];
    });
  })
  .nodeify(callback);
}

module.exports = {
  readFile: readFile,
  writeFile: writeFile,
  copyFile: copyFile,
  deleteFile: deleteFile,
  existsFile: existsFile,
  readFolder: readFolder,
  copyFolder: copyFolder,
  mkdirp: mkdirp,
  createShortcut: createShortcut,
  replaceFileContent: replaceFileContent,
  searchFile: searchFile,
  syncFiles: syncFiles
};
