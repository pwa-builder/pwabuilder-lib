'use strict';

var cheerio = require('cheerio');
var langDetect = require('langdetect');

var language = function(obj, callback) {
  var html = obj.html;
  var $ = cheerio.load(html);

  var declaredLang = $('html[lang]').attr('lang');

  if (!declaredLang) {
    declaredLang = $('html[xml\\:lang]').attr('xml:lang');
  }

  if (!declaredLang) {
    declaredLang = $('meta[name="language"]').attr('content');
  }

  if (!declaredLang) {
    declaredLang = $('meta[name="dc.language"]').attr('content');
  }

  // if they declare the lang attr, we assume they know what they are talking about
  if (declaredLang) {
    callback(null, declaredLang);
  }
  else {
    var regex = /<title[^>]*>([^<>]*)<\/title>|<h[^>]*>([^<>]*)<\/h.>|<p[^>]*>([^<>]*)<\/p>|alert\(['"](.+)['"]\)|title=["]([^"]+)["]/g;

    var match, text = '';
    do {
        match = regex.exec(html);
        if (match) {
            text += (match[1] ? match[1] : match[2] ? match[2] : match[3] ? match[3] : match[4] ? match[4] : match[5]) + '\n';
        }
    } while (match);
    
    var langs = langDetect.detect(text);

    if (langs && langs.length > 0) {
      callback(null, langs[0].lang);
    } else {
      // defaulting to english if no language recognized
      callback(null, 'en');  
    }
  }
};

module.exports = language;
