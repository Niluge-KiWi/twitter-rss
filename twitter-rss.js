var config = require('config').twitterRss;

var client = require('twitter-api').createClient();
var async = require('async');

var express = require('express');
var app = express();

var RSS = require('rss');

// patch RSS
RSS_item = function (options, prepend) {
  options = options || {};
  var item = {
    title:          options.title || 'No title',
    description:    options.description || '',
    url:            options.url,
    guid:           options.guid,
    categories:     options.categories || [],
    author:         options.author,
    date:           options.date,
    enclosure:      options.enclosure || false
  };

  if (prepend)
    this.items.unshift(item)
  else
    this.items.push(item);
  return this;
};


client.setAuth(
  config.twitterApi.consumer.key,
  config.twitterApi.consumer.secret,
  config.twitterApi.access.key,
  config.twitterApi.access.secret
);

var users = {}; // indexed by screen_name

var addTweet = function (tweet, prepend) {
  if (prepend === undefined) prepend = true;

  var user = users[tweet.user.screen_name];
  if (! user)
    return;

  // update rss
  user.feed.item({
    title: user.infos.screen_name + ': ' + tweet.text,
    url: 'https://twitter.com/' + user.infos.screen_name + '/status/' + tweet.id,
    guid: 'https://twitter.com/' + user.infos.screen_name + '/status/' + tweet.id,
    date: tweet.created_at
  }, prepend);

  // limit tweets
  if (user.feed.items.length > config.tweetsLimit) { //TODO limit by time
    user.feed.items.splice(config.tweetsLimit, user.feed.items.length - config.tweetsLimit);
  }

  // invalidate xml cache
  user.xmlFeed = null;

  //TODO remove
  console.log('tweet', prepend, tweet.created_at, tweet.user.screen_name, tweet.text);
  //console.log('tweet', tweet);
  if (tweet.text && tweet.user) {
    console.log( user.infos.screen_name+': "'+tweet.text+'"');
  }
};

console.log('Bootstrapping...');
async.map(config.follow, function (screen_name, cb) {
  var user = users[screen_name] = {
    infos: {},
    feed: {},
    feedXml: null
  };
  async.series([ function (cb) { // get user infos (for user_id)
    client.get('users/show', { screen_name: screen_name }, function (userInfos, error, status) {
      user.infos = userInfos;
      cb(error ? status : null);
    });
  }, function (cb) { // create rss feed
    var now = new Date();
    user.feed = new RSS({
      title: user.infos.name + ' (@' + user.infos.screen_name + ') Twitter Timeline',
      description: user.infos.description,
      feed_url: 'http://example.com/rss.xml', //TODO better
      site_url: 'http://twitter.com/' + user.infos.name,
      image_url: user.infos.profile_image_url,
      author: user.infos.name + ' (@' + user.infos.screen_name + ')',
      language: user.infos.lang,
      pubDate: now.toString(), //TODO better
      ttl: '60' //TODO better
    });
    user.feed.item = RSS_item; // patch RSS
    cb();
  }, function (cb) { // get user last tweets
    client.get('statuses/user_timeline', { user_id: user.infos.id, count: config.tweetsLimit },function (tweets, error, status) {
      for (var i = 0; i < tweets.length; i++) {
        addTweet(tweets[i], false);
      }
      cb(error ? status : null);
    });
  }], function (err) {
    cb(err, user.infos.id);
  });
}, function(err, users_id) {
  if (err) {
    console.error('Error bootstrapping', err);
    return;
  }

  console.log('users_id', users_id);
  console.log('users', users);

  // ready to start listening
  app.listen(config.port);
  console.log('Listening on port', config.port);

  // and get new tweets in stream
  client.stream( 'statuses/filter', { follow: users_id.join(',') }, function( json ) {
    var tweet = JSON.parse( json );
    addTweet(tweet);
  });
});


app.get('/statuses/user_timeline/:screen_name.rss', function(req, res){
  var user = users[req.params.screen_name];
  if (! user) {
    res.status(404).send('User ' + req.params.screen_name + ' not registered');
    return;
  }

  if (! user.xmlFeed) {
    user.xmlFeed = user.feed.xml(true);
  }

  res.send(user.xmlFeed);
});
