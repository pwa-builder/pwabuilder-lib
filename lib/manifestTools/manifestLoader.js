'use strict';

var fs = require('fs'),
    url = require('url');

var AdmZip = require('adm-zip'),
    cheerio = require('cheerio'),
    request = require('request'),
    path = require('path'),
    Q = require('q'),
    _url = require('url');

var constants = require('../constants'),
    fileTools = require('../fileTools'),
    manifestConverter = require('./manifestConverter'),
    manifestTypeDetector = require('./manifestTypeDetector'),
    log = require('../log'),
    utils = require('../utils');

var manifestCreator = require('./manifestCreator');

// Request settings taken from https://github.com/InternetExplorer/modern.IE-static-code-scan/blob/master/app.js
var request = request.defaults({
  followAllRedirects: true,
  encoding: null,
  gzip: true,
  jar: false,
  headers: {
    'Accept': 'text/html, application/xhtml+xml, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'User-Agent': 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; WOW64; Trident/6.0)'
  }
});

function listAvailableManifestFormats() {
  return [constants.BASE_MANIFEST_FORMAT, constants.CHROME_MANIFEST_FORMAT, constants.EDGE_EXTENSION_MANIFEST_FORMAT];
}

function fetchManifestUrlFromSite (siteUrl, callback) {
  var deferred = Q.defer();
  request({ uri: siteUrl }, function (err, response, body) {
    if (err || response.statusCode !== 200) {
      return deferred.reject(new Error('Failed to retrieve manifest from site.'));
    }

    var $ = cheerio.load(body);
    var manifestUrl = $('link[rel~="manifest"]').attr('href');
    if (manifestUrl) {
      var parsedManifestUrl = url.parse(manifestUrl);
      if (!parsedManifestUrl.host) {
        manifestUrl = url.resolve(siteUrl, parsedManifestUrl.pathname);
      }
    }

    return deferred.resolve(manifestUrl);
  });

  return deferred.promise.nodeify(callback);
}

function processManifestContents (data, manifestFormat, callback) {
  var manifestObj = utils.parseJSON(data);

  if (!manifestObj) {
    return callback(new Error('Invalid manifest format.'));
  }

  var detectedFormat = manifestTypeDetector.detect(manifestObj);

  if (manifestFormat) {
    log.warn('Forcing to format ' + manifestFormat + '...');
    detectedFormat = manifestFormat;
  } else if (!detectedFormat) {
      detectedFormat = 'w3c';
   // var availableFormats = listAvailableManifestFormats().join(', ');
    //return callback(new Error('Unable to detect the input manifest format. Try specifying the correct format using the -f <format> option. Available formats are: ' + availableFormats + '.'));
  }

  log.info('Found a ' + detectedFormat + ' manifest...');

  var manifestInfo = {
    content: manifestObj,
    format: detectedFormat
  };

  if (detectedFormat !== constants.CHROME_MANIFEST_FORMAT) {
    return callback(null, manifestInfo);
  }

  // If the detected format is ChromeOS, convert it to W3C Manifest format.
  log.info('Converting the Chrome OS manifest to W3C format...');

  manifestConverter.convertTo(manifestInfo, function (err, w3cManifest) {
    // Assuming conversion was successful, running the manifest JSON through the detector again will return the W3C format type.
    detectedFormat = manifestTypeDetector.detect(w3cManifest.content);
    if (detectedFormat === constants.BASE_MANIFEST_FORMAT) {
      log.info('Conversion to W3C Manifest format successful.');
    }

    return callback(null, {
      content: w3cManifest.content,
      format: detectedFormat
    });
  });
}

