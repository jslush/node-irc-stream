'use strict';

var net = require('net')
  , util = require('util')
  , MiddlewareLoader = require('./middleware')
  , ConfigLoader = require('./configure');

function Client(c) {
  if (!(this instanceof Client)) {
    return new Client(c);
  }

  this.connected = false;

  this.config = {
    port: 6667,
    user: 'nodejs',
    name: 'node-irc-stream',
    debug: false
  };

  // Initialize middleware system.
  this.middleware = Middleware(this,
    [ /* default middleware comes here */ ]);

  this.net = new net.Socket();

  return this;
}
util.inherits(Client, process.EventEmitter);

Client.prototype.set = function (conf, val) {
  this.config[conf] = val;
  return this;
};

Client.prototype.debug = function () {
  if (this.config.debug) {
    console.log.apply(this, arguments);
  }
};

// MIDDLEWARE LOADING //

Client.prototype.use = function (mw, opt) {
  if (!this.connected) {
    this.middleware.use(mw, opt);
  } else { // TODO: Adding middleware while running?
    this.debug('Unable to use middleware after calling `connect`.');
  }
  return this;
};

Client.prototype.disable = function (mw) {
  if (!this.connected) {
    this.middleware.disable(mw);
  } else { // TODO: Disabling middleware while running?
    this.debug('Unable to disable middleware after calling `connect`.');
  }
  return this;
};

module.exports = Client;