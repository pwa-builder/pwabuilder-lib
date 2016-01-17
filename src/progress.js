'use strict';

function ProgressIndicator (message, updateFrequency, stream) {  

  var self = this;
  
  self.indicator = '\u2014\\|/';
  //self.indicator = ' .*°*.';
  
  self.stream = stream || process.stdout;
  self.message = message || '';
  self.updateFrequency = updateFrequency || 100;
  
  self.index = 0;
  
  if (!self.stream.clearLine) {
    self.stream.clearLine = function () { self.stream.write('\b'); }
  }
   
  if (!self.stream.moveCursor) {
    self.stream.moveCursor = function () { }
  } 
  
  self.start = function start () {
    self.stream.write(self.message + '(' + self.indicator[self.index] + ')');
    self.stream.moveCursor(-1);
    self.timer = setInterval(function () {
      self.index = (self.index + 1) % self.indicator.length;
      self.stream.moveCursor(-1);
      self.stream.write(self.indicator[self.index]);
    }, self.updateFrequency);
  }
  
  self.reset = function reset () {
    if (self.timer) {
      clearInterval(self.timer);      
    }
    
    self.stream.moveCursor(-self.message.length - 2);
    self.stream.clearLine(1);
  } 
}

module.exports = ProgressIndicator;