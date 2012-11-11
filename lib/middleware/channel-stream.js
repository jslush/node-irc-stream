'use strict';

var es = require('event-stream')
  , util = require('util')
  , stream = require('stream');


function MessageStream(name, server) {
  stream.call(this);  // Call stream constructor.
  var self = this;

  self.name = name;
  self.names = {};
  self.server = server;
  self.readable = true;
  self.writable = true;

  return self;
}
util.inherits(MessageStream, stream);

MessageStream.prototype.receive = function (msg) {
  this.emit('data', msg);
};

MessageStream.prototype.write = function (msg) {
  if (!this.writable) { return false; }
  this.server.say(this.name, msg);
};

MessageStream.prototype.close = function (msg, cb) {
  if (this.name in this.server.channels) {
    if (!cb && typeof msg === 'function') { cb = msg; msg = undefined; }
    if (typeof cb === 'function') {
      this.once('parted', cb);
    }
    this.server.send('PART', this.name, msg);
  } else if (this.name in this.server.queries) {
    delete this.server.queries[this.name];
  }
  this.emit('end');
  this.writable = false;
  this.readable = false;
};


function handleJoin(irc, msg) {
  var ch = msg.args[0];

  if (irc.nick === msg.nick) {
    irc.channels[ch] = new MessageStream(ch, irc);
    irc.emit('joined' + ch, irc.channels[ch]);
  } else if (ch in irc.channels) {
    irc.channels[ch].emit('join', msg.args[1]);
  }

  return msg;
}

function handleMessage(irc, msg) {
  var from = msg.nick
    , to = msg.to = msg.args[0]
    , text = msg.text = msg.args[1];
  msg.timestamp = new Date();

  // It's one of our channels.
  if (to in irc.channels) {
    irc.channels[to].receive(msg);
  }

  // If it's a query.
  if (to === irc.nick) {
    if (from in irc.queries) {
      irc.queries[from].receive(msg);
    } else {
      irc.emit('query', irc.queries[from] = new MessageStream(from, irc));
      // Delay this message so that the user has time to register a listener.
      process.nextTick(function () {
        irc.queries[from].receive(msg);
      });
    }
  }

  return msg;
}

function handleNames(irc, msg) {
  var channel;

  if (msg.command === 'rpl_namreply') {
    channel = irc.channels[msg.args[2]];
    if (!channel) { irc.debug('rpl_namreply invalid channel: ' + msg.args[2]); return msg; }

    // Save names to channel stream object.
    msg.args[3].trim().split(/ +/).forEach(function (name) {
      // There can be a prefix that dictates a user mode (voice, operator)
      var match = name.match(/^(.)(.*)$/);
      if (!match) { return; }
      // If there is a known prefix, save it as the value.
      if (match[1] in irc.prefixToMode) {
        channel.names[match[2]] = match[1];
      } else {
        channel.names[match[1] + match[2]] = '';
      }
    });
  } else if (msg.command === 'rpl_endofnames') {
    channel = irc.channels[msg.args[1]];
    if (!channel) { irc.debug('rpl_endofnames invalid channel: ' + msg.args[1]); return msg; }

    channel.emit('names', channel.names);
  }

  return msg;
}


module.exports = function (config) {
  var irc = this;

  irc.channels = {};
  irc.queries = {};

  // Augment a query method.
  irc.query = function (who, cb) {
    if (!who || typeof who !== 'string') {
      throw new Error('Nickname must be a string!');
    }

    if (!cb || typeof cb !== 'function') {
      throw new Error('Callback must be a function!');
    }

    cb(irc.queries[who] = new MessageStream(who, irc));

    return irc;
  };

  var output = es.mapSync(function (msg) {
    switch (msg.command) {
    case 'JOIN':
      return handleJoin(irc, msg);
    case 'PRIVMSG':
      return handleMessage(irc, msg);
    case 'rpl_namreply':
    case 'rpl_endofnames':
      return handleNames(irc, msg);
    }
    return msg;
  });

  return [null, output];
};