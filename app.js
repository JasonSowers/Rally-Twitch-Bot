var express = require('express');
const cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request = require('request');
const crypto = require('crypto');
const dotenv = require('dotenv');
const cors = require("cors");
const NodeCache = require("node-cache");
const tmi = require('tmi.js');

// const PutItemCommand = require("@aws-sdk/client-dynamodb").PutItemCommand;
// const DynamoDBClient = require("@aws-sdk/client-dynamodb").DynamoDBClient;
// const GetItemCommand = require("@aws-sdk/client-dynamodb").GetItemCommand;
// const REGION = "us-east-1"; //e.g. "us-east-1"
// const ddbClient = new DynamoDBClient({ region: REGION });

const port = process.env.PORT || 3000;

const url = require('url');
const { authorize, basicUserInfo, hodlers, creatorCoins, initiate_tx, getUserBalances } = require("./utils/rally.js");
const { getCreators, insertEntity, getUserByTwitchId, getCreatorsTwitchIds, getBotsByChannel } = require("./utils/tableStorage.js");
const { airdrop, getClient, addBot, donate, tip } = require("./utils/bot.js");
const { IndexNotFoundException } = require('@aws-sdk/client-dynamodb');
//const { GlobalTableAlreadyExistsException } = require('@aws-sdk/client-dynamodb');

dotenv.config();

const buffer = crypto.randomBytes(16);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const SESSION_SECRET = buffer.toString('hex');
const TWITCH_CALLBACK_URL = process.env.TWITCH_CALLBACK_URL == "" ? "https://rallytwitchbot.com/auth/twitch/code" : process.env.TWITCH_CALLBACK_URL; // You can run locally with - http://localhost:8080/auth/twitch/callback

const bot_cache = new NodeCache();
// Initialize Express and middlewares
var app = express();
app.use(cookieParser(process.env.COOKIE_SIGNATURE));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());


let coin_list = [];
let creator_coins = [];
async function getCreatorCoins() {
  creator_coins = await creatorCoins()
};
getCreatorCoins();
let twitch_channels = [];

async function getCreatorChannels() {
  twitch_channels = await getCreators()
}






OAuth2Strategy.prototype.userProfile = function (accessToken, done) {
  var options = {
    url: 'https://api.twitch.tv/helix/users',
    method: 'GET',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Accept': 'application/vnd.twitchtv.v5+json',
      'Authorization': 'Bearer ' + accessToken
    }
  };

  request(options, function (error, response, body) {
    if (response && response.statusCode == 200) {
      done(null, JSON.parse(body));
    } else {
      done(JSON.parse(body));
    }
  });
}

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

passport.use('twitch', new OAuth2Strategy({
  authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
  tokenURL: 'https://id.twitch.tv/oauth2/token',
  clientID: TWITCH_CLIENT_ID,
  clientSecret: TWITCH_SECRET,
  callbackURL: TWITCH_CALLBACK_URL,
  state: true
},
  async function (accessToken, refreshToken, profile, done) {
    console.log("twitch-complete");
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;
    const twitch_id = profile.data[0].id;
    const saved = bot_cache.set(twitch_id, JSON.stringify({
      login_name: profile.data[0].login,
      display_name: profile.data[0].display_name,
      twitch_id: twitch_id
    }));
    console.log("saved id 2");
    done(null, profile);
  }
));

// This is the way to authorize the bot application on the bot account
// app.get('/auth/twitch/bot', cors(), passport.authenticate('twitch', {
//   scope: [
//     "user_read",
//     "user:edit:follows",
//     "user:read:follows",
//     "chat:read",
//     "chat:edit",
//     "channel:moderate",
//     "whispers:read",
//     "whispers:edit"
//   ]
// }));

app.get('/auth/twitch', passport.authenticate('twitch', { scope: [] }));

app.get('/auth/twitch/creator', (req, res, next) => {
  const bot_id = req.signedCookies.bot_id;
  if (bot_id) {
    const rally_data = JSON.parse(bot_cache.get(bot_id));
    rally_data.donation_alerts = req.query.donations;
    rally_data.transaction_alerts = req.query.transactions;
    rally_data.buy_alerts = req.query.buy;
    const set_alerts = bot_cache.set(bot_id, JSON.stringify(rally_data));
    if (set_alerts) {
      next()
    }
  }
})

app.get('/auth/twitch/creator', passport.authenticate('twitch', { scope: ["channel:moderate"] }))

app.get("/user-complete", async function (req, res, next) {
  console.log("user-complete");
  const bot_id = req.signedCookies.bot_id;
  const bot_id_2 = req.signedCookies.bot_id_2;

  if (bot_id && bot_id_2) {
    const rally_data = JSON.parse(bot_cache.get(bot_id));
    const twitch_data = JSON.parse(bot_cache.get(bot_id_2));
    if (rally_data && twitch_data) {
      try {
        insertEntity(rally_data, twitch_data);
        if (rally_data.is_creator) {
          twitch_channels.push(twitch_data.login_name);
        }
        res.redirect('https://www.twitch.tv/rallytwitchbot');
      } catch (err) {
        console.log(err);
      }
    }
  }
  console.log("user-complete-end");
  res.redirect('./public/cancelled');
})



app.get("/user", function (req, res, next) {
  res.cookie("bot_id_2", req.user.data[0].id, { signed: true });
  res.sendFile('public/user.html', { root: __dirname });
})

app.get('/auth/twitch/code', passport.authenticate('twitch', { successRedirect: '/user', failureRedirect: '/cancelled' }));

app.get("/cancelled", function (req, res, next) {
  console.log("cancelled");
  res.sendFile('public/cancelled.html', { root: __dirname })
})

