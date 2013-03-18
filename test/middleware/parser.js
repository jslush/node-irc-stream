'use strict';

var assert = require('assert')
  , util = require('util')
  , messages = require('./messages')
  , parser = (require('../../lib/middleware/parser'))().output
  , context = {
    log: function () {} // Suppress middleware output.
  };

function parseMessage(name) {
  it('Parsing ' + name, function (done) {
    parser.call(context, messages[name][0], function (parsed) {
      assert.deepEqual(parsed, messages[name][1]);
      done();
    });
  });
}

describe('Parser middleware', function (cb) {
  Object.keys(messages).forEach(parseMessage);
});