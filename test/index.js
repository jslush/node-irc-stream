'use strict';

var vows = require('vows')
  , async = require('async');

var tests = [
  vows.describe('MessageStream Test').addBatch(require('./MessageStreamTest')),
  vows.describe('Parser Test').addBatch(require('./ParserTest')),
  vows.describe('JSHint Test').addBatch(require('./JSHintTest'))
];

async.forEachSeries(tests, function (test, cb) {
  test.run(null, function () { cb(null); });
});