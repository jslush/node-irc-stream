'use strict';

var vows = require('vows')
  , parser = require('../lib/middleware/parser')
  , assert = require('assert')
  , crypto = require('crypto');

vows.describe('Parser Test').addBatch({
  'A Parser': {
    topic: parser,
    'parsing 001 message': {
      topic: function (parser) {
        var cb = this.callback;
        parser.once('data', function (data) {
          cb(null, data);
        });
        parser.write(':lindbohm.freenode.net 001 streamBot1337 :Welcome to the freenode Internet Relay Chat Network streamBot1337\r\n');
      },
      'parses 001 message': function (data) {
        assert.deepEqual(data, {
          prefix: 'lindbohm.freenode.net',
          server: 'lindbohm.freenode.net',
          command: '001',
          rawCommand: '001',
          commandType: 'normal',
          args: [ 'streamBot1337',
                  'Welcome to the freenode Internet Relay Chat Network streamBot1337' ]
        });
      }
    },
    'parsing random message': {
      topic: function (parser) {
        return function () {
          for (var i = 999; i >= 0; i--) {
            try {
              parser.write(crypto.randomBytes(256).toString() + '\r\n');
            } catch (e) {
              // We only want TypeErrors, so anything else will fail.
              if (!(e instanceof TypeError)) {
                return e;
              }
            }
          }
          return true;
        };
      },
      'crashes cleanly': function (f) {
        assert.isTrue(f());
      }
    }
  }
}).exportTo(module);