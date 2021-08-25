const WalletsService = {
    getWalletsForUser(knex, userId) {
        return knex.from('wallets').select('*').where('owner_id', userId)
    },
    setWalletsForUser(knex, userId, wallets) {
        console.log("adding wallets")
        console.log(wallets)
        wallets = wallets.map(w => ({coin: w.coin, amount: w.amount, owner_id: userId}))
        return knex('wallets')
            .where('owner_id', userId)
            .delete()
            .then(() => knex
                .insert(wallets)
                .into('wallets')
                .returning('*')
            )
    },
    deleteAllWalletsForUser(knex, userId) {
        return knex('wallets')
            .where('owner_id', userId)
            .delete()
    },
}

module.exports = WalletsService