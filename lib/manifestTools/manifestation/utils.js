'use strict';

var StripCombiningMarks = require('strip-combining-marks');
var Punycode = require('punycode');

var toArrayBuffer = function(buffer) {

  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
};

var toBuffer = function(ab) {

  var buffer = new Buffer(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i];
  }
  return buffer;
};


var realLength = function(str) { return Punycode.ucs2.decode(StripCombiningMarks(str)).length; }

module.exports = {
  realLength: realLength,
  toBuffer: toBuffer,
  toArrayBuffer: toArrayBuffer
};
