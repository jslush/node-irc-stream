'use strict';

var irc = require('..')
  , assert = require('assert');

describe('Configure', function () {
  var client = irc('./test/irc-options.json');

  it('Loads JSON properly', function () {
    // Test default options.
    assert.equal(client.config.name, 'node-irc-stream');
    assert.equal(client.config.user, 'nodejs');
    // Test custom options and overriding.
    assert.equal(client.config.port, 1337);
    assert.equal(client.config.nick, 'tuhBot');
  });

  it('Allows modifying settings', function () {
    // Test set
    client.set('port', 6667);
    assert.equal(client.config.port, 6667);      
    // Test enable
    client.enable('flood_protection');
    assert.equal(client.config.flood_protection, true);
    // Test disable
    client.disable('flood_protection');
    assert.equal(client.config.flood_protection, false);
  });
});