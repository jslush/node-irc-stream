'use strict';

var irc = require('..')
  , format = require('util').format;

var client = irc()
  .set('nick', 'streamBot')
  .set('address', 'irc.cc.tut.fi')
  .enable('debug')
  .use(irc.proxy({ password: 'lollero', address: 'localhost', port: '34576' }))
  .connect();