app.get("/creator", function (req, res, next) {
  res.sendFile('public/creator.html', { root: __dirname });
});

app.get("/commands", function (req, res, next) {
  res.sendFile('public/commands.html', { root: __dirname });
});

app.get("/twitch", function (req, res, next) {
  const bot_id = req.signedCookies.bot_id;
  if (bot_id) {
    const rally_data = JSON.parse(bot_cache.get(bot_id));
  }
  console.log("twitch");
  if (rally_data.is_creator == "true") {
    res.sendFile('public/creator.html', { root: __dirname });
  }
  res.sendFile('public/twitch.html', { root: __dirname })
})

app.get("/rally", async function (req, res, next) {
  console.log("rally");
  res.sendFile('public/rally.html', { root: __dirname })
})

app.get("/rally-auth", function (req, res, next) {
  console.log("rally-auth");
  res.sendFile('public/rally-auth.html', { root: __dirname })
})

app.get("/auth", async function (req, res, next) {

  const split1 = req.url.split("?")[1];
  const split2 = split1.split("&");
  const code = split2[0].split("=")[1];
  const state = split2[1].split("=")[1];

  if (code == 'cancelled') {
    res.redirect("/cancelled");
  }
  try {
    var info = await basicUserInfo(code);
    const bot_id = crypto.randomBytes(16).toString('hex');
    var tempIdArr = info.rnbUserId.split('-');
    var tempId = tempIdArr.join('');
    const creator = creator_coins.filter(coin => {
      return coin.rnbUserId == tempId;
    });
    var user_data = {}
    if (creator.length > 0) {
      user_data = {
        rally_id: info.rnbUserId,
        rally_username: info.username,
        is_creator: "true",
        coin: creator[0].coinSymbol,
        donation_alerts: "off",
        transaction_alerts: "off",
        buy_alerts: "off"
      }
    } else {
      user_data = {
        rally_id: info.rnbUserId,
        rally_username: info.username,
        is_creator: "false",
        coin: "NONE",
        donation_alerts: "off",
        transaction_alerts: "off",
        buy_alerts: "off"
      }
    }
    const set_id = bot_cache.set(bot_id, JSON.stringify(user_data));
    if (set_id) {
      res.cookie("bot_id", bot_id, { signed: true });
      if (user_data.is_creator == "true") {
        res.sendFile('public/creator.html', { root: __dirname });
        return;
      }
      res.sendFile('public/twitch.html', { root: __dirname });
      return;
    } else {
      res.sendFile('public/cancelled.html', { root: __dirname });
      return;
    }
  }
  catch (err) {
    console.log(err);
  }
})

app.get("/auth/rally", async function (req, res, next) {
  console.log("twitch-complete");
  try {
    const state = crypto.randomBytes(10).toString('hex');
    const url_response = await authorize(state);
    const redirect_url = new URL(url_response.url);
    res.redirect(redirect_url);
  } catch (err) {
    res.redirect("/public/error")
  }
})

app.post("/webhooks", function (req, res, next) { 
  // for sending alerts if needed 
  res.send();
})

app.get("/price", function (req, res, next) {
 // future implementation
})


getClient().then(async (result) => {
  await getCreatorCoins();
  creator_coins.forEach((coin) => {
    coin_list.push(coin.coinSymbol)
  })
  client = await getClient();
  client.connect();
  let airdrop_queue = {}
  client.on('message', async (channel, tags, message, self) => {
    if (self) {
      return;
    }
    if (channel != tags['username'] && tags.username.toLowerCase() != "rallytwitchbot" && !message.startsWith("$")) {
      if (airdrop_queue[channel]) {
        if (airdrop_queue[channel].includes(tags['username'])) {
          for (var i = 0; i < airdrop_queue[channel].length; i++) {
            if (airdrop_queue[channel][i] == tags['username']) {
              airdrop_queue[channel].splice(i, 1);
            }
          }
        }
        airdrop_queue[channel].push(tags['username']);
        if (airdrop_queue[channel].length > 50) {
          airdrop_queue[channel].shift();
        }
      } else {
        airdrop_queue[channel] = []
        airdrop_queue[channel].push(tags['username'])
      }
    }

    if(!message.startsWith("$")){
      return
    }

    const args = message.replace("@", "").split(' ');
    const command = args.shift().toLowerCase();

    if (command == "$bot") {
      if (channel != `#${tags.username}`) {
        return;
      }
      const bot_list = args
      await addBot(bot_list, channel);
      bot_cache.set(`${channel}_bots`, JSON.stringify(getBotsByChannel(channel)));
    }

    if (command == "$command" || command == "$commands") {
      if (bot_cache.get(channel + "commands")) {
        return;
      }
      bot_cache.set(channel + "commands", "commands", 30);
      client.say(channel, "Bot commands for RallyTwitchBot can be found at https://rallytwitchbot.com/commands");
      return;
    }

    if (command == "$coin") {
      if (bot_cache.get(channel)) {
        return;
      }
      bot_cache.set(channel, "cooldown", 30);
      client.say(channel, "Register with RallyTwitchBot at https://rallytwitchbot.com");
      return;
    }

    if (command == "$airdrop") {
      airdrop(channel, tags, args, client, airdrop_queue[channel], coin_list);
    }

    if (command == "$donate" || command == "$tip") {
      donate(tags, args, client, coin_list, channel);
    }

    if (command == "$send") {
      tip(tags, args, client, coin_list, channel);
    }
  })
})

app.listen(port, function () {

  console.log('Twitch auth sample listening on port 3000!')
});


