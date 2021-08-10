const path = require('path')
const express = require('express')
const GraphsService = require('./graphs-service')

const graphsRouter = express.Router()
const jsonParser = express.json()

graphsRouter.route('/:graph_id')
    .all((req, res, next) => {
        let coinId = req.params.graph_id.split("_").slice(0, -1).join("_")
        let timeFrame = req.params.graph_id.split("_").pop()
        GraphsService.getGraph(
            coinId,
            timeFrame
        )
            .then(graph => {
                if (!graph) {
                    return res.status(404).json({
                        error: { message: `Could not fetch graph` }
                    })
                }
                res.graph = graph // save the board for the next middleware
                next() // don't forget to call next so the next middleware happens!
            })
            .catch(next)
    })
    .get((req, res, next) => {
        res.json(res.graph)
    })

graphsRouter.route('/prediction/:coin')
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

module.exports = graphsRouter