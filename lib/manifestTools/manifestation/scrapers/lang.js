'use strict';

var Cheerio = require('cheerio');
var langDetect = require('langdetect');
var TldExtract = require('tld-extract');

var language = function(obj, callback) {
  var html = obj.html;
  var $ = Cheerio.load(html);

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

    var text = '';
    do {
        var match = regex.exec(html);
        if (match) {
            text += (match[1] ? match[1] : match[2] ? match[2] : match[3] ? match[3] : match[4] ? match[4] : match[5]) + '\n';
        }
    } while (match);
    
    // MK - we use now langdetect to infer language from text
    callback(null, langDetect.detect(text)[0].lang);
  }
};

module.exports = language;
