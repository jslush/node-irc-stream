'use strict';

var es = require('event-stream')
	, util = require('util');

/**
 * Very simple example of a middleware.
 */

module.exports = function (config) {
	return es.through(function (data) {
		// Use custom logger function.
		if (typeof config.output === 'function') {
			config.output(data);
		} else {
			console.log(util.inspect(data, false, 5, config.colors));
		}
		this.emit('data', data);
	});
};