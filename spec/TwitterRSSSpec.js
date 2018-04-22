var customMatchers = {
  toBeExtendedTweet: function(util, customEqualityTesters) {
    return {
      compare: function(tweet) {
        var result = { pass: tweet.full_text !== undefined && tweet.text === undefined };
        if(result.pass) {
          result.message =  "Expected tweet '" + tweet.id + "' *WITHOUT* 'full_text' and *WITH* 'text'";
        } else {
          result.message =  "Expected tweet '" + tweet.id + "' with 'full_text' and no 'text'";
        }
        return result;
      }
    };
  }
};

describe("Tweet", function() {
  var Tweet = require('../lib/Tweet');

  describe("toExtendedTweet", function() {

    beforeEach(function() {
      jasmine.addMatchers(customMatchers);
    });

    it("should be able to convert classic", function() {
      var tweet = new Tweet(require('./tweets/compatibilityplus_classic_13994.json'));
      expect(tweet).toBeExtendedTweet();
      expect(tweet.quoted_status).toBeExtendedTweet();
    });

    it("should be able to convert classic+extended", function() {
      var tweet = new Tweet(require('./tweets/compatibilityplus_classic_hidden_13797.json'));
      expect(tweet).toBeExtendedTweet();
      expect(tweet.quoted_status).toBeExtendedTweet();
    });

    it("should be able to convert extended", function() {
      var tweet = new Tweet(require('./tweets/compatibilityplus_extended_13997.json'));
      expect(tweet).toBeExtendedTweet();
      expect(tweet.quoted_status).toBeExtendedTweet();
    });

    it("should be able to convert RT extended", function() {
      var tweet = new Tweet(require('./tweets/retweet_w_replies+attachment.json'));
      expect(tweet).toBeExtendedTweet();
      expect(tweet.retweeted_status).toBeExtendedTweet();
    });

    it("should be able to convert Quoted extended", function() {
      var tweet = new Tweet(require('./tweets/quoted_w_attachment.json'));
      expect(tweet).toBeExtendedTweet();
      expect(tweet.quoted_status).toBeExtendedTweet();
    });
  });
});
