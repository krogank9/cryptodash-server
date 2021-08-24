const knex = require('knex')
const app = require('./app')
const { PORT, DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_DB } = require('./config')

console.log(DATABASE_PASSWORD)

const db = knex({
	client: 'pg',
	connection: {
		host: DATABASE_HOST,
		user: DATABASE_USER,
		password: DATABASE_PASSWORD,
		database: DATABASE_DB,
	},
})

app.set('db', db)

app.listen(PORT, () => {
	console.log(`Server listening at http://localhost:${PORT}`)
})
