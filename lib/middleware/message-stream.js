'use strict';

var es = require('event-stream')
  , util = require('util')
  , stream = require('stream');


function MessageStream(name, server) {
  stream.call(this);  // Call stream constructor.
  var self = this;

  self.name = name;
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


module.exports = function (config) {
  var irc = this;

  irc.channels = {};
  irc.queries = {};

  // Implement query method.
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

  // Override join handler with our own.
  function handleJoin(msg) {
    if (msg.command !== 'JOIN') { return msg; }
    var ch = msg.args[0];
    if (irc.config.nick === msg.nick) {
      var chs = irc.channels[ch] = new MessageStream(ch, irc);
      irc.emit('joined' + ch, chs);
      return;
    }
    return msg;
  }

  // Augment privmsg handler with our own.
  function handleMessage(msg) {
    if (msg.command !== 'PRIVMSG') { return msg; }
    var from = msg.nick
      , to = msg.to = msg.args[0]
      , text = msg.text = msg.args[1];
    msg.timestamp = new Date();

    // It's one of our channels.
    if (Object.keys(irc.channels).indexOf(to) !== -1) {
      irc.channels[to].receive(msg);
    }

    // If it's one of our queries.
    if (Object.keys(irc.queries).indexOf(from) !== -1) {
      irc.queries[from].receive(msg);
    }

    return msg;
  }

  // Handling the users in a channel.
  function handleNames(msg) {
    if (msg.command !== 'rpl_namreply') { return msg; }
    var channel = msg.args[2]
      , names = msg.args[3]
      , users = {};

    // names contains a string with the format [[@|+]<nick> [[@|+]<nick> [...]]]
    // names is converted to an object, where the key is the nick and the value
    // is the mode, then you can use Object.keys to retrieve the nick list if
    // you only want the nicks.
    names = names.indexOf(' ') !== -1 ? names.split(' ') : [names];
    names.forEach(function (name) {
      var mode = name.charAt(0);

      if (mode === '@' || mode === '+') {
        users[name.substr(1)] = mode;
      } else {
        users[name] = '';
      }
    });

    irc.channels[channel].emit('names', users);

    return msg;
  }

  var output = es.pipe.apply(es, [
    handleJoin,
    handleMessage,
    handleNames
  ].map(es.mapSync));

  return [null, output];
};
