const tmi = require('tmi.js');
const { initiate_tx, getUserBalances } = require("./rally.js");
const { getCreators, getUserByTwitchId, getCreatorsTwitchIds, insertBot, getBotsByChannel } = require("./tableStorage.js");
const axios = require("axios");

const getClient = async () => {
    let client;
    twitch_channels = await getCreators();
    client = new tmi.Client({
        options: { debug: true },
        connection: {
            secure: true,
            reconnect: true
        },
        identity: {
            username: process.env.TWITCH_USERNAME,
            password: process.env.TWITCH_OAUTH_TOKEN
        },
        channels: twitch_channels
    });
    return client;
}

const addBot = async (channel, bot_list) => {
    const bots = await insertBot(bot_list, channel);
    return bots;
}

const airdrop = async (channel, tags, args, client, airdrop_queue, coin_list) => {
    let amount;
    let rain_number;
    let coin;
    let sender_id;
    let usd;
    let has_funds;

    if (airdrop_queue.includes(tags.username)) {
        airdrop_queue = airdrop_queue.filter(user =>
            user != tags.username
        )
    }

    console.log("remove airdropper:" + airdrop_queue.join(", "));
    var bots = await getBotsByChannel(channel);
    if (bots && bots.length > 0) {
        for (var b = 0; b < bots.length; b++) {
            if (airdrop_queue.includes(bots[b].toLowerCase())) {
                airdrop_queue = airdrop_queue.filter(bot =>
                    bot != bots[b]
                )
            }
        }
    }

    if (args[0]) {
        amount = Number(args[0]);
        if (amount <= 0) {
            client.say(channel, `@${tags["username"]} invalid amount`);
        }
    }

    else {
        client.say(channel, `@${tags["username"]} the command was not given correctly`);
        return;
    }

    if (args[2]) {
        rain_number = Number(args[2]);
        rain_number = parseInt(rain_number);
        if (rain_number <= 0) {
            client.say(channel, `@${tags["username"]} the number of people you are trying to rain on is not valid`);
        }
    }else {
        client.say(channel, `@${tags["username"]} the number of people you are trying to rain on is not valid`);
        return;
    }

    if (args[1].replace("$", "") && coin_list.includes(args[1].toUpperCase())) {
        coin = args[1].replace("$", "").toUpperCase();
    } else {
        client.say(channel, `@${tags["username"]} invalid coin`);
        return;
    }

    sender_id = await getSenderRallyId(tags);
    if (sender_id) {
        has_funds = await check_holdings(amount, sender_id, coin);
    } else {
        client.say(channel, `@${tags["username"]} please register at https://twitchrallybot.com`);
    }

    if (args[3] && args[3].toLowerCase() == "usd") {
        usd = args[3];
    }

    if (has_funds) {
        var airdropped_crew = []
        try {
            var twitch_ids = await getTwitchIds(airdrop_queue);
            var registeredUserList = await makeRegisteredUserList(twitch_ids, sender_id);
            registeredUserList.forEach(us => {
                console.log(JSON.stringify(us));
            })
            let number;

            if (rain_number <= registeredUserList.length) {
                number = rain_number;
            } else {
                number = registeredUserList.length;
            }

            if (number > 10) {
                number = 10
            }

            if (number == 0) {
                client.say(channel, `@${tags.username} There is no registered chatters in the airdrop queue`);
            }
            amount = amount / number


            amount = amount.toFixed(8);
            var input = "COINS"
            if (usd) {
                input = "USD"
            }

            for (var j = 0; j < number; j++) {
                let body = {};
                body.referenceData = "Sent via RallyTwitchBot";
                body.fromRnbUserId = sender_id;
                body.amount = amount;
                body.coinKind = coin;
                body.inputType = input;
                body.toRnbUserId = registeredUserList[j].rally_id;
                const tx_response = await initiate_tx(body);
                airdropped_crew.push(registeredUserList[j].twitch_username)
            }
            client.say(channel, `@${tags.username} just airdropped on @${airdropped_crew.join(", @")}`);
        } catch (err) {
            console.log(err);
            client.say(channel, `@${tags.username} failed, something went wrong`);
        }

    }else{
        client.say(channel, `@${tags.username} failed, check your wallet`);
    }



}

const donate = async (tags, args, client, coin_list, channel) => {
    let amount;
    let coin;
    if (args[0]) {
        amount = Number(args[0]);
        if (amount <= 0) {
            client.say(channel, `@${tags["username"]} invalid amount`);
        }
    }
    else {
        client.say(channel, `@${tags["username"]} the command was not given correctly`);
        return;
    }

    if (args[1].replace("$", "") && coin_list.includes(args[1].toUpperCase())) {
        coin = args[1].replace("$", "").toUpperCase();

    } else {
        client.say(channel, `@${tags["username"]} invalid coin`);
        return;
    }
    sender_id = await getSenderRallyId(tags);
    if (sender_id) {
        has_funds = await check_holdings(amount, sender_id, coin);
    } else {
        client.say(channel, `@${tags["username"]} something went wrong, please register at https://twitchrallybot.com if you haven't already`);
        return;
    }
    if (!has_funds) {
        `@${tags["username"]} check your balance and try again`
        return;
    }

    let usd;
    try {
        if (args[2] && args[2].toLowerCase() == "usd") {
            usd = "usd";
        }

        let input = "COINS";
        if (usd) {
            input = "USD";
        }
        let body = {};
        body.referenceData = "Sent via RallyTwitchBot";
        body.fromRnbUserId = sender_id;
        body.amount = amount;
        body.coinKind = coin;
        body.inputType = input;

        const tx_response = await initiate_tx(body);
        client.say(channel, `@${tags.username} success, approve the transaction(s) in your email`);
        return;
    } catch (err) {
        client.say(channel, `@${tags.username} something went wrong`);
        return;
    }
}

