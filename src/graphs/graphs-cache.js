const CoinGecko = require('coingecko-api');
const CoinGeckoClient = new CoinGecko();
var fs = require('fs');

const ONE_MIN = 1000 * 60
const ONE_HOUR = ONE_MIN * 60
const ONE_DAY = ONE_HOUR * 24
const ONE_WEEK = ONE_DAY * 7
const ONE_MONTH = ONE_DAY * 30
const ONE_YEAR = ONE_MONTH * 12

const timeFrames = {
    "1d": ONE_DAY,
    "1w": ONE_WEEK,
    "1m": ONE_MONTH,
    "1y": ONE_YEAR,
}

// CoinGecko returns data with a different granularity depending on the range you request automatically:
const granularityIntervals = {
    "1d": ONE_MIN * 5,
    "3mo": ONE_HOUR, // 1 hour
    "all": ONE_DAY, // 1 day
}

// So, we want the cache to, basically, upon requesting data for the given time frame, simply see if there is cached data available to serve.
// If not, that's where it gets interesting.
// We want to intelligently populate all the timeframes longer than the requested one and append the data, switching it to the larger granularity.
// Doesn't need to be perfect, just need to get it to where it will catch most of the cases we are looking for and significantly lower crypto API query usage

// The cache for the main coins we want will be populated and kept up to date via the static data population.
// We will store caches of each time frame/time interval as returned from CoinGecko. 1d (5min), 1d+-3mo (hourly), 3mo+ (daily). so 3 caches, <=1d, <=90d, and all.

class GraphsCache {
    determineGranularity(data) {
        let timeInterval = data[1][0] - data[0][0]

        // Check which granularity the data is.
        // Data returned may not be perfectly precise so have to check which is closest to.
        let closest_g = "1d"
        for (const g in granularityIntervals) {
            let best_diff = Math.abs(granularityIntervals[closest_g] - timeInterval)
            let diff = Math.abs(granularityIntervals[g] - timeInterval)
            if (diff < best_diff)
                closest_g = g
        }

        return closest_g
    }

    saveCacheFile(coin, granularity, data, grabbedAllFromServer) {
        try {
            console.log(`Rewriting ${coin}_${granularity}.json`)
            fs.writeFileSync(`graph_cache/${coin}_${granularity}.json`, JSON.stringify({ data: data, grabbedAllFromServer: grabbedAllFromServer }))
        }
        catch (err) {
            //console.log(err)
        }
    }

    tryLoadCacheFile(coin, granularity) {
        try {
            return JSON.parse(fs.readFileSync(`graph_cache/${coin}_${granularity}.json`, 'utf8'))
        }
        catch (err) {
            return { data: [], grabbedAllFromServer: false }
        }
    }

    checkCache(coin, timeStart, timeEnd) {
        let granularity = "all"
        if (timeEnd - timeStart <= ONE_DAY + ONE_MIN * 30)
            granularity = "1d"
        else if (timeEnd - timeStart <= ONE_MONTH * 3 + ONE_HOUR * 5)
            granularity = "3mo"

        let coinCache = this.tryLoadCacheFile(coin, granularity)
        let grabbedAllFromServer = coinCache.grabbedAllFromServer
        coinCache = coinCache.data

        console.log(`checking ${coin}_${granularity} cache ${timeStart} -> ${timeEnd}`)

        // Tolerances for how up-to-date the data should be for different granularities
        let timeTolerance = {
            "1d": ONE_MIN * 30,
            "3mo": ONE_HOUR * 12,
            "all": ONE_DAY * 2,
        }

        if (coinCache.length === 0) {
            console.log(`Cache ${coin}_${granularity} was empty. Needs refresh`)
            return [false, []]
        }

        // If querying all, and haven't yet fetched whole graph, always need to refetch.
        if (!grabbedAllFromServer && timeStart === 0)
            return [false, []]

        // Check historical data, make sure graph goes back as far as query, or that we have already grabbed the entire graph from server
        if (timeStart < coinCache[0][0] - timeTolerance[granularity] && !grabbedAllFromServer) {
            console.log(`Cache ${coin}_${granularity} does not have all historical data. Off by ${((coinCache[0][0] - timeTolerance[granularity]) - timeStart) / 1000 / 60} minutes. timeStart is ${timeStart}. First time in cache is ${coinCache[0][0]}. Needs refresh`)
            return [false, []]
        }

        // Check recent data, make sure graph is up to date to within an acceptable time tolerance
        if (timeEnd > coinCache[coinCache.length - 1][0] + timeTolerance[granularity]) {
            console.log(`Cache ${coin}_${granularity} does not have most recent data. Off by ${timeEnd - coinCache[coinCache.length - 1][0]} Needs refresh`)
            return [false, []]
        }

        coinCache = coinCache.filter(d => d[0] >= timeStart && d[0] <= timeEnd)

        return [true, coinCache]
    }

