'use strict';

var vows = require('vows')
  , assert = require('assert')
  , jshint = require('jshint').JSHINT
  , fs = require('fs')
  , cjson = require('cjson')
  , util = require('util')
  , config = cjson.load(__dirname + '/jshint.json');

// Map, filter undefined and join into a string.
function mapFilterJoin(a, f) {
  return a.map(f).filter(function (s) { return !!s; }).join('\n');
}

// Returns a formatter function that formats hints for a specific file.
function hintFormatter(file) {
  return function (i) {
    return util.format('%s on line %d:%d - %s', file, i.line, i.character, i.reason);
  };
}

function hint(folder) {
  var files = fs.readdirSync('./' + folder).filter(function (file) {
    // Only keep .js files.
    return file.match(/^.+\.js$/);
  });

  var errors = mapFilterJoin(files, function (file) {
    // Run JSHint.
    jshint(fs.readFileSync(folder + '/' + file, 'utf8'), config);
    // Read errors.
    var e = jshint.data().errors || [];
    // Map them with a formatter function.
    return mapFilterJoin(e, hintFormatter(file));
  });

  return errors;
}


vows.describe('Linting').addBatch({
  'JSHint': {
    topic: function () {
      // Hint the js files in the following folders.
      var folders = ['lib', 'lib/middleware', 'test']
        , errors = mapFilterJoin(folders, hint);
      return errors;
    },
    'conforms': function (errors) {
      assert.equal(errors, '');
    }
  }
}).exportTo(module);