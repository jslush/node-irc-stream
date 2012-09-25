'use strict';

var MessageStream = require('./message')
  , net = require('net')
  , util = require('util')
  , stream = require('stream')
  , es = require('event-stream');

function IRCStream(c) {
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
  // Load parser, it must be loaded before any user middleware.
  self.output('parse');

  self.channels = {};
  self.queries = {};

  self.net = new net.Socket();

  return self;
}
util.inherits(IRCStream, process.EventEmitter);


IRCStream.prototype.set = function (conf, val) {
  this.config[conf] = val;
  return this;
};

IRCStream.prototype.loadMiddleware = function (middleware, config) {
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

IRCStream.prototype.output = function (middleware, config) {
  var s = this.loadMiddleware(middleware, config);
  if (s) {
    this.middleware.output.push(s);
  }
  return this;
};

IRCStream.prototype.input = function (middleware, config) {
  var s = this.loadMiddleware(middleware, config);
  if (s) {
    this.middleware.input.push(s);
  }
  return this;
};

IRCStream.prototype.use = function (middleware, config) {
  var s = this.loadMiddleware(middleware, config);
  if (s) {
    this.middleware.input.push(s);
    this.middleware.output.push(s);
  }
  return this;
};

IRCStream.prototype.send = function (cmd) {
  if (!this.connected) {
    return this;
  }

  this._input.write({
    command: cmd,
    args: [].splice.call(arguments, 1)
  });

  return this;
};

IRCStream.prototype.connect = function (cb) {
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

  // Helper function for connecting middleware streams.
  function install(ware) {
    return ware.length ?
      es.pipe.apply(es, ware) :
      es.through();
  }

  // Connect our output streams.
  self._output = es.pipe(
    self.net,
    install(self.middleware.output),
    // Handle data and drop it, we don't want to send it back to the socket.
    es.map(function installHandler(data, cb) {
      self.handleMessage(data);
      cb();
    })
  );

  // Connect our input streams.
  // Add composer here, because it must be added last.
  self.input('compose');
  self._input = es.pipe(
    install(self.middleware.input),
    self.net
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

IRCStream.prototype.handleMessage = function (msg) {
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
      self.channels[to].handleMessage(text);
    }

    // If it's one of our queries.
    if (Object.keys(self.queries).indexOf(from) !== -1) {
      self.queries[from].handleMessage(text);
    }

    break;
  }
};

IRCStream.prototype.join = function (ch, cb) {
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

IRCStream.prototype.query = function (who, cb) {
  var self = this;

  if (!who || typeof who !== 'string') {
    throw new Error('Nickname must be a string!');
  }

  cb(self.queries[who] = new MessageStream(who, self));

  return self;
};

IRCStream.prototype.say = function (to, msg) {
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


module.exports = IRCStream;