const tip = async (tags, args, client, coin_list, channel) => {
    let amount;
    let coin;
    let receiver_id;

    if (args[1]) {
        amount = Number(args[1]);
        if (amount <= 0) {
            client.say(channel, `@${tags["username"]} invalid amount`);
        }
    }
    else {
        client.say(channel, `@${tags["username"]} the command was not given correctly`);
        return;
    }

    if (args[2].replace("$", "") && coin_list.includes(args[2].toUpperCase())) {
        coin = args[2].replace("$", "").toUpperCase();

    } else {
        client.say(channel, `@${tags["username"]} invalid coin`);
        return;
    }
    sender_id = await getSenderRallyId(tags);
    if (sender_id) {
        has_funds = await check_holdings(amount, sender_id, coin);
    } else {
        client.say(channel, `@${tags["username"]} something went wrong, please register at https://twitchrallybot.com if you haven't already`);
        return;
    }

    if (!has_funds) {
        `@${tags["username"]} check your balance and try again`
        return;
    }

    try {
        var creator_list = await getCreators();
        var creatorCheck1 = creator_list.includes(args[0]);
        var user_type = "user";
        if (creatorCheck1) {
            user_type = "creator"
        }
        let ids = [];
        ids.push(args[0])
        let twitch_ids = await getTwitchIds(ids)
        const receiver = await getUserByTwitchId(twitch_ids[0], user_type);
        receiver_id = receiver.rally_id._;

    } catch (err) {
        console.log(err);
        client.say(channel, `@${tags.username} something went wrong`);
    }

    let usd;
    try {
        if (args[3] && args[3].toLowerCase() == "usd") {
            usd = "usd";
        }

        let input = "COINS";
        if (usd) {
            input = "USD";
        }
        let body = {};
        body.referenceData = "Sent via RallyTwitchBot";
        body.fromRnbUserId = sender_id;
        body.amount = amount;
        body.coinKind = coin;
        body.inputType = input;
        body.toRnbUserId = receiver_id;

        const tx_response = await initiate_tx(body);
        client.say(channel, `@${tags.username} success, approve the transaction(s) in your email`);
        return;
    } catch (err) {
        client.say(channel, `@${tags.username} something went wrong`);
        return;
    }
}


const getSenderRallyId = async (tags) => {
    var creator_list = await getCreators();
    var creatorCheck1 = creator_list.includes(tags.username);
    var user_type1 = "user";
    if (creatorCheck1) {
        user_type1 = "creator"
    }

    try {
        const sender = await getUserByTwitchId(tags["user-id"], user_type1);
        sender_id = sender.rally_id._;
        return sender_id;
    } catch (err) {
        client.whisper(tags.username, "You may not be registered, please visit https://rallytwitchbot.com to register");
        return;
    }
}

const check_holdings = async (amount, sender_id, coin) => {
    const holdings = await getUserBalances(sender_id)
    const balance_details = holdings.filter((current_coin) => {
        return current_coin.coinKind.toLowerCase() == coin.toLowerCase();
    });
    let has_funds = false
    if (amount <= Number(balance_details[0].coinBalance)) {
        has_funds = true;
    }
    return has_funds;
}

const getTwitchIds = async (user_list) => {
    var logins = user_list.join("&login=");
    var config = {
        method: 'get',
        url: `https://api.twitch.tv/helix/users?login=${logins}`,
        headers: {
            "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
            "Client-Id": process.env.TWITCH_CLIENT_ID
        }
    };

    let airdrop_twitch_ids = [];
    await axios(config)
        .then(async function (response) {
            response.data.data.forEach(user => {
                airdrop_twitch_ids.push(user.id);
            });
        });
    return airdrop_twitch_ids;
}

const makeRegisteredUserList = async (user_list, sender_id) => {
    const creators = await getCreatorsTwitchIds();
    let rally_ids = [];
    for (var u = 0; u < user_list.length; u++) {
        if (user_list[u] != sender_id) {
            var user_type = "user";
            if (creators.includes(user_list[u])) {
                user_type = "creator"
            }
            try {
                const receiver = await getUserByTwitchId(user_list[u], user_type);
                if (receiver) {
                    rally_ids.push({
                        rally_id: receiver.rally_id._,
                        twitch_username: receiver.twitch_username._
                    });
                }
            } catch (err) {
                console.log(err);
            }
        }
    }
    return rally_ids;
}

module.exports = {
    airdrop,
    getClient,
    addBot,
    donate,
    tip
}
