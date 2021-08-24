module.exports = {
	PORT: process.env.PORT || 8000,
	NODE_ENV: process.env.NODE_ENV || 'development',
	JWT_SECRET: process.env.JWT_SECRET,
	JWT_EXPIRY: 60*60,
	CLIENT_ORIGIN: process.env.NODE_ENV === 'production' ? "http://cryptodash.ltkdigital.com" : "http://localhost:3000" ,
	DATABASE_HOST: process.env.DATABASE_HOST,
	DATABASE_USER: process.env.DATABASE_USER,
	DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
	DATABASE_DB: process.env.DATABASE_DB,
	TEST_DATABASE_URL: process.env.TEST_DATABASE_URL
}
