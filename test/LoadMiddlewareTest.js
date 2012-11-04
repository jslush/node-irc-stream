'use strict';

var vows = require('vows')
  , IRC = require('..')
  , assert = require('assert');

vows.describe('Testing middleware loading').addBatch({
  'An IRC Client': {
    topic: IRC(),
    'Can load CTCP middleware': function (client) {
      assert.doesNotThrow(function () { client.use('ctcp'); });
    },
    'Cannot load middleware with directory separators': function (client) {
      assert.throws(function () { client.use('../middleware/ctcp'); });
    },
    'Cannot load unexisting middlewares': function (client) {
      assert.throws(function () { client.use('unexisting-middleware'); });
    }
  }
}).exportTo(module);