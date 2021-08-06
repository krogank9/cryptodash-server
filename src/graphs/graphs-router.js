const path = require('path')
const express = require('express')
const GraphsService = require('./graphs-service')

const graphsRouter = express.Router()
const jsonParser = express.json()

graphsRouter.route('/:graph_id')
    .all((req, res, next) => {
        console.log
        let coinId = req.params.graph_id.split("_")[0]
        let timeFrame = req.params.graph_id.split("_")[1]
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

module.exports = graphsRouter