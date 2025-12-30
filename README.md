# cryptodash-server

Client: https://github.com/krogank9/cryptodash-client

## Prerequisites

- Node.js (v14 or higher recommended)
- npm
- PostgreSQL database
- Python 3.x with numpy (for price predictions)

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/krogank9/cryptodash-server.git
   cd cryptodash-server
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the project root with the following variables:

   ```env
   DATABASE_HOST=localhost
   DATABASE_USER=your_db_user
   DATABASE_PASSWORD=your_db_password
   DATABASE_DB=cryptodash
   JWT_SECRET=your_secret_key
   NODE_ENV=development
   PORT=8443
   ```

4. **Set up the database**
   
   Create a PostgreSQL database:
   ```bash
   createdb cryptodash
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Install Python dependencies**
   
   The prediction script requires only numpy:
   ```bash
   pip install numpy
   ```

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts the server with nodemon for auto-reloading at `http://localhost:8443`.

### Production Mode

```bash
npm run start-prod
```

Or simply:
```bash
npm start
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with nodemon |
| `npm start` | Start production server |
| `npm run start-dev` | Start with NODE_ENV=development |
| `npm run start-prod` | Start with NODE_ENV=production |
| `npm run migrate` | Run database migrations |
| `npm test` | Run tests with mocha |

## Configuration

Server configuration is in `src/config.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8443 | Server port |
| `NODE_ENV` | development | Environment mode |
| `JWT_SECRET` | - | Secret key for JWT tokens |
| `JWT_EXPIRY` | 3600 (1 hour) | Token expiration time in seconds |
| `DATABASE_HOST` | - | PostgreSQL host |
| `DATABASE_USER` | - | PostgreSQL username |
| `DATABASE_PASSWORD` | - | PostgreSQL password |
| `DATABASE_DB` | - | PostgreSQL database name |

## API Endpoints

The API is served at `/api` with the following main routes:

- `/api/auth` - Authentication endpoints
- `/api/users` - User management
- `/api/wallets` - Wallet management
- `/api/graphs` - Graph data endpoints
- `/api/predictions` - Price prediction endpoints

## Price Predictions

The `cryptodash-prediction/` folder contains a lightweight neural network for generating price predictions:

- **`predict.py`** - A simple feed-forward neural network implemented in pure numpy
  - Uses a sliding window approach to learn from recent price patterns
  - Trains quickly on incoming data (no pre-trained model needed)
  - Lightweight enough to run on minimal hardware (e.g., $5 VPS)

Predictions are cached in the `cryptodash-prediction/predictions-cache/` directory.
