require('dotenv').config();

module.exports = {
  "migrationDirectory": "migrations",
  "driver": "pg",
  "host": process.env.DATABASE_HOST,
  "port": 5432,
  "database": process.env.DATABASE_DB,
  "username": process.env.DATABASE_USER,
  "password": process.env.DATABASE_PASSWORD
}