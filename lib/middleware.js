'use strict';

var path = require('path')
  , stream = require('stream')
  , es = require('event-stream');

function Middleware(parent, defaults, path) {
  // If called as a function, return a new Middleware.
  if (!(this instanceof Middleware)) {
    return new Middleware(parent, defaults, path);
  }
  this.defaults = defaults;
  this.parent = parent;
  this.path = path || __dirname + '/middleware/';
  this.input = [];
  this.output = [];
}

Middleware.prototype.load = function (mw, opt) {
  try {
    if (mw instanceof stream) {
      return mw; // a single duplex stream
    } else if (typeof mw === 'function') {
      return mw.call(this.parent, opt); // a function that returns a middleware
    } else if (typeof mw === 'string') {
      if (path.basename(mw) !== mw) { // a string that is recognized as a built-in middleware
        throw new Error('Name of a built-in middleware can\'t contain directory separators');
      }
      return require(path.normalize(this.path + mw)).call(this.parent, opt);
    }
  } catch (e) {
    e.message = 'Could not load middleware: "' + mw + '"!\n' + e.message;
    throw e;
  }
};

Middleware.prototype.use = function (mw, opt) {
  // If the middleware is loaded by default, remove it because we load it now.
  // This allows the user to decide the middleware loading order, if they need to change it.
  this.disable(mw);

  var s = this.load(mw, opt);
  if (s && Array.isArray(s)) {
    this.input.push(s[0]);
    this.output.push(s[1]);
  } else if (s && (s instanceof stream)) {
    this.input.push(s);
    this.output.push(s);
  }
};

Middleware.prototype.disable = function (mw) {
  var index = this.defaults.indexOf(mw);
  if (index !== -1) {
    this.defaults.splice(index, 1);
  }
};

Middleware.prototype.loadDefaults = function () {
  for (var i = this.defaults.length - 1; i >= 0; i--) {
    this.use(this.defaults[0]);
  }
};

Middleware.prototype.pipe = function () {
  // Flatten, filter and pipe streams.
  return es.pipe.apply(es, []
    .slice.call(arguments)
    .reduce(function (a, b) { return Array.isArray(a) ? a.concat(b) : [].concat(a, b); })
    .filter(function (a)    { return a; })
  );
};

module.exports = Middleware;