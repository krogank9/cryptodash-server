require('dotenv').config()
const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const helmet = require('helmet')
const { NODE_ENV, CLIENT_ORIGIN } = require('./config')

var xml2js = require('xml2js')
var fs = require('fs')

const app = express()

const graphsRouter = require('./graphs/graphs-router')
const predictionsRouter = require('./graphs/predictions-router')
const usersRouter = require('./users/users-router')
const authRouter = require('./auth/auth-router')
const walletsRouter = require('./wallets/wallets-router')


app.use(
	cors({
		origin: CLIENT_ORIGIN
	})
);

app.use(morgan((NODE_ENV === 'production') ? 'common' : 'common'))
app.use(helmet())

app.use('/api/graphs', graphsRouter)
app.use('/api/predictions', predictionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/auth', authRouter)
app.use('/api/wallets', walletsRouter)

app.get('/', (req, res) => {
	res.send('Hello, world!')
})

app.get('/api/rss', async (req, res) => {
	var parser = new xml2js.Parser()
	const rssJson = await parser.parseStringPromise(fs.readFileSync('static_data/crypto_rss.xml', 'utf8'))
	res.json(rssJson)
})

app.get('/api/market_data', (req, res) => {
	const marketData = JSON.parse(fs.readFileSync('static_data/coins_markets_list.json', 'utf8'))
	res.status(200).json(marketData)
})

app.use(function errorHandler(error, req, res, next) {
	let response
	if (NODE_ENV === 'production') {
		response = { error: 'Server error' }
	} else {
		console.error(error)
		response = { message: error.message, error }
	}
	res.status(500).json(response)
})

let child_process = require('child_process')
function repopulateStaticData() {
	console.log("Repopulating static data...")
	child_process.fork('populate_static_data.js')
}
const ONE_MIN = 1000 * 60
setInterval(repopulateStaticData, ONE_MIN * 30)
repopulateStaticData()

module.exports = app