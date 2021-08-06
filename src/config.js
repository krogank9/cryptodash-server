module.exports = {
	PORT: process.env.PORT || 8000,
	NODE_ENV: process.env.NODE_ENV || 'development',
	JWT_SECRET: process.env.JWT_SECRET,
	JWT_EXPIRY: 60*60,
	CLIENT_ORIGIN: process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://cryptodash.ltkdigital.com"
}