function downloadManifestFromUrl (manifestUrl, manifestFormat, callback) {
  if (arguments.length < 3) {
    if (utils.isFunction(manifestFormat)) {
      callback = manifestFormat;
      manifestFormat = undefined;
    }
  }

  var deferred = Q.defer();
  request({ uri: manifestUrl }, function (err, response, data) {
    if (err || response.statusCode !== 200) {
      return deferred.reject(new Error('Failed to download manifest data.'));
    }

    Q.nfcall(processManifestContents, data, manifestFormat).then(function (manifestInfo) {
      if (manifestInfo) {
        manifestInfo.generatedUrl = manifestUrl;
      }

      return deferred.resolve(manifestInfo);
    })
    .catch(function (err) {
      return deferred.reject(err);
    });
  });

  return deferred.promise.nodeify(callback);
}

function getManifestFromSite (siteUrl, manifestFormat, callback) {
  if (arguments.length < 3) {
    if (utils.isFunction(manifestFormat)) {
      callback = manifestFormat;
      manifestFormat = undefined;
    }
  }

  return fetchManifestUrlFromSite(siteUrl).then(function (manifestUrl) {
    if (manifestUrl) {
      return Q.nfcall(downloadManifestFromUrl, manifestUrl, manifestFormat);
    } else {
      log.warn('No manifest found. A new manifest will be created.');

      return Q.nfcall(manifestCreator, { url: siteUrl })
        .then(function(manifest) {
            var manifestObj = {
              content: manifest,
              format: constants.BASE_MANIFEST_FORMAT,
              generated:true
            };

            return manifestObj;
        })
        .catch(function (err) {
          log.warn('An error ocurred while creating manifest - ' + err);

          var manifestObj = {
            content: {
              'start_url': _url.parse(siteUrl).path,
              'short_name': utils.getDefaultShortName(siteUrl)
            },
            format: constants.BASE_MANIFEST_FORMAT,
            generated:true
          };

          return manifestObj;
        });
    }
  })
  .nodeify(callback);
}

function getManifestFromFile (filePath, manifestFormat, callback) {
  if (arguments.length < 3) {
    if (utils.isFunction(manifestFormat)) {
      callback = manifestFormat;
      manifestFormat = undefined;
    }
  }

  return Q.nfcall(fs.readFile, filePath).then(function (data) {
    return Q.nfcall(processManifestContents, data, manifestFormat);
  })
  .nodeify(callback);
}

