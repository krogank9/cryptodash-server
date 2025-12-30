const {CoinGeckoClient} = require('coingecko-api-v3');
const coinGeckoClient = new CoinGeckoClient();
var fs = require('fs');
var shell = require('shelljs');
const { log: plog } = require('./prediction-logger');

const ONE_MIN = 1000 * 60
const ONE_HOUR = ONE_MIN * 60
const ONE_DAY = ONE_HOUR * 24
const ONE_WEEK = ONE_DAY * 7
const ONE_MONTH = ONE_DAY * 30
const ONE_YEAR = ONE_DAY * 365
const ONE_YEAR_ALMOST = ONE_DAY * 365 - ONE_DAY * 5

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

// Tolerances for how up-to-date the data should be for different granularities
const granularityTimeTolerances = {
    "1d": ONE_MIN * 30,
    "3mo": ONE_HOUR * 12,
    "all": ONE_DAY * 2,
}

// So, we want the cache to, basically, upon requesting data for the given time frame, simply see if there is cached data available to serve.
// If not, that's where it gets interesting.
// We want to intelligently populate all the timeframes longer than the requested one and append the data, switching it to the larger granularity.
// Doesn't need to be perfect, just need to get it to where it will catch most of the cases we are looking for and significantly lower crypto API query usage

// The cache for the main coins we want will be populated and kept up to date via the static data population.
// We will store caches of each time frame/time interval as returned from CoinGecko. 1d (5min), 1d+-3mo (hourly), 3mo+ (daily). so 3 caches, <=1d, <=90d, and all.

class GraphsCache {
    constructor() {
        // Only one prophet model at a time so we don't crash our server...
        this.predictionQueue = Promise.resolve()
        this.predictionQueueByCoin = {}
        this.lastPromiseTime = 0
    }

    addToPredictionQueue(coin) {
        // Timeout protection -- For if promise doesn't resolve, should find a better solution later but this should work:
        if(Date.now() - this.lastPromiseTime > ONE_MIN * 2)
        {
            this.predictionQueue = Promise.resolve()
        }
        this.lastPromiseTime = Date.now()

        if (this.predictionQueueByCoin[coin]) {
            // This means prediction is already running or has already been queued to run. Just return same promise to that prediciton if still waiting.
            return this.predictionQueueByCoin[coin]
        }
        else {
            const now = Date.now()

            return this.predictionQueueByCoin[coin] = this.predictionQueue = this.predictionQueue.then(() => {
                return new Promise((resolvePromise, rejectPromise) => {
                    let pricesData = []
                    plog(`Fetching price data from CoinGecko for ${coin}...`)
                    
                    // Add timeout to prevent hanging forever
                    const timeoutMs = 30000
                    let timeoutId
                    const timeoutPromise = new Promise((_, reject) => {
                        timeoutId = setTimeout(() => {
                            plog(`CoinGecko API timeout after ${timeoutMs/1000}s for ${coin}`)
                            reject(new Error(`CoinGecko timeout after ${timeoutMs/1000}s`))
                        }, timeoutMs)
                    })
                    
                    const apiPromise = coinGeckoClient.coinIdMarketChartRange({
                        id: coin,
                        vs_currency: "usd",
                        from: (Date.now() - 31104000) / 1000, // New coingecko api limits to 365 days of data.
                        to: Date.now() / 1000,
                    })
                    
                    Promise.race([apiPromise, timeoutPromise]).then((res) => {
                        clearTimeout(timeoutId)
                        plog(`Got ${res.prices ? res.prices.length : 0} price points from CoinGecko for ${coin}`)
                        pricesData = res.prices
                        this.fillCache(coin, res.prices, true);
                        // Only send last year of data to neural net to minimize processing
                        return this.runPrediction(coin, pricesData.filter(d => d[0] >= now - ONE_YEAR_ALMOST))
                    }).then((prophetData) => {
                        // Prevent any further promise chaining on this coin
                        delete this.predictionQueueByCoin[coin]
                        this.savePredictionCacheJSON(coin, [pricesData, prophetData])
                        plog(`Prediction complete for ${coin}: ${prophetData.length} prediction points`)
                        resolvePromise([pricesData, prophetData])
                    }).catch((err) => {
                        clearTimeout(timeoutId) // Clear timeout on error too
                        plog(`Error fetching/predicting for ${coin}: ${err.message || err}`)
                        delete this.predictionQueueByCoin[coin]
                        resolvePromise([[], []]) // Return empty so request doesn't hang
                    });
                })
            })
        }
    }

