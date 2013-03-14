'use strict';

var path = require('path')
  , cjson = require('cjson');

function Configure(path, defaults) {
  // If called as a function, return a new Configure object.
  if (!(this instanceof Configure)) {
    return new Configure(path, defaults);
  }
  cjson.extend(true, this, defaults, path && cjson.load(path));
}

module.exports = Configure;