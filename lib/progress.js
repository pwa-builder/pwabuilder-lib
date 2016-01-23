'use strict';

var ansi = require('ansi'); 

var style = {
  compact: 0,
  bar: 1
};

var compactText = '\u2014\\|/';
// var compactText = ' .*°*.';

function ProgressIndicator (message, options, updateFrequency, stream) {  

  var cursor = ansi(stream || process.stdout);
  
  function fillChars (char, length) {
    return Array.apply(null, new Array(length)).map(function () {
      return char;
    }).join('');
  }
   
  function renderBar (value) {
    var len = value % self.width;
    if (len === 0) {
      self.decrement = !self.decrement;
    }
    
    if (self.decrement) {
      len = Math.abs(len - self.width + 1);      
    }
    return '[' + fillChars('▓', len) + fillChars('░', self.width - len - 1) + ']';
  }

  function renderCompact (value) {
    return '(' + compactText[value] + ')';
  }

  var self = this;
    
  self.message = message || '';
  self.options = options || {};
  self.decrement = true;
  self.index = 0;  
  
  switch (self.options.style || style.compact) {
    case style.compact:
      self.width = compactText.length;
      self.render = renderCompact;
      break;
    case style.bar:
      self.width = self.options.width || 20;
      self.render = renderBar;
      break;
  }
    
  self.update = function update () {
    var msg = self.message + self.render(self.index); 
    cursor.savePosition()
          .write(msg)
          .restorePosition()
          .reset();
  };
  
  self.start = function start (message) {
    if (message) {
      self.message = message;
    }
    
    cursor.hide();
    self.update();
    self.timer = setInterval(function () {
      self.index = ++self.index % self.width;
      self.update();
    }, self.options.updateFrequency || 100);
  };
  
  self.reset = function reset () {
    if (self.timer) {
      clearInterval(self.timer);      
    }
    
    cursor.eraseLine();
    cursor.reset();
    cursor.show();
    self.index = 0;
  };
}

ProgressIndicator.style = style;

module.exports = ProgressIndicator;