    getPredictionCacheCSV(coin) {
        try {
            const filePath = `./cryptodash-prediction/predictions-cache/${coin}.csv`
            plog(`Reading prediction cache from: ${filePath}`)
            
            if (!fs.existsSync(filePath)) {
                plog(`Prediction cache file not found: ${filePath}`)
                return []
            }
            
            var csv = fs.readFileSync(filePath, 'utf8')
            plog(`Loaded prediction CSV (${csv.length} bytes)`)
            
            var lines = csv.trim().split(/\r\n|\n/).slice(1).map((l) => l.split(",").slice(1));
            plog(`Parsed ${lines.length} prediction lines`)
            
            var data = lines.map((lineArr) => [new Date(Number(lineArr[0]) || lineArr[0]).getTime(), Number(lineArr.pop())])
            plog(`Processed ${data.length} predictions`)
            
            return data
        } catch (err) {
            plog(`Error reading prediction cache for ${coin}: ${err.message}`)
            return []
        }
    }

    runPrediction(coin, data) {
        //return Promise.resolve([])
        return new Promise((resolvePromise, rejectPromise) => {
            //data = data.filter(([time, _]) => time >= Date.now() - ONE_YEAR)
            let csv = '"ds","y"\n' + data.map(([unixTimestampMs, val]) => {
                // Convert date to format prophet likes
                var d = new Date(unixTimestampMs),
                    yyyy = d.getFullYear(),
                    mm = ('0' + (d.getMonth() + 1)).slice(-2),
                    dd = ('0' + d.getDate()).slice(-2),
                    hh = d.getHours(),
                    h = hh,
                    min = ('0' + d.getMinutes()).slice(-2),
                    sec = ('0' + d.getSeconds()).slice(-2);

                let pandaTimestamp = yyyy + '-' + mm + '-' + dd + ' ' + h + ':' + min + ':' + sec

                return `"${pandaTimestamp}",${val}`
            }).join("\n") + "\n"

            // Run python script to get a 14 day forecast
            let that = this
            plog(`Updating neural net prediction for ${coin}`)
            plog(`Current working directory: ${process.cwd()}`)
            
            const inputPath = `cryptodash-prediction/${coin}.csv`
            plog(`Writing input CSV to: ${inputPath}`)
            fs.writeFileSync(inputPath, csv)
            plog(`Input CSV written (${csv.length} bytes)`)
            
            const shellCmd = `(cd ./cryptodash-prediction && python3 predict.py ${coin}.csv && rm ${coin}.csv)`
            plog(`Running shell command: ${shellCmd}`)
            
            shell.exec(shellCmd, { timeout: 60000 }, (err, stdout, stderr) => {
                try {
                    plog(`Finished running neural net prediction for ${coin}`)
                    if (err) plog(`Prediction error: ${err}`)
                    if (stderr) plog(`Prediction stderr: ${stderr}`)
                    if (stdout) plog(`Prediction stdout: ${stdout}`)
                    
                    let mostRecentRealTime = data.slice(-1)[0][0]
                    let predictions = that.getPredictionCacheCSV(coin)
                    let filteredPredictions = predictions.filter(d => d[0] > mostRecentRealTime)
                    
                    plog(`Returning ${filteredPredictions.length} predictions (filtered from ${predictions.length})`)
                    resolvePromise(filteredPredictions)
                } catch (callbackErr) {
                    plog(`Error in prediction callback: ${callbackErr.message}`)
                    resolvePromise([]) // Return empty array so request doesn't hang
                }
            })
        })
    }

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
        return Promise.resolve()
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

        if (coinCache.length === 0) {
            console.log(`Cache ${coin}_${granularity} was empty. Needs refresh`)
            return [false, []]
        }

        // If querying all, and haven't yet fetched whole graph, always need to refetch.
        if (!grabbedAllFromServer && timeStart === 0)
            return [false, []]

        // Check historical data, make sure graph goes back as far as query, or that we have already grabbed the entire graph from server
        // Commenting this out, no longer lets us get data past 365 days on coingecko
        // if (timeStart < coinCache[0][0] - granularityTimeTolerances[granularity] && !grabbedAllFromServer) {
        //     console.log(`Cache ${coin}_${granularity} does not have all historical data. Off by ${((coinCache[0][0] - granularityTimeTolerances[granularity]) - timeStart) / 1000 / 60} minutes. timeStart is ${timeStart}. First time in cache is ${coinCache[0][0]}. Needs refresh`)
        //     return [false, []]
        // }

