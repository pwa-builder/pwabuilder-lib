'use strict';

var cheerio = require('cheerio');
var isUrl = require('valid-url').is_web_uri;
var _url = require('url');

var start_url = function(opts, callback) {

  var $ = cheerio.load(opts.html);
  var url = opts.url;

  var startUrl = $('link[rel=start]').attr('href');

  if (!startUrl) {
    startUrl = $('[name=msapplication-starturl]').attr('content');
  }

  if (!startUrl) {
    if (url && !isUrl(url)) {
      // if the url exists and is not a valid wbe url (e.g. /foo), then
      // its probably the start_url we want to use
      startUrl = url;
    }
    else if (isUrl(url)) {
      // if we have a valid url, then its more likely that we were given the homepage
      // for the app. So the path is the most likely canidate for the start_url
      startUrl = _url.parse(url).path;
    }
    else {
      // I can't think of a better default
      startUrl = '/';
    }
  }

  if (callback) {
    callback(null, startUrl);
  }

  return startUrl;
};

module.exports = start_url;
