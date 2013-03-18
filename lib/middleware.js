'use strict';

var domain = require('domain')
  , fs = require('fs')
  , colors = require('colors');

function Middleware(parent, path) {
  // If called as a function, return a new Middleware.
  if (!(this instanceof Middleware)) {
    return new Middleware(parent, path);
  }
  this.parent = parent;
  this.input = [];
  this.output = [];
  this.middlewareDomain = domain.create();

  this.context = {
    log: function () {
      if (!parent.config.debug) { return; }
      var a = [].slice.call(arguments);
      a.unshift('Middleware', '(' + this.middleware.name + '):');
      console.log.apply(null, a);
    },
    parent: parent
  };

  this.middlewareDomain.on('error', function (err) {
    console.log('Exception caught while running middleware',
      err.domain.context.middleware, '\n', err.stack);
  });
}

Middleware.prototype.use = function (mw) {
  var self = this;
  if (typeof mw === 'function') {
    // Run in domain to catch exceptions.
    self.middlewareDomain.run(function () {
      mw = mw(self.parent);
    });
  }
  // Nothing to use.
  if (!mw) { return; }

  var o = {
    command: mw.command,
    name: mw.name.green || 'Anonymous'.red,
    handle: mw.input
  };

  self.input.push(o);

  o.handle = mw.output;

  self.output.push(o);

};

Middleware.prototype.handleOutput = function (data) {
  var index = 0, self = this, stack = self.output;

  function next(message) {
    // Select next middleware in the stack.
    var handler = stack[index++];

    console.log('DATA', message);

    if (!handler) {
      console.log('No more handlers');
      return;
    }

    // Save context
    self.context.middleware = handler;
    self.middlewareDomain.context = self.context;
    // If message is parsed, check command first.
    if (handler.command && message && message.command === handler.command) {
      console.log('Calling handler (command ' + message.command + '):', handler.name);
      handler.handle.call(self.context, message, next);
    } else if (!handler.command) {
      console.log('Calling handler (no command specified):', handler.name);
      handler.handle.call(self.context, message, next);
    } else {
      console.log('Skipping handler:', handler.name);
      next(message);
    }
  }
  self.middlewareDomain.run(next.bind(self, data));
};

module.exports = Middleware;