        // Check recent data, make sure graph is up to date to within an acceptable time tolerance
        if (timeEnd > coinCache[coinCache.length - 1][0] + granularityTimeTolerances[granularity]) {
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
                Math.abs(fillSpan[0] - curSpan[1]) <= granularityIntervals[granularity]
                || Math.abs(fillSpan[1] - curSpan[0]) <= granularityIntervals[granularity]
            )

            if (!curDataContained && (dataOverlaps || dataIsClose)) {
                // Make a copy before we mutate
                let fillDataCopy = fillData.slice(0)

                // Interweave the data keeping the time values in order
                let interweaved = []
                while (fillDataCopy.length && curData.length) {
                    if (fillDataCopy[0][0] < curData[0][0])
                        interweaved.push(fillDataCopy.shift())
                    else
                        interweaved.push(curData.shift())
                }
                interweaved = interweaved.concat(fillDataCopy, curData)

                let filteredToGranularity = [interweaved[0]]
                for (let i = 1; i < interweaved.length - 1; i++) {
                    let timeBetween = interweaved[i][0] - filteredToGranularity[filteredToGranularity.length - 1][0]
                    if (timeBetween >= granularityIntervals[granularity] * 0.95) {
                        filteredToGranularity.push(interweaved[i])
                    }
                }
                filteredToGranularity.push(interweaved.pop())

                return that.saveCacheFile(coin, granularity, filteredToGranularity, fillGrabbedAllFromServer || curGrabbedAllFromServer)
            }
            else {
                return that.saveCacheFile(coin, granularity, fillData, fillGrabbedAllFromServer)
            }
        })
        return Promise.resolve()
    }

    savePredictionCacheJSON(coin, data) {
        fs.writeFileSync(`./cryptodash-prediction/predictions-cache/${coin}.json`, JSON.stringify(data))
    }

    getPredictionCacheJSON(coin) {
        try {
            return JSON.parse(fs.readFileSync(`./cryptodash-prediction/predictions-cache/${coin}.json`, 'utf8'))
        }
        catch (err) {
            return [[], []]
        }
    }

    getGraphAndPrediction(coin) {
        plog(`=== getGraphAndPrediction called for ${coin} ===`)
        let tryGetFromCache = this.getPredictionCacheJSON(coin)
        let lastRealData = tryGetFromCache[0].slice().pop()
        
        if (lastRealData) {
            const cacheAge = Date.now() - lastRealData[0]
            const cacheAgeHours = (cacheAge / ONE_HOUR).toFixed(1)
            plog(`Cache for ${coin}: last data point ${cacheAgeHours} hours old`)
        } else {
            plog(`No cache found for ${coin}`)
        }

        // Only run 1 prediction cache for a coin per 24 hours.
        if (lastRealData && Date.now() - lastRealData[0] < ONE_HOUR * 24) {
            plog(`Serving ${coin} from cache (${tryGetFromCache[0].length} prices, ${tryGetFromCache[1].length} predictions)`)
            return Promise.resolve(tryGetFromCache)
        }
        else {
            plog(`Cache miss/stale for ${coin}, adding to prediction queue`)
            return this.addToPredictionQueue(coin)
        }
    }

    getGraph(coin, timeFrame, now) {
        let timeStart = 0
        let timeEnd = now || Date.now()
        if (timeFrame !== "all")
            timeStart = timeEnd - timeFrames[timeFrame]

        console.log(`${coin}_${timeFrame}...`)
        let tryGetFromCache = this.checkCache(coin, timeStart, timeEnd)

        if (tryGetFromCache[0]) {
            console.log(`Succesfully got data from cache for ${coin}_${timeFrame}`)
            return Promise.resolve(tryGetFromCache[1])
        }
        else {
            timeStart = Math.max(timeStart, timeEnd - 31104000); // New coingecko api limits to 365 days of data.
            return coinGeckoClient.coinIdMarketChartRange({
                id: coin,
                vs_currency: "usd",
                from: timeStart / 1000,
                to: timeEnd / 1000,
            }).then((res) => {
                //console.log("getGraph res:")
                //console.log(res)
                this.fillCache(coin, res.prices, timeFrame === "all");
                return res.prices;
            }).catch((err) => {
                console.log("error for coin "+ coin)
            });
        }
    }
}

const graphsCacheInstance = new GraphsCache()
module.exports = graphsCacheInstance
