'use strict';

var MessageStream = require('./message')
  , net = require('net')
  , util = require('util')
  , stream = require('stream')
  , es = require('event-stream');

function Client(c) {
  var self = this;

  self.connected = false;

  self.config = {
    port: 6667,
    user: 'nodejs',
    name: 'node-irc-stream'
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

  self.channels = {};
  self.queries = {};

  self.net = new net.Socket();

  return self;
}
util.inherits(Client, process.EventEmitter);

Client.prototype.set = function (conf, val) {
  this.config[conf] = val;
  return this;
};

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
  if (s) {
    this.middleware.input.push(s);
    this.middleware.output.push(s);
  }
  return this;
};

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
    self.loadMiddleware('compose'),
    self.net
  );

  self._output = pipe(
    self.net,
    self.loadMiddleware('parse'),
    self.middleware.output,
    es.mapSync(self.handleMessage.bind(self))
  );

  self.net.connect({
    port: c.port,
    host: c.address
  });

  self.net.on('connect', function () {
    self.connected = true;
    self
      .send('NICK', c.nick)
      .send('USER', c.user, 8, '*', c.name);
  });

  return self;
};

Client.prototype.handleMessage = function (msg) {
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
    // We joined, let's create a channel stream.
    if (self.config.nick === msg.nick) {
      var chs = self.channels[ch] = new MessageStream(ch, self);
      self.emit('joined' + ch, chs);
    }
    break;
  case 'PRIVMSG':
    var from = msg.nick;
    var to   = msg.args[0];
    var text = msg.args[1];

    // It's one of our channels.
    if (Object.keys(self.channels).indexOf(to) !== -1) {
      self.emit('message', from, to, text);
      self.emit(to, from, text);
      self.channels[to].receive(text);
    }

    // If it's one of our queries.
    if (Object.keys(self.queries).indexOf(from) !== -1) {
      self.emit('query', from, text);
      self.queries[from].receive(text);
    }

    break;
  }
};

// IRC SPECIFIC SHORTHANDS

Client.prototype.join = function (ch, cb) {
  var self = this;

  if (!ch || typeof ch !== 'string') {
    throw new Error('Channel must be a string!');
  }

  self.once('joined' + ch, function () {
    if (typeof cb === 'function') {
      return cb.apply(this, arguments);
    }
  });

  self.send('JOIN', ch);
  return self;
};

Client.prototype.query = function (who, cb) {
  var self = this;

  if (!who || typeof who !== 'string') {
    throw new Error('Nickname must be a string!');
  }

  cb(self.queries[who] = new MessageStream(who, self));

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


module.exports = Client;