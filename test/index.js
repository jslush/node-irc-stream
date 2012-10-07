'use strict';

var vows = require('vows')
  , async = require('async');

var tests = [
  //vows.describe('MessageStream Test').addBatch(require('./MessageStreamTest')),
  vows.describe('Parser Test').addBatch(require('./ParserTest')),
  vows.describe('Load middleware Test').addBatch(require('./LoadMiddlewareTest')),
  vows.describe('JSHint Test').addBatch(require('./JSHintTest'))
];

async.mapSeries(tests, function (test, cb) {
  test.run(null, function (o) { cb(null, o); });
}, done);

function done(err, data) {
  // Errors == no success
  var success = !err;
  // Check tests for asserts or errors.
  if (success) {
    for (var i = 0, d; d = data[i]; i++) {
      if (d.broken || d.errored) {
        success = false;
      }
    }
  }

  process.exit(success ? 0 : 1);
}