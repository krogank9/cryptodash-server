const path = require('path')
const express = require('express')
const GraphsService = require('./graphs-service')

const predictionsRouter = express.Router()
const jsonParser = express.json()

predictionsRouter.route('/:coin')
    .all((req, res, next) => {
        let coinId = req.params.coin
        GraphsService.getGraphAndPrediction(
            coinId
        )
            .then(prediction => {
                if (!prediction) {
                    return res.status(404).json({
                        error: { message: `Could not fetch prediction` }
                    })
                }
                res.prediction = prediction // save the board for the next middleware
                next() // don't forget to call next so the next middleware happens!
            })
            .catch(next)
    })
    .get((req, res, next) => {
        res.json(res.prediction)
    })

module.exports = predictionsRouter