/**
* Calls the image generation service to generate missing images and update manifest accordingly
*
* Arguments
*   image - binary buffer with image data
*   manifest - the w3c manifest that should be updated
*   options.contentType - custom MIME type for image, otherwise will use default defined at constants
*   options.generationSvcUrl - endpoint for the image service, otherwise will use default defined at constants
*   options.outputFolder - to download files to local folder, otherwise will use data uri
*   options.padding - padding for generated images, otherwise will use 0
*   options.platforms - platforms to generate images for, otherwise will use default defined at constants
*   options.rootFolder - when download files to local folder (this indicates the root for relative paths), otherwise full paths are used
*
* Returns the manifest updated (and writes images at local folder if options.outputFolder is available)
*/
function generateImagesForManifest(image, manifest, options, callback) {
  if (!options) { options = { }; }

  var formData = {
    padding: options.padding || 0,
    platform: options.platforms || constants.IMG_GEN_IN_PLATFORM,
    image: {
      value:  image,
      options: {
        contentType: options.contentType || constants.IMG_GEN_IN_MIMETYPE,
        filename: 'image'
      }
    }
  };

  var imgGenerationSvc = options.generationSvcUrl || constants.IMG_GEN_SVC_URL;
  log.debug('Generating images from app image generation service: ' + imgGenerationSvc);
  return Q.nfcall(request.post, { url: _url.resolve(imgGenerationSvc, constants.IMG_GEN_SVC_API), formData: formData })
    .then(function(response) {
    if (!response || response.length < 0) {
      return new Error('No incoming message available from response');
    }

    var incomingMessage = response[0];

    if (incomingMessage.statusCode !== 201) {
      return new Error(incomingMessage.statusCode + ' - ' + incomingMessage.statusMessage);
    }

    return JSON.parse(incomingMessage.body);
  }).then(function(generatedInfo) {
    var generatedImagesUri = _url.resolve(imgGenerationSvc, generatedInfo.Uri);
    log.debug('Getting generated images from: ' + generatedImagesUri);

    return Q.nfcall(request.get, { url: generatedImagesUri }).then(function(response) {
      if (!response || response.length < 0) {
        return new Error('No incoming message available from response');
      }

      var incomingMessage = response[0];

      if (incomingMessage.statusCode !== 200) {
          return new Error(incomingMessage.statusCode + ' - ' + incomingMessage.statusMessage);
      }

      return incomingMessage.body;
    });
  }).then(function(zipBuffer) {
    log.debug('Generated images ZIP size: ' + zipBuffer.length);

    var iconsEntry;
    var zip = new AdmZip(zipBuffer);
    zip.getEntries().forEach(function(zipEntry) {
      if (!iconsEntry && zipEntry.name === constants.IMG_GEN_OUT_ICONSINFO) {
        iconsEntry = zipEntry;
      }
    });

    return { zip: zip, iconsEntry: iconsEntry };
  }).then(function(zipData) {
    var deferred = Q.defer();

    zipData.iconsEntry.getDataAsync(function(data) {
      var iconsInfo = JSON.parse(data).icons;

      if (!manifest.icons) {
        manifest.icons = iconsInfo;
      } else {
        iconsInfo.forEach(function(iconInfo) {
          var found = false;

          manifest.icons.forEach(function(manifestIconInfo) {
            found = found || manifestIconInfo.sizes === iconInfo.sizes;
          });

          if (!found) {
            log.debug('Adding missing icon: ' + iconInfo.sizes);

            // adding known MIME type returned from generation service
            iconInfo.type = constants.IMG_GEN_OUT_MIMETYPE;
            manifest.icons.push(iconInfo);
          }
        });
      }

      return deferred.resolve(zipData);
    });

    return deferred.promise;
  }).then(function(zipData) {
    log.debug('Iterating icons from manifest: ' + manifest.icons.length);

    return Q.allSettled(zipData.zip.getEntries().map(function(zipEntry) {
      var deferred = Q.defer();

      manifest.icons.forEach(function(icon) {
        if (icon.src !== zipEntry.entryName) {
          return deferred.resolve();
        }

        zipEntry.getDataAsync(function(data) {
          if (options.outputFolder) {
            var outputFilename = path.resolve(options.outputFolder, icon.src);
            fileTools.mkdirp(path.dirname(outputFilename), function(err) {
              if (err) { return deferred.reject(err); }

              fs.writeFile(outputFilename, data, function(err) {
                if (err) { return deferred.reject(err); }

                icon.src = _url.parse(options.rootFolder ?
                  outputFilename.replace(options.rootFolder, '') :
                  outputFilename).path;

                return deferred.resolve();
              });
            });
          } else {
            icon.fileName = icon.src;
            icon.src = constants.IMG_GEN_OUT_DATAURI + data.toString('base64');

            return deferred.resolve();
          }
        });
      });

      return deferred.promise;
    }));
  }).then(function() {
    return manifest;
  }).nodeify(callback);
}

function writeToFile (manifestInfo, filePath, callback) {
  if (manifestInfo && manifestInfo.content) {
    var jsonString = JSON.stringify(manifestInfo.content, undefined, 4);
    return Q.nfcall(fs.writeFile, filePath, jsonString).nodeify(callback);
  }

  return Q.reject(new Error('Manifest content is empty or invalid.')).nodeify(callback);
}

module.exports = {
  getManifestFromSite: getManifestFromSite,
  getManifestFromFile: getManifestFromFile,
  writeToFile: writeToFile,
  fetchManifestUrlFromSite: fetchManifestUrlFromSite,
  downloadManifestFromUrl: downloadManifestFromUrl,
  listAvailableManifestFormats: listAvailableManifestFormats,
  generateImagesForManifest: generateImagesForManifest
};
