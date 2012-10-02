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
    var from = msg.nick;
    var to   = msg.args[0];
    var text = msg.args[1];

    // It's one of our channels.
    if (Object.keys(irc.channels).indexOf(to) !== -1) {
      irc.channels[to].receive(text);
    }

    // If it's one of our queries.
    if (Object.keys(irc.queries).indexOf(from) !== -1) {
      irc.queries[from].receive(text);
    }

    return msg;
  }

  var output = es.pipe.apply(es, [handleJoin, handleMessage].map(es.mapSync));

  return [es.through(), output];
};