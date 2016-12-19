'use strict';

var Cheerio = require('cheerio');

var background_color = function(obj, callback) {

  var $ = Cheerio.load(obj.html);

  var msTileColor = $('meta[name=msapplication-TileColor]').attr('content');

  var backgroundColor = msTileColor || 'transparent';

  if (callback) {
    callback(null, backgroundColor);
  }

  return backgroundColor;
};

module.exports = background_color;
