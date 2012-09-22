'use strict';

var parser = require('./parser'),
  MessageStream = require('./message'),
  net = require('net'),
  util = require('util'),
  stream = require('stream'),
  es = require('event-stream');

function IRCStream(c) {
  stream.call(this); // Call stream constructor.
  var self = this;

  self.readable = true;
  self.writable = false;

  self.old = {}; // Convenience function that makes it easy to override stream.
  Object.keys(stream.prototype).forEach(function (key) {
    self.old[key] = function () {
      stream.prototype[key].apply(self, arguments);
    };
  });

  self.config = {
    port: 6667,
    user: 'nodejs',
    name: 'node-irc-stream'
  };
  // Extend config
  if (typeof c === 'object') {
    Object.keys(c).forEach(function (key) {
      self.config[key] = c[key];
    });
  }

  self.middleware = {
    'output': [],
    'input': []
  };
  self.parser = parser();
  self.channels = {};
  self.queries = {};

  return self;
}
util.inherits(IRCStream, stream);

IRCStream.prototype.set = function (conf, val) {
  this.config[conf] = val;
  return this;
};

/*IRCStream.prototype.pipe = function (pipe) {
  this.old.pipe(pipe);
  return this;
};*/

IRCStream.prototype.output = function(middleware, config) {
  if (middleware instanceof stream) {
    this.middleware.output.push(middleware);
  } else if (typeof middleware === 'string') {
    try {
      this.middleware.output.push(
      require(__dirname + '/middleware/' + middleware).call(this, config));
    } catch (e) {
      throw new Error('Could not load middleware: "' + middleware + '"!');
    }
  }
  return this;
};

IRCStream.prototype.input = function(middleware, config) {
  if (middleware instanceof stream) {
    this.middleware.input.push(middleware);
  } else if (typeof middleware === 'string') {
    try {
      this.middleware.input.push(
      require(__dirname + '/middleware/' + middleware).call(this, config));
    } catch (e) {
      throw new Error('Could not load middleware: "' + middleware + '"!');
    }
  }
  return this;
};

IRCStream.prototype.send = IRCStream.prototype.write = function(cmd) {
  if (!this.writable) {
    return false;
  }

  var args = Array.prototype.slice.call(arguments);
  args.shift();
  if (!args) {
    return;
  }
  if (args[args.length - 1].match(/\s/)) {
    args[args.length - 1] = ":" + args[args.length - 1];
  }

  this.net.write(cmd + ' ' + args.join(' ') + '\r\n');
};

IRCStream.prototype.end = function(data) {
  if (data) {
    this.write(data);
  }
  this.writable = false;
  this.emit('end');
};

IRCStream.prototype.destroy = function() {
  this.writable = false;
};

IRCStream.prototype.connect = function(cb) {
  var self = this,
    c = this.config;

  if (typeof cb === 'function') {
    self.once('connected', cb);
  }

  // Check that we have all the required configuration.
  if (!c.nick) {
    throw new Error("Nickname is not configured!");
  }
  if (!c.address) {
    throw new Error("Address is not configured!");
  }

  // Helper function for connecting middleware streams.
  function install(ware) {
    if (ware.length) {
      return es.pipeline.apply(null, ware);
    } else {
      return es.through();
    }
  }

  self.net = net.connect({
    port: c.port,
    host: c.address
  });

  // Connect our output streams.
  es.pipeline(
    self.net,
    self.parser,
    install(self.middleware.output),
    // Handle data and drop it, we don't want to send it back to the socket.
    es.map(function installHandler(data, cb) {
      self.handleMessage(data);
      cb();
    })
  );

  // Connect our input streams.
  self.input = es.pipeline(
    install(self.middleware.input),
    self.net
  );

  // Once we have a connection, set stream to writable.
  self.net.on('connect', function() {
    self.writable = true;
    self.send('NICK', c.nick);
    self.send('USER', c.user, 8, '*', c.name);
  });

  return self;
};

IRCStream.prototype.handleMessage = function(msg) {
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
    if (self.config.nick == msg.nick) {
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
  }).forEach(function(l) {
    self.send('PRIVMSG', to, l);
  });
};


module.exports = IRCStream;