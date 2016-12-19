'use strict';

var request = require('request');
var async = require('async');

function manifestCreator(opts, callback) {

  // we just want to do all of our work off of an HTML string, so if we are
  // given a URL, go and download it, then restart with the result

  if (!opts.html && opts.url) {
    request({
      url: opts.url,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2763.0 Safari/537.36'
      }
    }, function(err, response, body) {
      if (err) { return callback(err); }

      opts.url = response.request.href;

      if (!body.length) {
        callback(new Error('empty body received for ' + opts.url + '. nothing to build from.'));
      }

      try {
        manifestCreator({ url: opts.url, html: body }, callback);
      } catch(err) {
        return callback(err);
      }
    });
  }
  else if (opts.html) {
    // we have the url, and the html - lets do this thing
    var manifest = { };

    var funcs = [
      'Dir',
      'Lang',
      'Name',
      'Icons',
      'Scope',
      'Display',
      'Start_url',
      'Short_name',
      'Theme_color',
      'Description',
      'Orientation',
      'Background_color',
      'Related_applications',
      'Prefer_related_applications'
    ].map(function(name) {
      return function(cb) {
        require('./scrapers/' + name.toLowerCase())(opts, function(e, r) {
          manifest[name.toLowerCase()] = r;
          cb(e, r);
        });
      };

    });

    async.parallel(funcs, function(e) { callback(e, manifest); } );
  }
  else {
    callback(new Error('Need a URL or HTML in order to work'));
  }
}

module.exports = manifestCreator;