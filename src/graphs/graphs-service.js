const CoinGecko = require('coingecko-api');
const CoinGeckoClient = new CoinGecko();

const timeFrames = {
    "1d": 60*60*24,
    "1w": 60*60*24*7,
    "1m": 60*60*24*30,
    "1y": 60*60*24*30*12,
}

const GraphsService = {
    getGraph(coin, timeFrame) {
        let timeStart = 0
        if(timeFrame !== "all")
            timeStart = Date.now()/1000 - timeFrames[timeFrame]
        
        return CoinGeckoClient.coins.fetchMarketChartRange(coin, {
            from: timeStart,
            to: Date.now()/1000,
        });
    },
}

module.exports = GraphsService