'use strict';

var vows = require('vows');

vows
  .describe('MessageStream Test')
  .addBatch(require('./MessageStreamTest'))
.run();

vows
  .describe('Parser Test')
  .addBatch(require('./ParserTest'))
.run();
