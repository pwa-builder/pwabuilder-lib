'use strict';

var isUrl = require('valid-url').is_web_uri;
var _url = require('url');

var scope = function(obj, callback) {

  var url = obj.url;
  var _scope;

  if (url && !isUrl(url)) {
    // if the url exists and is not a valid wbe url (e.g. /foo), then
    // its probably the scope we want to use
    _scope = url;
  }
  else if (isUrl(url)) {
    // if we have a valid url, then its more liekly that we were given the homepage
    // for the app. So the path is the most liekly canidate for the scope
    _scope = _url.parse(url).path;
  }
  else {
    // I can't think of a better default
    _scope = '/';
  }

  if (callback) {
    callback(null, _scope);
  }

  return _scope;
};

module.exports = scope;
