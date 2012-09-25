'use strict';

var util = require('util')
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


module.exports = MessageStream;