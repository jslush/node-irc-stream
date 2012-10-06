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

  self.prefixToMode = {};
  self.modeToPrefix = {};

  self.middleware = {
    'output': [],
    'input': [],
    'defaults': ['flood-protection', 'message-stream']
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
    // Middleware can be a single duplex stream
    if (middleware instanceof stream) {
      return middleware;
    // Or a function that receives config and returns middleware
    } else if (typeof middleware === 'function') {
      return middleware.call(this, config);
    // Or a string that is recognized as a built-in middleware.
    } else if (typeof middleware === 'string') {
      return require(__dirname + '/middleware/' + middleware).call(this, config);
    }
  } catch (e) {
    console.error(e.stack);
    throw new Error('Could not load middleware: "' + middleware + '"!');
  }
};

Client.prototype.use = function (middleware, config) {
  // If the middleware is loaded by default, removed it because we load it now.
  this.disable(middleware);

  var s = this.loadMiddleware(middleware, config);
  if (s && Array.isArray(s)) {
    this.middleware.input.push(s[0]);
    this.middleware.output.push(s[1]);
  } else {
    this.middleware.input.push(s);
    this.middleware.output.push(s);
  }
  return this;
};

Client.prototype.disable = function (middleware) {
  if (!this.connected) {
    var index = this.middleware.defaults.indexOf(middleware);
    if (index !== -1) {
      this.middleware.defaults.splice(index, 1);
    }
  } else {
    // TODO: Disabling middleware while running.
  }
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
  var self = this
    , c = this.config
    , mw = self.middleware;

  if (typeof cb === 'function') {
    self.once('connected', cb);
  }

  if (!c.nick)    { throw new Error('Nickname is not configured!'); }
  if (!c.address) { throw new Error('Address is not configured!'); }

  // Flatten, filter and pipe streams.
  function pipe() {
    return es.pipe.apply(es, []
      .slice.call(arguments)
      .reduce(function (a, b) { return Array.isArray(a) ? a.concat(b) : [].concat(a, b); })
      .filter(function (a)    { return a; })
    );
  }

  // Load default middleware.
  for (var i = mw.defaults.length - 1; i >= 0; i--) {
    self.use(mw.defaults[0]);
  }

  self._input = pipe(
    mw.input,
    self.loadMiddleware('composer'),
    self.net
  );

  self._output = pipe(
    self.net,
    self.loadMiddleware('parser'),
    mw.output,
    es.mapSync(self._handleMessage.bind(self))
  );

  self.net.connect(c.port, c.address)
    .on('connect', function () {
      self.connected = true;
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
  case "005":
    msg.args.forEach(function (arg) {
      var match = arg.match(/PREFIX=\((.*?)\)(.*)/);
      if (match) {
        match[1] = match[1].split('');
        match[2] = match[2].split('');
        while (match[1].length) {
          self.prefixToMode[match[2][0]] = match[1][0];
          self.modeToPrefix[match[1].shift()] = match[2].shift();
        }
      }
    });
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
  case 'PRIVMSG':
    var from = msg.nick
      , to   = msg.args[0]
      , text = msg.args[1];

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