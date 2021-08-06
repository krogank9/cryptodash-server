const GraphsCache = require('./graphs-cache')

const timeFrames = {
    "1d": 60*60*24,
    "1w": 60*60*24*7,
    "1m": 60*60*24*30,
    "1y": 60*60*24*30*12,
}

const GraphsService = {
    getGraph(coin, timeFrame) {
        return GraphsCache.getGraph(coin, timeFrame)
    },
}

module.exports = GraphsService