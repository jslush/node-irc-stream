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
    var channel;

    if (msg.command === 'rpl_namreply') {
      channel = irc.channels[msg.args[2]];
      if (!channel) { return msg; }

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
      if (!channel) { return msg; }

      channel.emit('names', channel.names);
      irc.emit('names', channel.name, channel.names);
      irc.emit('names' + channel.name, channel.names);
    }

    return msg;
  }

  // Create a stream that runs all our handlers.
  var output = es.pipe.apply(es, [
    handleJoin,
    handleMessage,
    handleNames
  ].map(es.mapSync));

  return [null, output];
};