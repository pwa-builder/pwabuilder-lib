'use strict';

var extractOne = require('./extract-one');
var imageData = require('./image-data');

var Q = require('q');

var range = function(n) { 
  var array = new Array(n);
  for (var i = 0; i < n; i++) {
    array[i] = 0;
  }

  return array.map(function(x, i) { return i; });
};

/**
* @class ICO
*/

/**
 * Generate the hexadecimal value from an arrayBuffer.
 * @memberof ICO
 * @param {ArrayBuffer} buffer The ArrayBuffer object contain the TypedArray of a ICO file.
 * @returns {String} The hexadecimal value.
 */
function buf2hex(buffer) { // buffer is an ArrayBuffer
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

/**
 * Creates a PNG image object using the createIcon method.
 * @memberof ICO
 * @param {Int} index The image index.
 * @param {ArrayBuffer} buffer The ArrayBuffer object contain the TypedArray of a ICO file.
 * @returns {Object} PNG icon object.
 */

function createPng(index, buffer) {
  var dv = new DataView(buffer);

  var icoWidth = dv.getUint8(6 + (index * 16)) || 256;
  var icoHeight = dv.getUint8(7 + (index * 16)) || 256;
  var icoOffset = dv.getUint32(18 + (index * 16), true);
  var icoBit = dv.getUint8((icoOffset + 16) + 8, true);
  var endImage = (buf2hex(buffer.slice(icoOffset, buffer.byteLength))).indexOf('49454e44');
  var imgBuffer = buffer.slice(icoOffset, icoOffset + endImage);
  
  return createIcon(icoBit, icoWidth, icoHeight, imgBuffer);
}

/**
 * Validates if the image is PNG.
 * @memberof ICO
 * @param {Int} index The image index.
 * @param {ArrayBuffer} buffer The ArrayBuffer object contain the TypedArray of a ICO file.
 * @returns {Boolean} True if the image is PNG.
 */

function isPNG(index, buffer) {
  var icoDv = new DataView(buffer);
  var startImage = icoDv.getUint32(18 + (index * 16), true);
  var bufferSlice = buf2hex(buffer.slice(startImage, startImage + 4));
  return (bufferSlice === '89504e47');
}


/**
 * Creates an image object.
 * @memberof ICO
 * @param {Int} bit The image bit depth.
 * @param {Int} width The image width.
 * @param {Int} height The image height.
 * @param {ArrayBuffer} buffer The ArrayBuffer object contain the TypedArray of a ICO file.
 * @returns {Object} An icon object.
 */
function createIcon(bit, width, height, buffer) {
  return {
    bit:  bit,
    width: width,
    height: height,
    buffer: buffer
  };
}

var factory = function(config) {
  var previousICO = global.ICO;
  var Image = config.Image;

  var ICO = {
    /**
     * Parse ICO and return some PNGs.
     * @memberof ICO
     * @param {ArrayBuffer} buffer The ArrayBuffer object contain the TypedArray of a ICO file.
     * @param {String} mime Mime type for output.
     * @returns {Promise<Object[]>} Resolves to array of parsed ICO.
     *   * `width` **Number** - Image width.
     *   * `height` **Number** - Image height.
     *   * `bit` **Number** - Image bit depth.
     *   * `buffer` **ArrayBuffer** - Image buffer.
     */
    parse: function(buffer, mime) {

      var icoDv = new DataView(buffer);
      if (icoDv.getUint16(0, true) !== 0 || icoDv.getUint16(2, true) !== 1) {
        var deferred = Q.defer();
        return deferred.reject(new Error('buffer is not ico'));
      }
      
      return Q.all(range(icoDv.getUint16(4, true))
              .map(function(i) {
                
                if(isPNG(i,buffer)){
                  var deferred = Q.defer();
                  deferred.resolve(createPng(i,buffer));
                  return deferred.promise;
                } else {
                  var ico = extractOne(buffer, i);
                  var image = {
                    width: ico.width,
                    height: ico.height
                  };
                  
                  switch (ico.bit) { // eslint-disable-line default-case
                    case 1:
                    image.data = imageData.from1bit(ico);
                    break;
                    case 4:
                    image.data = imageData.from4bit(ico);
                    break;
                    case 8:
                    image.data = imageData.from8bit(ico);
                    break;
                    case 24:
                    image.data = imageData.from24bit(ico);
                    break;
                    case 32:
                    image.data = imageData.from32bit(ico);
                    break;
                  }
                  
                  return Image.encode(image, mime).then(function(pngBuffer) {
                    return createIcon(ico.bit, ico.width, ico.height, pngBuffer);
                  });
                }
      }));
    },
    /**
     * Check the ArrayBuffer is valid ICO.
     * @memberof ICO
     * @param {ArrayBuffer} buffer The ArrayBuffer object contain the TypedArray of a ICO file.
     * @returns {Boolean} True if arg is ICO.
     */
    isICO: function(buffer) {
      if (!(buffer instanceof ArrayBuffer)) {
        return false;
      }
      var icoDv = new DataView(buffer);
      return icoDv.getUint16(0, true) === 0 && icoDv.getUint16(2, true) === 1;
    },
    /**
     * No conflict.
     * @memberof ICO
     * @returns {ICO} `ICO` Object.
     */
    noConflict: function () {
      global.ICO = previousICO;
      return this;
    }
  };

  return ICO;
};

module.exports = factory;
