var http = require('follow-redirects').http;
var fs = require('fs');
const GraphsCache = require('./src/graphs/graphs-cache')

function tryReadFileSync(file, defaultValue) {
    try {
        return fs.readFileSync(file)
    }
    catch(err) {
        return defaultValue
    }
}

// Rss feed

http.get({ host: "www.coindesk.com", port: 80, path: '/arc/outboundfeeds/rss' }, function (res) {
    console.log("Got response: " + res.statusCode);

    let allChunks = ""

    res.on('data', function (chunk) {
        allChunks += chunk
        fs.writeFile("./static_data/crypto_rss.xml", allChunks, function (err) {
            if (err) return console.log(err);
        });
    });

    res.on('close', function () {
        console.log(`rss > "static_data/crypto_rss.xml"`);
    })
}).on('error', function (e) {
    console.log("Got error: " + e.message);
});

// Market data

function fetchMarketDataPage(pageNum) {
    let marketDataChunks = ""
    
    return new Promise((resolve, reject) => {
        const API_KEY = "YOUR_API_KEY"
        http.get({ host: "api.coingecko.com", port: 80, path: `/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${pageNum}&sparkline=false&price_change_percentage=price_change_percentage&x_cg_demo_api_key=${API_KEY}` }, function (res) {
            console.log("fetchMarketDataPage() Got response from coingecko: " + res.statusCode);

            res.on('data', function (chunk) {
                marketDataChunks += chunk
            });
            res.on('close', function () {
                let newMarketData = JSON.parse(marketDataChunks || [])
                let curMarketData = JSON.parse(tryReadFileSync('./static_data/coins_markets_list.json', "[]")).filter(c1 => !newMarketData.find(c2 => c1.symbol === c2.symbol))
                let combinedMarketData = curMarketData.concat(newMarketData)
                fs.writeFileSync('./static_data/coins_markets_list.json', JSON.stringify(combinedMarketData, null, 2))
                resolve(true)
                marketDataReceived = true
            })
        }).on('error', function (e) {
            console.log("Got error: " + e.message);
            resolve(false)
        });
    })
}

let marketDataReceived = false

fetchMarketDataPage(1)
    .then(() => fetchMarketDataPage(2))
    .then(() => fetchMarketDataPage(3))
    .then(() => fetchMarketDataPage(4))
    .then(() => fetchMarketDataPage(5))
    .then(() => populateMapAndCoins())

// Coin data

var DefaultCoins = JSON.parse(fs.readFileSync('./static_data/default_coins.json'))

function populateMapAndCoins() {
    let marketData = JSON.parse(tryReadFileSync('./static_data/coins_markets_list.json', '[]'))
    let coinNameMap = {}
    let coinIdMap = {}

    //console.log(marketData)

    for (let coinData of marketData) {
        let coinId = coinData.id
        coinIdMap[coinData["symbol"]] = coinId
    }

    for (let coinData of marketData) {
        let coinName = coinData.name
        coinNameMap[coinData["symbol"]] = coinName
    }

    //fs.writeFileSync("./static_data/coin_id_map.json", JSON.stringify(coinIdMap))
    //fs.writeFileSync("./static_data/coin_name_map.json", JSON.stringify(coinNameMap))

    for (let coin of DefaultCoins) {
        let coinId = coinIdMap[coin]
        // Make sure every coin in DefaultCoins has an updated cache
        // The cache will then be used in getServerSideProps on the client
        GraphsCache.getGraph(coinId, "1d").then(data => {
            // Should already be filled by previous but just in case:
            GraphsCache.getGraph(coinId, "1w")
        })
    }
}