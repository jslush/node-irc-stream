'use strict';

var net = require('net')
  , util = require('util')
  , stream = require('stream')
  , es = require('event-stream');

function Client(c) {
  var self = this;

  self.connected = false;

  self.config = {
    port: 6667,
    user: 'nodejs',
    name: 'node-irc-stream',
    version: 'node-irc-stream 0.0.1 Node on ' + process.platform
  };
  // Extend config.
  if (typeof c === 'object') {
    Object.keys(c).forEach(function (key) {
      self.config[key] = c[key];
    });
  }

  self.middleware = {
    'output': [],
    'input': []
  };

  self.net = new net.Socket();

  return self;
}
util.inherits(Client, process.EventEmitter);

Client.prototype.set = function (conf, val) {
  this.config[conf] = val;
  return this;
};

// MIDDLEWARE LOADING //

Client.prototype.loadMiddleware = function (middleware, config) {
  try {
    if (middleware instanceof stream) {
      return middleware;
    } else if (typeof middleware === 'function') {
      return middleware.call(this, config);
    } else if (typeof middleware === 'string') {
      return require(__dirname + '/middleware/' + middleware).call(this, config);
    }
  } catch (e) {
    console.error(e.stack);
    throw new Error('Could not load middleware: "' + middleware + '"!');
  }
};

Client.prototype.output = function (middleware, config) {
  var s = this.loadMiddleware(middleware, config);
  if (s) {
    this.middleware.output.push(s);
  }
  return this;
};

Client.prototype.input = function (middleware, config) {
  var s = this.loadMiddleware(middleware, config);
  if (s) {
    this.middleware.input.push(s);
  }
  return this;
};

Client.prototype.use = function (middleware, config) {
  var s = this.loadMiddleware(middleware, config);
  if (s && s.length === 2) {
    this.middleware.input.push(s[0]);
    this.middleware.output.push(s[1]);
  }
  return this;
};

// CONNECTION AND MESSAGE HANDLING

Client.prototype.send = function (cmd) {
  if (!this.connected) {
    return this;
  }

  this._input.write({
    command: cmd,
    args: [].splice.call(arguments, 1)
  });

  return this;
};

Client.prototype.connect = function (cb) {
  var self = this, c = this.config;

  if (typeof cb === 'function') {
    self.once('connected', cb);
  }

  // Check that we have all the required configuration.
  if (!c.nick) {
    throw new Error('Nickname is not configured!');
  }
  if (!c.address) {
    throw new Error('Address is not configured!');
  }

  // Flatten, filter and pipe streams.
  function pipe() {
    return es.pipe.apply(es, []
      .slice.call(arguments)
      .reduce(function (a, b) { return Array.isArray(a) ? a.concat(b) : [].concat(a, b); })
      .filter(function (a)    { return a; })
    );
  }

  self._input = pipe(
    self.middleware.input,
    self.loadMiddleware('composer'),
    self.net
  );

  self._output = pipe(
    self.net,
    self.loadMiddleware('parser'),
    self.middleware.output,
    es.mapSync(self._handleMessage.bind(self))
  );

  self.net.connect({
    port: c.port,
    host: c.address
  }).on('connect', function () {
    self.connected = true;
    self
      .send('NICK', c.nick)
      .send('USER', c.user, 8, '*', c.name);
  });

  return self;
};

Client.prototype._handleMessage = function (msg) {
  var self = this;
  switch (msg.command) {
  case '001':
    // The server decides the nickname ultimately.
    self.config.nick = msg.args[0];
    self.emit('connected');
    break;
  case '002':
  case '003':
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
  case 'PRIVMSG':
    var from = msg.nick
      , to   = msg.args[0]
      , text = msg.args[1];

    if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
      self._handleCTCP(from, to, text, 'privmsg');
      break;
    }

    // General message event.
    self.emit('message', from, to, text, msg);

    // Only channel messages.
    if (to.match(/^[&#+!]/)) {
      self.emit('message#', from, to, text, msg);
    }

    // Only queries.
    if (to === self.nick) {
      self.emit('query', from, text, msg);
    }

    break;
  }
};

Client.prototype._handleCTCP = function (from, to, text, type) {
  text = text.slice(1, text.lastIndexOf('\u0001'));
  var parts = text.split(' ');
  this.emit('ctcp', from, to, text, type);
  if (type === 'privmsg' && text === 'VERSION') {
    this.ctcp(from, 'notice', 'VERSION ' + this.config.version);
  }
};

// IRC SPECIFIC SHORTHANDS //

Client.prototype.join = function (ch, cb) {
  var self = this;

  if (!ch || typeof ch !== 'string') {
    throw new Error('Channel must be a string!');
  }

  if (typeof cb === 'function') {
    console.log('register listener for', 'joined' + ch);
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

Client.prototype.ctcp = function (to, type, text) {
  this[type === 'privmsg' ? 'say' : 'notice'](to, '\u0001' + text + '\u0001');
  return this;
};

module.exports = Client;