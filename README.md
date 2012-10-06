node-irc-stream
===============
[![build status]](http://travis-ci.org/jslush/node-irc-stream)

**This module is not ready.** We advice you not to use this library before
we have made our first npm release.

Example
-------
Connects to an IRC server and joins channel #test.
As you can see, the join callback returns a channel stream object that can be
used to send and receive messages. This is done via the built-in middleware
message-stream. If you `.disable('message-stream')` the callback won't receive
anything and you have to use the raw events emitted by `client`.

```js
var IRC = require('irc-stream');

var client = new IRC()
  .set('address', 'irc.example.com')
  .set('nick', 'streamBot')
  .use('logger') // Simple default logger that logs irc data to console.
  .use('ctcp')   // CTCP middleware that handles e.g. VERSION and ACTION.
  .connect(function () {
    client.join('#test', function (ch) {
      ch.write('hi!');
      // Pipe ALL THE THINGS!
      process.stdin.pipe(ch)
        // If you want to prettify your output, you should use a formatter 
        // stream to convert the object to a string. See ./example/bot.js
        .pipe(process.stdout);
    });
  });
```

Contribution
------------
To contribute to our library you must understand our design principles for the library:
 * The core should be very light and modules (or middlewares) handle all the special things.
   * the `message-stream` module will handle commands related to channels (and queries).
   * The `ctcp` a module that handles CTCP, PRIVMSG and NOTICE special cases.
 * The core only connects, quits, disconnects and loads middleware (modules).

This way, it is easy to add tests for each module and if people don't like the
flood-protection, they can easily disable it and make their own, or if they
don't need to handle CTCP they can just disable the ctcp middleware for a
lighter experience. People can also easily add their on behavior to the library
with custom middleware.

We _try_ to follow the [Google Javascript Style Guide].

License
-------
MIT :-)

[build status]: https://secure.travis-ci.org/jslush/node-irc-stream.png "Travis CI - Continuous Integration"
[Google JavaScript Style Guide]: http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml "Learn to code like a pro."