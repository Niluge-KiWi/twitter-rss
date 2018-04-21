var config = require('config').twitterRss;
var util = require('util');

var client = require('twitter-api').createClient();
var async = require('async');

var express = require('express');
var app = express();
var auth = express.basicAuth(config.admin.username, config.admin.password);

var OPML = require('./lib/opml');
var Tweet = require('./lib/Tweet');

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
    this.items.unshift(item);
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
  //TODO configure
  // console.log('tweet_full_original', util.inspect(tweet, {depth: 100}));

  Tweet.convert2ExtendedTweet(tweet);

  // console.log('tweet_full_extended', util.inspect(tweet, {depth: 100}));

  if (tweet.delete) {
    //console.log('Ignored special tweet: delete', util.inspect(tweet, {depth: 100}));
    return;
  }

  if (! tweet.user) {
    console.error('Invalid tweet, missing user', util.inspect(tweet, {depth: 100}));
    return;
  }

  var user = users[tweet.user.screen_name];
  if (! user)
    return;

  // improve feed content
  if (tweet.retweeted_status) {
    Tweet.convert2ExtendedTweet(tweet.retweeted_status);
    // full text on RT
    tweet.full_text = 'RT @' + tweet.retweeted_status.user.screen_name + ': ' + tweet.retweeted_status.full_text;
  }
  tweet.description = tweet.full_text;
  if (tweet.quoted_status) {
    Tweet.convert2ExtendedTweet(tweet.quoted_status);
    tweet.description += '<br/>Quote @' + tweet.quoted_status.user.screen_name + ': ' + tweet.quoted_status.full_text;
  }
  // clickable urls
  var urlPattern = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
  tweet.description = tweet.description.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');

  // update rss
  user.feed.item({
    title: user.infos.screen_name + ': ' + tweet.full_text,
    description: user.infos.screen_name + ': ' + (tweet.description || tweet.full_text),
    url: 'https://twitter.com/' + user.infos.screen_name + '/status/' + tweet.id_str,
    date: tweet.created_at
  }, prepend);

  // limit tweets
  if (user.feed.items.length > config.tweetsLimit) { //TODO limit by time
    user.feed.items.splice(config.tweetsLimit, user.feed.items.length - config.tweetsLimit);
  }

  // invalidate xml cache
  user.xmlFeed = null;

  //TODO configure
  // console.log('tweet', prepend, tweet.created_at, tweet.user.screen_name, tweet.full_text);
  // if (tweet.full_text && tweet.user) {
  //   console.log( user.infos.screen_name+': "'+tweet.full_text+'"');
  // }
};

var getUrl = function(screen_name) {
  return config.baseUrl + '/statuses/user_timeline/' + screen_name + '.rss';
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
      cb(error);
    });
  }, function (cb) { // create rss feed
    user.feed = new RSS({
      title: user.infos.name + ' (@' + user.infos.screen_name + ') Twitter Timeline',
      description: user.infos.description,
      feed_url: getUrl(user.infos.screen_name),
      site_url: 'http://twitter.com/' + user.infos.screen_name,
      image_url: user.infos.profile_image_url,
      author: user.infos.name + ' (@' + user.infos.screen_name + ')',
      language: user.infos.lang
    });
    user.feed.item = RSS_item; // patch RSS
    cb();
  }, function (cb) { // get user last tweets
    client.get('statuses/user_timeline', { user_id: user.infos.id, count: config.tweetsLimit, tweet_mode: 'extended' },function (tweets, error, status) {
      for (var i = 0; i < tweets.length; i++) {
        addTweet(tweets[i], false);
      }
      cb(error ? status : null);
    });
  }], function (err) {
    cb(err, err ? null : user.infos.id);
  });
}, function(err, users_id) {
  if (err) {
    console.error('Error bootstrapping', err);
    return;
  }

  console.log('users_id', users_id);
  console.log('users', users);

  // ready to start listening
  var server = app.listen(config.port);
  console.log('Listening on port', config.port);

  var returnCode = 0;
  server.on('close', function() {
    console.error('Server closed, exit with return code', returnCode);
    process.exit(returnCode);
  });

  // and get new tweets in stream
  client.stream( 'statuses/filter', { follow: users_id.join(',') }, function(json, err) {
    if (err) {
      console.error('stream error', err);
      // auto reconnect: use systemd!
      returnCode = 1;
      server.close();
      return;
    }
    var tweet = JSON.parse( json );
    if (tweet.disconnect) {
      console.error('stream disconnected', tweet);
      // auto reconnect: use systemd!
      returnCode = 2;
      server.close();
      return;
    }
    addTweet(tweet, true);
  });
});


app.get('/statuses/user_timeline/:screen_name.rss', function(req, res){
  var user = users[req.params.screen_name];
  if (! user) {
    res.status(404).send('User ' + req.params.screen_name + ' not registered');
    return;
  }

  if (! user.xmlFeed) {
    var now = new Date();
    user.feed.pubDate = now.toString();
    user.xmlFeed = user.feed.xml(true);
  }

  res.setHeader('Content-Type', 'application/rss+xml');
  res.send(user.xmlFeed);
});

app.get('/admin/list', auth, function(req, res){
  var body = '';
  config.follow.forEach(function (screen_name) {
    body += getUrl(screen_name) + '<br/>';
  });
  res.send(body);
});

app.get('/admin/opml', auth, function(req, res){
  var opml = new OPML({ title: 'Twitter RSS feeds' });
  var outline = opml.outline({ text: 'Twitter' });
  config.follow.forEach(function (screen_name) {
    var user = users[screen_name];
    outline.outline({
      text: user.feed.title,
      title: user.feed.title,
      type: 'rss',
      htmlUrl: user.feed.site_url,
      xmlUrl: user.feed.feed_url
    });
  });

  res.type('xml');
  res.send(opml.xml(true));
});