    fillCache(coin, fillData, fillGrabbedAllFromServer) {
        const fillGranularity = this.determineGranularity(fillData)
        console.log(fillData && fillData.length)

        let that = this
        // Update any less granular caches with the fill's data. Fill will be simplified down to a less precise granularity during interweaving.
        // This is so when we fetch the daily BTC prices and save them to our cache, we will also be accumulating the week, month, and year data since we do it every day.
        // Maybe a bit overkill, but was trying to save API requests and bandwidth on my server.
        Object.keys(granularityIntervals).filter(g => granularityIntervals[fillGranularity] <= granularityIntervals[g]).forEach(function (granularity) {
            let curData = that.tryLoadCacheFile(coin, granularity)
            let curGrabbedAllFromServer = curData.grabbedAllFromServer
            curData = curData.data

            if (curData.length === 0)
                return that.saveCacheFile(coin, granularity, fillData, fillGrabbedAllFromServer)

            // Check how we should combine the data. If the time spans are overlapping or touching end to end, we can connect/interweave them.
            // Otherwise, we just write the new data, assuming it's more recent but discontinuous with the data accrued in the cache thus far.
            const fillSpan = [fillData[0][0], fillData[fillData.length - 1][0]]
            const curSpan = [curData[0][0], curData[curData.length - 1][0]]
            const curDataContained = curSpan[0] >= fillSpan[0] && curSpan[1] <= fillSpan[1]
            const dataOverlaps = fillSpan[0] <= curSpan[1] && fillSpan[1] >= curSpan[0]
            const dataIsClose = (
                Math.abs(fillSpan[0] - curSpan[1]) < granularityIntervals[granularity]
                || Math.abs(fillSpan[1] - curSpan[0]) < granularityIntervals[granularity]
            )

            if (!curDataContained && (dataOverlaps || dataIsClose)) {
                // Make a copy before we mutate
                let fillData_ = fillData.slice(0)

                // Interweave the data keeping the time values in order
                let interweaved = []
                while (fillData_.length && curData.length) {
                    if (fillData_[0][0] < curData[0][0])
                        interweaved.push(fillData_.shift())
                    else
                        interweaved.push(curData.shift())
                }
                interweaved = interweaved.concat(fillData_, curData)

                // Filter excess granularity before save
                interweaved = interweaved.filter((d, i) => {
                    if (i === 0 || i === interweaved.length - 1)
                        return true

                    let neighborsTimeSpan = interweaved[i + 1][0] - interweaved[i - 1][0]
                    return neighborsTimeSpan >= granularityIntervals[granularity] * 0.8
                })
                that.saveCacheFile(coin, granularity, interweaved, fillGrabbedAllFromServer || curGrabbedAllFromServer)
            }
            else {
                that.saveCacheFile(coin, granularity, fillData, fillGrabbedAllFromServer)
            }
        })
    }

    getGraph(coin, timeFrame) {
        let timeStart = 0
        let timeEnd = Date.now()
        if (timeFrame !== "all")
            timeStart = timeEnd - timeFrames[timeFrame]

        console.log(`${coin}_${timeFrame}...`)
        let tryGetFromCache = this.checkCache(coin, timeStart, timeEnd)

        if (tryGetFromCache[0]) {
            console.log(`Succesfully got data from cache for ${coin}_${timeFrame}`)
            return Promise.resolve(tryGetFromCache[1])
        }
        else {
            return CoinGeckoClient.coins.fetchMarketChartRange(coin, {
                from: timeStart / 1000,
                to: timeEnd / 1000,
            }).then((res) => { this.fillCache(coin, res.data.prices, timeFrame === "all"); return res.data.prices });
        }
    }
}

const graphsCacheInstance = new GraphsCache()
module.exports = graphsCacheInstance