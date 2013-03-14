'use strict';

var domain = require('domain')
  , fs = require('fs');

function Middleware(parent, path) {
  // If called as a function, return a new Middleware.
  if (!(this instanceof Middleware)) {
    return new Middleware(parent, path);
  }
  this.parent = parent;
  this.input = [];
  this.output = [];
}

Middleware.prototype.use = function (mw) {
  if (typeof mw === 'function') { mw = mw.call(null, this.parent); }
  
  if (mw && Array.isArray(mw)) {
    this.input.push({ command: mw[0], handle: mw[1] });
    this.output.push({ command: mw[0], handle: mw[2] });
  }
};

Middleware.prototype.handleOutput = function (data) {
  var index = 0, stack = this.output;

  console.log('Handling output', data, stack);

  function next(err, message) {
    var handler = stack[index++];

    console.log(message);

    if (!handler) {
      console.log('No more handlers');
      if (err) {
        throw err;
      }
      return;
    }

    if (message && message.command) {
      if (handler.command === message.command) {
        console.log('Calling handler', message);
        handler.handle(message, next);
      }
    } else {
      console.log('Calling handler 2', message);
      handler.handle(message, next);
    }
  }
  next(null, data);
};

module.exports = Middleware;