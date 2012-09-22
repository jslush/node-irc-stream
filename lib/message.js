'use strict';

var parser = require('./parser')
  , net = require('net')
  , util = require('util')
  , stream = require('stream')
  , es = require('event-stream');

function MessageStream(name, server) {
  stream.call(this);  // Call stream constructor.
  var self = this;

  self.name = name;
  self.server = server;
  self.readable = true;
  self.writable = true;

  /*self.old = {}; // Convenience function that makes it easy to override stream.
  Object.keys(stream.prototype).forEach(function (key) {
    self.old[key] = function () { stream.prototype[key].apply(self, arguments); };
  });*/
  return self;
}
util.inherits(MessageStream, stream);

MessageStream.prototype.handleMessage = function (msg) {
  this.emit('data', msg);
};

MessageStream.prototype.write = function (msg) {
  if (!this.writable) { return false; }
  this.server.say(this.name, msg);
};


module.exports = MessageStream;