'use strict';

var fs = require('fs'),
    path = require('path'),
    Q = require('q');

function getDownloadURL(ids, callback) {
  var results = [];
  //var pendingFiles = [];
  
  var serviceWorkerIDs = ids.split(',');

  serviceWorkerIDs.forEach(function (id) {
    // var fileTask = Q.defer();
    // pendingFiles.push(fileTask);

    var relativeDir = "../assets/serviceworkers/ServiceWorker" + id;

    var dir = path.resolve(__dirname, relativeDir);
    results.push(dir);
    //console.log("Going to read directory " + dir);

    // listFiles(dir, function(files) {
    //   files.forEach(function(file) {
    //     var filePath = path.join(__dirname, relativeDir, file);
    //     results.push(filePath);
    //   });

    //   fileTask.resolve();
    // });
  });

  return Q.resolve(results).nodeify(callback);
  // return Q.allSettled(pendingFiles)
  //         .thenResolve(results)
  //         .nodeify(callback);
};

// function listFiles(directory, callback) {  
//   fs.readdir(directory, function (err, files) {
//     if (err) {
//       return callback(err);
//     }

//     callback(files);
//   });
// }

module.exports = {
  getDownloadURL: getDownloadURL,
};