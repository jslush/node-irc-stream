'use strict';

var net = require('net')
  , util = require('util')
  , Middleware = require('./middleware')
  , Configure = require('./configure')
  , path = require('path')
  , fs = require('fs');

function Client(c) {
  if (!(this instanceof Client)) {
    return new Client(c);
  }

  // Load configure file
  this.config = new Configure(c, {
    port: 6667,
    user: 'nodejs',
    name: 'node-irc-stream',
    debug: false
  });

  // Initialize middleware system.
  this.middleware = Middleware(this);
  this.use(require('./middleware/parser')());

  this.net = new net.Socket();
  this.net.setEncoding('utf8');

  return this;
}
util.inherits(Client, process.EventEmitter);

Client.prototype.set = function (conf, val) {
  this.debug('Setting', conf, 'to', val);
  this.config[conf] = val;
  return this;
};

Client.prototype.enable = function(conf) {
  this.debug('Enabling', conf);
  this.config[conf] = true;
  return this;
};

Client.prototype.disable = function(conf) {
  this.debug('Disabling', conf);
  this.config[conf] = false;
  return this;
};

Client.prototype.debug = function () {
  if (this.config.debug) {
    console.log.apply(this, arguments);
  }
};

// MIDDLEWARE LOADING //

Client.prototype.use = function (mw) {
  if (!this.connected) {
    this.middleware.use(mw);
  } else { // TODO: Adding middleware while running?
    this.debug('Unable to use middleware after calling `connect`.');
  }
  return this;
};

// CONNECT //

Client.prototype.connect = function () {
  var self = this;

  console.log('Client connecting...');

  self.net.on('data', function (data) {
    self.middleware.handleOutput(data);
  });

  self.net.connect(self.config.port, self.config.address);
};

module.exports = Client;

// Auto-load bundled middlewre with getters.
fs.readdirSync(__dirname + '/middleware').forEach(function (filename) {
  if (!/\.js$/.test(filename)) { return; }
  var name = path.basename(filename, '.js');
  module.exports.__defineGetter__(name, function () { return require('./middleware/' + name); });
});