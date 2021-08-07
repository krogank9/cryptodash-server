var http = require('follow-redirects').http;
var fs = require('fs');
const GraphsCache = require('./src/graphs/graphs-cache')

process.chdir('../cryptodash-client');

// Rss feed

http.get({host: "cointelegraph.com", port: 80, path: '/editors_pick_rss'}, function (res) {
    console.log("Got response: " + res.statusCode);

    let allChunks = ""

    res.on('data', function (chunk) {
        allChunks += chunk
        fs.writeFile("static_data/crypto_rss.xml", allChunks, function (err) {
            if (err) return console.log(err);
            console.log(`rss > "static_data/crypto_rss.xml"`);
        });
      });
}).on('error', function (e) {
    console.log("Got error: " + e.message);
});

// Market data

let marketDataChunks = ""
let marketDataReceived = false

http.get({host: "api.coingecko.com", port: 80, path: '/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=price_change_percentage'}, function (res) {
    console.log("Got response: " + res.statusCode);

    res.on('data', function (chunk) {
        marketDataChunks += chunk
        fs.writeFile("static_data/coins_markets_list.json", marketDataChunks, function (err) {
            if (err) return console.log(err);
            console.log(`coins market data > "static_data/coins_markets_list.json"`);
        });
      });
    res.on('close', function() {
        marketDataReceived = true
    })
}).on('error', function (e) {
    console.log("Got error: " + e.message);
});

// Coin data

function waitForMarket(cb) {
    if(marketDataReceived)
        cb()
    else
        setTimeout(function() { waitForMarket(cb) }, 10)
}

var DefaultCoins = JSON.parse(fs.readFileSync('./static_data/default_coins.json'))

function populateMapAndCoins() {
    let marketData = JSON.parse(marketDataChunks)
    let coinNameMap = {}
    let coinIdMap = {}

    //console.log(marketData)

    for(let coinData of marketData) {
        let coinId = coinData.id
        coinIdMap[coinData["symbol"]] = coinId
    }

    for(let coinData of marketData) {
        let coinName = coinData.name
        coinNameMap[coinData["symbol"]] = coinName
    }

    fs.writeFile("static_data/coin_id_map.json", JSON.stringify(coinIdMap), function (err) {
        if (err) return console.log(err);
        console.log(`coins name map > "static_data/coin_id_map.json"`);
    });

    fs.writeFile("static_data/coin_name_map.json", JSON.stringify(coinNameMap), function (err) {
        if (err) return console.log(err);
        console.log(`coins name map > "static_data/coin_name_map.json"`);
    });

    for(let coin of DefaultCoins) {
        let coinId = coinIdMap[coin]
        GraphsCache.getGraph(coinId, "1d").then(data => {
            fs.writeFile(`static_data/${coin}_1d.json`, allChunks, function (err) {
                if (err) return console.log(err);
                console.log(`${coin} graph data > "static_data/${coin}_1d.json"`);
            });
        })
    }    
}

waitForMarket(populateMapAndCoins)