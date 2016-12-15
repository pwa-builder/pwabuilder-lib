'use strict';

var extractOne = require('./extract-one');
var imageData = require('./image-data');

var range = function(n) { 
  // fill() replaced with for ..
  var array = new Array(n);
  for (var i = 0; i < n; i++) {
    array[i] = 0;
  }

  return array.map(function(x, i) { return i });

  // return new Array(n).fill(0).map(function(_, i) { return i }); 
};

/**
* @class ICO
*/

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
        return Promise.reject(new Error('buffer is not ico'));
      }
      // make single image icon
      // let idCount = icoDv.getUint16(4, true);
      var icos = Promise.all(range(icoDv.getUint16(4, true)).map(function(i) {
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
          return {
            bit: ico.bit,
            width: ico.width,
            height: ico.height,
            buffer: pngBuffer
          };
        });
      }));

      return icos;
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
      // idReserved = icoDv.getUint16(0, true)
      // idType = icoDv.getUint16(0, true)
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
