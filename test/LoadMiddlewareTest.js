'use strict';

var IRC = require('..')
  , assert = require('assert');

module.exports = {
  'An IRC Client': {
    topic: new IRC(),
    'Can load CTCP middleware': function (client) {
      assert.doesNotThrow(function () { client.use('ctcp') });
    },
    'Cannot load middleware with directory separators': function (client) {
      assert.throws(function () { client.use('../middleware/ctcp') });
    },
    'Cannot load unexisting middlewares': function (client) {
      assert.throws(function () { client.use('unexisting-middleware') });
    }
  }
};