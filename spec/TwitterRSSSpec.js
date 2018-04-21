describe("Tweet", function() {
  var Tweet = require('../lib/Tweet');

  it("should be able to convert classic", function() {
    var tweet = require('./tweets/compatibilityplus_classic_13994.json');
    Tweet.convert2ExtendedTweet(tweet);
    expect(tweet.full_text).toBeDefined();
    expect(tweet.text).toBeUndefined();
  });
  
  it("should be able to convert classic+extended", function() {
    var tweet = require('./tweets/compatibilityplus_classic_hidden_13797.json');
    Tweet.convert2ExtendedTweet(tweet);
    expect(tweet.full_text).toBeDefined();
    expect(tweet.text).toBeUndefined();
  });
  
  it("should be able to convert extended", function() {
    var tweet = require('./tweets/compatibilityplus_extended_13997.json');
    Tweet.convert2ExtendedTweet(tweet);
    expect(tweet.full_text).toBeDefined();
    expect(tweet.text).toBeUndefined();
  });
});
