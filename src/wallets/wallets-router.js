const path = require('path')
const express = require('express')
const xss = require('xss')
const WalletsService = require('./wallets-service')
const UsersRouter = require('../users/users-router')
const { requireAuth } = require('../middleware/jwt-auth')

const walletsRouter = express.Router()
const jsonParser = express.json()

const serializeWallet = (wallet) => ({
    coin: wallet.coin,
    amount: wallet.amount
})

walletsRouter.route('/')
    .get(requireAuth, (req, res, next) => {
        const knexInstance = req.app.get('db')
        WalletsService.getWalletsForUser(knexInstance, req.user.id)
            .then(wallets => {
                res.json((wallets || []).map(serializeWallet))
            })
            .catch(next)
    })
    .post([requireAuth, jsonParser], (req, res, next) => {
        const wallets = req.body
        const knexInstance = req.app.get('db')
        WalletsService.setWalletsForUser(knexInstance, req.user.id, wallets || [])
            .then(() => {
                res.status(201).json((wallets || []).map(serializeWallet))
            })
            .catch(next)
    })
    .delete(requireAuth, (req, res, next) => {
        const knexInstance = req.app.get('db')
        WalletsService.deleteAllWalletsForUser(knexInstance, req.user.id)
            .then(() => {
                res.status(201).json([])
            })
            .catch(next)
    })

module.exports = walletsRouter