const fetch = require("node-fetch");
const dotenv = require('dotenv');
const axios = require("axios");
const { response } = require("express");
const NodeCache = require("node-cache");
dotenv.config();

const token_cache = new NodeCache();
const register_url = `https://api.rally.io/v1/oauth/register`;
const register_body = {
    password: process.env.PASSWORD,
    username: process.env.RALLY_USERNAME
}
const authorize_url = "https://api.rally.io/v1/oauth/authorize";
const authorize_body = {
    callback: "https://rallytwitchbot.com/auth",
    state: ""
}

const basic_user_info_url = "https://api.rally.io/v1/oauth/userinfo"

const tx_url = "https://api.rally.io/v1/transactions/transfer/initiate"



async function initiate_tx(tx_body) {
    try {
        const token = await getToken();
        const response = await axios.post(tx_url, tx_body,
            {
                headers: {
                    'Authorization': token
                }
            })
        return response.data;
    } catch (err) {
        console.log(err);
        return false;
    }

    //RESPONSE
    //{ "url": "<url>" }
}

async function getUserBalances(id) {
    try {
        const token = await getToken();
        const response = await axios.get(`https://api.rally.io/v1/users/rally/${id}/balance`,
            {
                headers: {
                    'Authorization': token
                }
            })
        return response.data;
    } catch (err) {
        console.log(err);
        return false;
    }
}



async function getToken() {
    let token = token_cache.get("token");
    if(token){
        return token;
    }
    await refreshToken(token_cache.get("refresh_token"));
    token = token_cache.get("token");
    if(token){
        return token;
    }
    await tokenCall();
    token = token_cache.get("token");
    if(token){
        return token;
    }

}

async function tokenCall() {
         try {
        const response = await axios.post(register_url, register_body);
        token_cache.set("token", `${response.data.token} ${response.data.access_token}`, response.data.expires_in - 100);
        token_cache.set("refresh_token", response.data.refresh_token);        
    } catch (err) {
        console.log(err);
     }
    
   
}

async function refreshToken(refresh_token) {
    if(token_cache.get("access_token")){    
    try {
        const response = await axios.post(`https://api.rally.io/v1/oauth/refresh&refresh_token=${refresh_token}`)
        token_cache.set(token, `${response.data.token_type} ${response.data.access_token}`, response.data.expires_in - 100);        
    } catch (err) {
        console.log(err); 
    }
    
}
}

async function authorize(state) {
    try {
        authorize_body.state = state
        const token = await getToken();
        const response = await axios.post(`${authorize_url}`, authorize_body,
            {
                headers: {
                    'Authorization': token
                }
            })
        return response.data;
    } catch (err) { 
        console.log(err)
        return false;
    }

    //RESPONSE
    //{ "url": "<url>" }
}

async function creatorCoins() {
    try {
        const response = await axios.get("https://api.rally.io/v1/creator_coins");
        return response.data
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function hodlers() {
    var token = await getToken();
    try {
        const response = await axios.get("https://api.rally.io/v1/creators/top_holders_and_transactions?rnbUserId=b48bb749-9da2-11eb-b100-b2530e558bed&symbol=WUX&timePeriod=ALL",
            {
                headers: {
                    'Authorization': token
                }
            })
        return response.data
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function basicUserInfo(code) {
    try {
        authorize_body.code = code;
        const response = await axios.post(basic_user_info_url, authorize_body,
            {
                headers: {
                    'Authorization': await getToken(),
                    'code': code
                }
            })
        return response.data;
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function fullUserInfo(token) {
    try {
        const response = await axios.post("https://api.rally.io/v1/users/rally/72245f0c-ce6f-11eb-b4fe-2ee2c5125ebe/userinfo", {},
            {
                headers: {
                    'Authorization': token
                }
            })
        return response.data
    } catch (err) {
 
    }
}


module.exports = {
    getToken,
    refreshToken,
    authorize,
    basicUserInfo,    
    hodlers,
    creatorCoins,
    initiate_tx,
    getUserBalances
}
