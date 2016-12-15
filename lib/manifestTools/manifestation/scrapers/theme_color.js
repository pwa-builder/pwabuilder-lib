'use strict';

var Cheerio = require('cheerio');

var theme_color = function(obj, callback) {

  var $ = Cheerio.load(obj.html);

  var androidThemeColor = $('meta[name=theme-color]').attr('content');
  // since folks seem to use tilecolor and TileColor, we have toLowerCase to get a case insensitive match
  var msTileColor = $('meta[name]').filter(function(i, e) { return $(e).attr('name').toLowerCase() === 'msapplication-tilecolor' }).attr('content');
  var iosStatusStyling = $('meta[name=apple-mobile-web-app-status-bar-style]').attr('content');

  if (iosStatusStyling && iosStatusStyling === 'black-translucent') {
    iosStatusStyling = 'rgba(0,0,0,0.5)';
  }

  var themeColor = androidThemeColor || iosStatusStyling || msTileColor || 'transparent';

  if (callback) {
    callback(null, themeColor);
  }

  return themeColor;
};

module.exports = theme_color;
