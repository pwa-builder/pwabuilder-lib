var PlatformBase = require('../../../lib/platformBase');

function Platform (packageName, platforms) {

  var self = this;
  Object.assign(this, PlatformBase.prototype);
  PlatformBase.apply(this, ['test', 'Test Platform', 'test-platform', __dirname]);

  self.platforms = platforms;
}

module.exports.Platform = Platform;
