const app = require('./app')
const knex = require('knex')
const fs = require('fs')
const https = require('https');
const http = require('https');

const { PORT, DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_DB, NODE_ENV } = require('./config')

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



if(NODE_ENV === "development") {
    http.createServer(app).listen(PORT, () => {
        console.log(`Server listening at http://localhost:${PORT}`)
    });
}
else {
    const options = {
        key: fs.readFileSync("/etc/ssl/certs/key"),
        cert: fs.readFileSync("/etc/ssl/certs/cer.cer")
    };
    
    https.createServer(options, app).listen(PORT, () => {
        console.log(`Server listening at https://localhost:${PORT}`)
    });
}
