require('dotenv').config()
const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const helmet = require('helmet')
const { NODE_ENV, CLIENT_ORIGIN } = require('./config')

const app = express()

const graphsRouter = require('./graphs/graphs-router')

app.use(
    cors({
        origin: CLIENT_ORIGIN
    })
);

app.use(morgan((NODE_ENV === 'production') ? 'common' : 'common'))
app.use(helmet())

app.use('/api/graphs', graphsRouter)

app.get('/', (req, res) => {
	res.send('Hello, world!')
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

module.exports = app