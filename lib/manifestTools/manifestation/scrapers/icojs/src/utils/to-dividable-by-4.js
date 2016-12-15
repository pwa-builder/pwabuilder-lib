'use strict';

/**
 * Make number dividable by 4
 * @access private
 * @param {Number} num number
 * @returns {Number} number dividable by 4
 */
var toDividableBy4 = function(num) {
  var rest = num % 4;
  return num % 4 === 0 ? num : num + 4 - rest;
};

module.exports = toDividableBy4;
