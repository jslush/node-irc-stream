'use strict';

var es = require('event-stream')
	, util = require('util');


module.exports = function (config) {
	var floodCounter = 0
		, lastMessage = Date.now();

	return es.through(function (data) {
		this.emit('data', data);
	});
};