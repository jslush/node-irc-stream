var vows = require('vows');

vows.describe('MessageStream Test')
.addBatch(require('./MessageStreamTest'))
.export(module);