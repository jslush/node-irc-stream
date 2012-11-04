'use strict';

var vows = require('vows')
  , IRC = require('..')
  , assert = require('assert');

vows.describe('Testing middleware loading').addBatch({
  'An IRC Client': {
    topic: IRC(),
    'Can load default ctcp middleware': function (client) {
      assert.doesNotThrow(function () { client.use('ctcp'); });
    },
    'Can load optional logger middleware': function (client) {
      assert.doesNotThrow(function () { client.use('logger'); });
    },
    'Can\'t load middleware with invalid name': function (client) {
      assert.throws(function () { client.use('../middleware/ctcp'); });
    },
    'Can\'t load unexisting middleware': function (client) {
      assert.throws(function () { client.use('unexisting-middleware'); });
    }
  }
}).exportTo(module);