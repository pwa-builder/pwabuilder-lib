'use strict';

var ansi = require('ansi'); 

var style = {
  compact: 0,
  bar: 1
};

var compactText = '\u2014\\|/';

function ProgressIndicator (message, options, updateFrequency, stream) {  

  function fillChars (char, length) {
    return Array.apply(null, new Array(length)).map(function () {
      return char;
    }).join('');
  }
   
  function renderBar (value) {
    var len = value % width;
    if (len === 0) {
      decrement = !decrement;
    }
    
    if (decrement) {
      len = Math.abs(len - width + 1);      
    }
    return '[' + fillChars('▓', len) + fillChars('░', width - len - 1) + ']';
  }

  function renderCompact (value) {
    return '(' + compactText[value] + ')';
  }

  var self = this;
    
  var cursor, width, render, timer;
  
  message = message || '';    
  stream = stream || process.stdout;
  options = options || {};
  switch (options.style || style.compact) {
    case style.compact:
      width = compactText.length;
      render = renderCompact;
      break;
    case style.bar:
      width = options.width || 20;
      render = renderBar;
      break;
  }
  
  var decrement = true;
  var index = 0;  
  
  if (stream.isTTY) {
    cursor = ansi(stream);
  }

  process.on('beforeExit', function () {
    self.reset();
  });

  self.update = function update () {
    if (cursor) {
      // savePosition & restorePosition do not seem to work in Mac OS X
      // replaced with horizontalAbsolute
      cursor //.savePosition()
            .write(message + render(index))
            // .restorePosition()
            .horizontalAbsolute(0)
            .reset();      
    }
  };
  
  self.start = function start (msg) {
    self.reset();
    
    if (msg) {
      message = msg;
    }
    
    if (cursor) {
      cursor.hide();
      self.update();
      timer = setInterval(function () {
        index = ++index % width;
        self.update();
      }, options.updateFrequency || 100);
      timer.unref();
    }    
  };
  
  self.reset = function reset () {
    if (timer) {
      clearInterval(timer);
      timer = null;      
    }
    
    if (cursor) {
      cursor.eraseLine();
      cursor.reset();
      cursor.show();
    }
    
    index = 0;
  };
}

ProgressIndicator.style = style;

module.exports = ProgressIndicator;
