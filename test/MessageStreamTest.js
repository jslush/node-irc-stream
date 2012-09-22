'use strict';

var MessageStream = require('../lib/message')
  , assert = require('assert');


module.exports = {
  "A Message": {
    topic: function () {
      var server = {
        msgs: [],
        say: function (name, msg) { server.msgs.push(msg); }
      };
      return new MessageStream('test', server);
    },
    'is a message': function (message) {
      assert.instanceOf(message, MessageStream);
    },
    'handling test message': {
      topic: function (message) {
        var cb = this.callback;
        message.once('data', function (data) {
          cb(null, data);
        });
        message.handleMessage('test message');
      },
      'handles test message': function (data) {
        assert.equal(data, 'test message');
      }
    },
    'writing test message': {
      topic: function (message) {
        message.write('message test');
        return message.server;
      },
      'writes test message': function (server) {
        assert.equal(server.msgs[0], 'message test');
      }
    }
  }
};