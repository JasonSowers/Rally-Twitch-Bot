var azure = require('azure-storage');
var azureTS = require('azure-table-storage-async');
var tables = azure.createTableService(process.env.TABLE_ACCOUNT, process.env.TABLE_KEY);

//     twitch_id: { S: twitch_data.twitch_id },
//     rally_id: { S: rally_data.rally_id },
//     rally_username: { S: rally_data.rally_username },
//     is_creator: { S: rally_data.is_creator },
//     coin: { S: rally_data.coin },
//     twitch_username: { S: twitch_data.login_name.toLowerCase() },
//     donation_alerts: { S: rally_data.donation_alerts },
//     transaction_alerts: { S: rally_data.transaction_alerts },
//     buy_alerts: { S: rally_data.buy_alerts }
const generateEntity = (rally_data, twitch_data) => {
    var entGen = azure.TableUtilities.entityGenerator;
    var partition_key = "user";
    if (rally_data.is_creator == "true") {
        partition_key = "creator";
    }

    var entity = {
        RowKey: entGen.String(twitch_data.twitch_id),
        PartitionKey: entGen.String(partition_key),
        twitch_id: entGen.String(twitch_data.twitch_id),
        rally_id: entGen.String(rally_data.rally_id),
        rally_username: entGen.String(rally_data.rally_username),
        is_creator: entGen.String(rally_data.is_creator),
        coin: entGen.String(rally_data.coin),
        twitch_username: entGen.String(twitch_data.login_name.toLowerCase()),
        donation_alerts: entGen.String(rally_data.donation_alerts),
        transaction_alerts: entGen.String(rally_data.transaction_alerts),
        buy_alerts: entGen.String(rally_data.buy_alerts)
    }
    return entity;
}

const insertEntity = (rally_data, twitch_data) => {
    var entity = generateEntity(rally_data, twitch_data);
    tables.insertOrReplaceEntity('users', entity, function (error, result, response) {
        if (!error) {
            if (entity.RowKey == "creator") {
                var creator_channel = {
                    PartitionKey: entGen.String(twitch_data.twitch_id),
                    RowKey: entGen.String(twitch_data.twitch_username)
                }
                if (insertCreator(creator_channel)) {
                    return true;
                }
            }
            return true
        }
        var entGen = azure.TableUtilities.entityGenerator;
        var error_entity = JSON.stringify({
            twitch_data: entGen.String(twitch_data),
            rally_data: rally_data,
            error: error
        })
        tables.insertError('logs', error_entity)
        return false;
    })
};

const insertError = (error_entity) => {
    tables.insertOrReplaceEntity('logs', entity, function (error, result, response) {
        return true;
    })
}

const insertBot = async (channel_name, botList) => {
    bots_added =[];
    const bot_list = [].concat(botList);
    channel_name = channel_name.replace("#", "");
    var entGen = azure.TableUtilities.entityGenerator;
    for(i=0; i<bot_list.length;i++) {
        var entity = {
            RowKey: entGen.String(`${bot_list[i]}_${channel_name}`),
            PartitionKey: entGen.String(channel_name),
            channel_name: entGen.String(channel_name),
            bot_name: entGen.String(bot_list[i])
        }
        try{
            await azureTS.insertOrReplaceEntityAsync(tables, "bots", entity);
            bots_added.push(bot_list[i]);
        }catch(err){
            console.log(err);
        }
    }
    return bots_added;
}

const insertCreator = (entity) => {
    tables.insertOrReplaceEntity('creatorchannels', entity, function (error, result, response) {
        if (!error) {
            return true
        }
        var entGen = azure.TableUtilities.entityGenerator;
        var error_entity = {
            data: entGen.String(JSON.stringify({
                twitch_data: twitch_data,
                rally_data: rally_data,
                error: error
            }))
        }

        insertError('logs', error_entity, function (error, result, response) {
            return false;
        });
        return false;
    })
}

const getBotsByChannel = async (channel_name) => {
    channel_name = channel_name.replace("#", "");
    var query = new azure.TableQuery()
        .select(['bot_name'])
        .where('PartitionKey eq ?', channel_name);
    var bots = [];
    var result = await azureTS.queryEntitiesAsync(tables, "bots", query);

    result.entries.forEach(entry => {
        bots.push(entry.bot_name._);
    });
    return bots;
}

const getCreatorsTwitchUsernames = async () => {
    var query = new azure.TableQuery()
        .select(['twitch_username'])
        .where('PartitionKey eq ?', 'creator');
    var ids = []
    var result = await azureTS.queryEntitiesAsync(tables, "users", query);

    result.entries.forEach(entry => {
        ids.push(entry.twitch_username._);
    });
    return ids;
}

const getCreatorsTwitchIds = async () => {
    var query = new azure.TableQuery()
        .select(['twitch_id'])
        .where('PartitionKey eq ?', 'creator');
    var ids = []
    var result = await azureTS.queryEntitiesAsync(tables, "users", query);

    result.entries.forEach(entry => {
        ids.push(entry.twitch_id._);
    }
    );
    return ids;
}

const getUserByTwitchId = async (twitchId, type) => {
    try {
        var result = await azureTS.retrieveEntityAsync(tables, 'users', type, twitchId);
        return result;
    } catch (err) {
        var result2 = await azureTS.retrieveEntityAsync(tables, 'users', "creator", twitchId);
        return result2;
    }

}

module.exports = {
    insertEntity,
    getCreators: getCreatorsTwitchUsernames,
    getUserByTwitchId,
    getCreatorsTwitchIds,
    insertBot,
    getBotsByChannel
}