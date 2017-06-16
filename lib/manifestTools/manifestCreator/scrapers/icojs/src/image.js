'use strict';

var Jimp = require('jimp');
var Q = require('q');

var bufferToArrayBuffer = require('./utils/buffer-to-arraybuffer');

var Image = {
  /**
   * create png from imgData.data
   * @access private
   * @param {Object} image data
   * @param {Number} image.width img width
   * @param {Number} image.height img height
   * @param {Uint8ClampedArray} image.data same as imageData.data
   * @param {String} mime Mime type
   * @returns {ArrayBuffer} png
   */
  encode: function(image, mime) {
    var data = image.data;
    var jimp = new Jimp(image.width, image.height);
    jimp.scan(0, 0, jimp.bitmap.width, jimp.bitmap.height, function scan(x, y, idx) {
      this.bitmap.data[idx + 0] = data[idx + 0]; // eslint-disable-line no-invalid-this
      this.bitmap.data[idx + 1] = data[idx + 1]; // eslint-disable-line no-invalid-this
      this.bitmap.data[idx + 2] = data[idx + 2]; // eslint-disable-line no-invalid-this
      this.bitmap.data[idx + 3] = data[idx + 3]; // eslint-disable-line no-invalid-this
    });

    var deferred = Q.defer();

    jimp.getBuffer(mime || Jimp.MIME_PNG, function(err, buffer) {
      /* istanbul ignore if */
      if (err) { return deferred.reject(err); }
      
      return deferred.resolve(bufferToArrayBuffer(buffer));
    });

    return deferred.promise;
  }
};

module.exports = Image;
