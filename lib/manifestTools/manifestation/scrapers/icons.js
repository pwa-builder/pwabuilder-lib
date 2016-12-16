'use strict';

var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var imgSize = require('image-size');
var imgType = require('image-type');
var mimeLookUp = require('mime-types').lookup;
var fileType = require('file-type');
var _flatten = require('lodash/flattenDeep');
var _filter = require('lodash/filter');
var _url = require('url');

var icoJs = require('./icojs');

var util = require('../utils');

var isIco = function(url) {

  return url.match(/\.ico$/);
};

var imgInfo = function(url, callback) {

  request.get({ url: url, encoding: null }, function(err, response, imgBuffer) {

    var result;

    if (err || response.statusCode !== 200) {
      callback();

      return console.error(err || new Error('Response code for ' + url + ' was ' + response.statusCode));
    }

    if (imgBuffer && fileType(imgBuffer) !== null) {
      var dimensions = imgSize(imgBuffer);

      result = {
        src: _url.parse(url).href,
        type: imgType(imgBuffer).mime,
        sizes: dimensions.width + 'x' + dimensions.height
      };
    }

    callback(null, result);
  });
};

var icoInfo = function(url, callback) {

  request.get({ url: url, encoding: null }, function(err, response, imgBuffer) {

    if (err || response.statusCode !== 200) {
      callback();

      return console.log(err || new Error('response code for ' + url + ' was ' + response.statusCode));
    }

    var icoBuffer = util.toArrayBuffer(imgBuffer);

    try {
      icoJs.parse(icoBuffer).then(function(imgs) {

        var sizes = imgs.map(function(img) {

          var dim = imgSize(util.toBuffer(img.buffer));
          return dim.width + 'x' + dim.height;
        }).join(' ');

        return callback(null, {
          src: _url.parse(url).path,
          sizes: sizes
        });
      }).catch(function(e) {

        if (e.toString() === 'Error: buffer is not ico') {
          imgInfo(url, callback);
        }
        else {
          callback(e, []);
        }
      });
    }
    catch (e) {
      console.error('cannot get icon from ' + url + ' - error: ' + e);

      // throw e;
            
      callback();
    }
  });
};

var processAppConfig = function(url, callback) {

  request.get({ url: url }, function(err, response, body) {

    if (err) {
      callback(err);
    }

    var $ = cheerio.load(body);
    var appConfigIcons = [
      $('square70x70logo'),
      $('square150x150logo'),
      $('square310x310logo'),
      $('wide310x150logo')
    ];

    appConfigIcons = appConfigIcons
      .filter(function(arr) { return arr.length; })
      .map(function($icon) {

        var src = $icon.attr('src');
        var size = $icon.prop('tagName');
        size = size.toLowerCase().match(/\d+x\d+/)[0];

        return {
          sizes: size,
          src: src,
          type: mimeLookUp(src)
        };
      });

    callback(null, appConfigIcons);
  });
};

var processFavicon = function(url, callback) {

  if (isIco(url)) {
    icoInfo(url, callback);
  }
  else {
    imgInfo(url, callback);
  }
};


var icons = function(obj, iconsCallback) {

  var $ = cheerio.load(obj.html);

  var favicon = $('[rel="shortcut icon"]').attr('href') || '/favicon.ico';
  var msAppConfig = $('[name=msapplication-config]').attr('content') || '/browserconfig.xml';
  var windowsTile = $('[name=msapplication-TileImage]').attr('content');
  var iosIcons = $('[rel=icon], [rel=apple-touch-icon], [rel=apple-touch-icon-precomposed]').map(function(i, elm) {
    return { href: $(elm).attr('href'), sizes: $(elm).attr('sizes') };
  });

  var processIcons = function(icon, cb) {

    var href = icon.href;
    var sizes = icon.sizes;
    var url = _url.resolve(obj.url, href);

    if (icon.sizes) {
      cb(null, {
        src: href,
        sizes: sizes,
        type: mimeLookUp(href)
      });
    }
    else {
      return isIco(url) ? icoInfo(url, cb) : imgInfo(url, cb);
    }
  };

  var toProcess = [{
    type: windowsTile,
    func: imgInfo
  }, {
    type: favicon,
    func: processFavicon
  }, {
    type: msAppConfig,
    func: processAppConfig
  }].filter(function(icon) { return icon.type && icon.type.length; });

  async.parallel([
    function(parallelCb) {
      async.map(toProcess, function(iconType, cb) {

        var url = _url.resolve(obj.url, iconType.type);
        iconType.func(url, cb);
      }, parallelCb);
    },
    function(parallelCb) {
      async.map(iosIcons, processIcons, parallelCb);
    }
  ], function(err, results) {
    iconsCallback(err, _filter(_flatten(results)));
  });
};

module.exports = icons;
