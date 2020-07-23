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

function existsFile(source) {
  return stat(source).then(function(info) {
    return info.isDirectory() ? false : true;
  }).catch(function() {
    return false;
  });
}

function readFolder(dir, callback) {
    return Q.Promise(function (resolve, reject) {
      //Read folders
      fs.readdir(dir, function (err, files) {
        if (err) { return reject(err); }

        resolve(files);
      });
    }).nodeify(callback);
}

function copyFolder (source, target, options, callback) {
  if (arguments.length === 3) {
    if (utils.isFunction(options)) {
      callback = options;
      options = {};
    }
  }

  return Q.nfcall(ncp, source, target, options || {}).catch(function (err) {
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
  var fullPath = path.resolve(filePath);
  var rootPath = path.parse(fullPath).root;

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

// uses the folderScanSync to grab absolute paths of all files and folders, deleting folders (deepest first) and moving files to the target
// requires an absolute path for sourcePath and targetFolderPath.
function flattenFolderStructureSync(sourcePath, targetFolderPath, callback) {
  return Q.resolve().then(function () {
    var output = folderScanSync(sourcePath);

    // move/copy files
    output.files.forEach(file => {
      fs.renameSync(file, path.resolve(targetFolderPath, path.parse(file).base), (err) => {
        return callback(err);
      });
    });

    // remove directories
    output.folders.forEach(folder => {
      fs.rmdirSync(folder, (err) => {
        callback(err);
      });
    });

    return Q.resolve();
  }).nodeify(callback);
}

// queues new entries into the unexplored paths, and iterates through it, execution stops when all reaches end.
// output is an object: { files: [], folders: [] }, the order of the files and object is reversed of traversal order
function folderScanSync(directory) {
  const unexplored = [directory];
  const folders = [];
  const files = [];

  for (let i = 0; i < unexplored.length; i++) {
    const currentPath = unexplored[i];
    fs.readdirSync(currentPath)
      .forEach(function (fileEntry) {
        var fileEntryPath = path.join(currentPath, fileEntry);

        if (fs.statSync(fileEntryPath).isDirectory()) {
          unexplored.push(fileEntryPath);
          folders.push(fileEntryPath);
        } else {
          files.push(fileEntryPath);
        }
    });
  }

  return {
    folders: folders.reverse(),
    files: files.reverse()
  };
}

// Copies the 'source' file to 'target' if it's missing after creating the
// required directory structure.
function syncFile (source, target, callback) {

  return stat(target).then(function (info) {
    if (info.isDirectory()) {
      return Q.reject(new Error('Cannot synchronize file \'' + source + '\'. There is already a directory in the target with the same name.'));
    }

    return;
  })
  .catch(function (err) {
    if (err.code !== 'ENOENT') {
      return Q.reject(err);
    }

    var targetDir = path.dirname(target);
    return stat(targetDir).catch(function (err) {
      if (err.code !== 'ENOENT') {
        return Q.reject(err);
      }

      return mkdirp(targetDir).then(function () {
        log.debug('Created target directory at \'' + targetDir + '\'.');
      })
      .catch(function (err) {
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

  return Q.nfcall(fs.readdir, source).then(function (files) {

    var tasks = files.map(function (fileOrDir) {
      var sourceFile = path.join(source, fileOrDir);
      return stat(sourceFile).then(function (info) {

        if (info.isDirectory()) {
          return syncFiles(sourceFile, path.join(target, fileOrDir), options);
        }

        if (options.filter) {
          var check = options.filter(fileOrDir);
          if (check === false) {
            return;
          }
        }

        var targetFile = path.join(target, fileOrDir);
        return syncFile(sourceFile, targetFile);
      });
    });

    return Q.all(tasks).then(function (values) {

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

    var sourceFile = path.basename(source);
    var targetFile = path.basename(target);

    if (sourceFile !== targetFile) {
      target = path.join(target, sourceFile);
    }

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
  syncFiles: syncFiles,
  flattenFolderStructure: flattenFolderStructureSync,
  folderScanSync: folderScanSync
};
