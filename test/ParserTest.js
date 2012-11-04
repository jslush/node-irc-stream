'use strict';

var vows = require('vows')
  , Parser = require('../lib/middleware/parser')
  , assert = require('assert')
  , crypto = require('crypto');

// Load messages to test the parser with.
var messages = require('./messages');

// Define a macro for creating a parsing test.
function parseMessage(msg) {
  var parser = Parser();
  return function () {
    parser.once('data', this.callback.bind(null, null));
    parser.write(msg + '\r\n');
  };
}

// This functions turns the json into a test suite.
function parseMessages() {
  var suite = {};
  Object.keys(messages).forEach(function (msg) {
    suite['parsing ' + msg] = {
      topic: parseMessage(messages[msg][0]),
      'Parsed correctly': function (data) {
        assert.deepEqual(data, messages[msg][1]);
      }
    };
  });
  return suite;
}

vows.describe('Testing parser')
  // Tests each message in the messages object.
  .addBatch({ 'A parser': parseMessages() })
  // Tests fuzzy random data for exceptions.
  .addBatch({ 'A parser': {
    'parsing random message': {
      topic: function () {
        var parser = Parser();
        for (var i = 999; i >= 0; i--) {
          try { parser.write(crypto.randomBytes(256).toString() + '\r\n'); }
          catch (e) { // We only want TypeErrors, so anything else will fail.
            if (!(e instanceof TypeError)) { return e; }
          }
        }
        return true;
      },
      'Crashes cleanly': function (clean) {
        assert.isTrue(clean);
      }
    }
  }})
.exportTo(module);