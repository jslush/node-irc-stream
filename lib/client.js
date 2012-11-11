'use strict';

var net = require('net')
  , util = require('util')
  , es = require('event-stream')
  , Middleware = require('./middleware');

function Client(c) {
  var self = this;
  if (!(self instanceof Client)) {
    return new Client(c);
  }

  self.connected = false;

  self.config = {
    port: 6667,
    user: 'nodejs',
    name: 'node-irc-stream',
    debug: false
  };

  // Extend/override config.
  if (c && typeof c === 'object') {
    Object.keys(c).forEach(function (key) {
      self.config[key] = c[key];
    });
  }

  self.prefixToMode = {};
  self.modeToPrefix = {};

  // Initialize middleware system.
  self.middleware = Middleware(self,
    ['flood-protection', 'ctcp', 'channel-stream', 'supports']);

  self.net = new net.Socket();

  return self;
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

// CONNECTION AND MESSAGE HANDLING

Client.prototype.send = function (cmd) {
  if (!this.connected) {
    this.debug('Send failed, not connected.');
    return this;
  }

  this._input.write({
    command: cmd,
    args: [].splice.call(arguments, 1)
  });

  return this;
};

Client.prototype.connect = function (cb) {
  var self = this
    , c = this.config
    , mw = self.middleware;

  if (typeof cb === 'function') {
    self.once('connected', cb);
  }

  if (!c.nick)    { throw new Error('Nickname is not configured!'); }
  if (!c.address) { throw new Error('Address is not configured!'); }

  mw.loadDefaults();

  self._input = mw.pipe(
    mw.input,
    mw.load('composer'),
    self.net
  );

  self._output = mw.pipe(
    self.net,
    mw.load('parser'),
    mw.output,
    es.mapSync(self._handleMessage.bind(self))
  );

  self.net.connect(c.port, c.address)
    .on('connect', function () {
      self.debug('Connected, sending NICK and USER.');
      self.connected = true;
      if (self.config.password) {
        self.send('PASS', self.config.password);
      }
      self.send('NICK', c.nick)
        .send('USER', c.user, 8, '*', c.name);
    }
  );

  return self;
};

Client.prototype._handleMessage = function (msg) {
  var self = this;
  switch (msg.command) {
  case '001':
    // The server decides the nickname ultimately.
    self.nick = msg.args[0];
    self.emit('connected');
    break;
  case "err_nicknameinuse":
    if (!self.config.nickModifier) { self.config.nickModifier = 0; }
    self.config.nickModifier++;
    self.send("NICK", self.config.nick + self.config.nickModifier);
    self.nick = self.config.nick + self.config.nickModifier;
    break;
  case 'PING':
    self.send('PONG', msg.args[0]);
    break;
  case 'JOIN':
    var ch = msg.args[0];
    if (self.config.nick === msg.nick) {
      self.emit('joined' + ch);
    }
    break;
  }
};

// IRC SPECIFIC SHORTHANDS //

Client.prototype.join = function (ch, cb) {
  var self = this;

  if (!ch || typeof ch !== 'string') {
    throw new Error('Channel must be a string!');
  }

  if (typeof cb === 'function') {
    self.once('joined' + ch, cb);
  }

  self.send('JOIN', ch);
  return self;
};

Client.prototype.say = function (to, msg) {
  var self = this;
  if (!msg) {
    return;
  }
  msg.toString().split(/\r?\n/).filter(function (l) {
    return !!l.length;
  }).forEach(function (l) {
    self.send('PRIVMSG', to, l);
  });
};

Client.prototype.notice = function (to, msg) {
  var self = this;
  if (!msg) {
    return;
  }
  msg.toString().split(/\r?\n/).filter(function (l) {
    return !!l.length;
  }).forEach(function (l) {
    self.send('NOTICE', to, l);
  });
};


module.exports = Client;