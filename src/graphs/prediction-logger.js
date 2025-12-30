const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../prediction.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    
    // Also print to console
    console.log(message);
    
    // Append to log file
    try {
        fs.appendFileSync(LOG_FILE, logLine);
    } catch (err) {
        console.error(`Failed to write to log file: ${err.message}`);
    }
}

function clearLog() {
    try {
        fs.writeFileSync(LOG_FILE, '');
    } catch (err) {
        // Ignore
    }
}

module.exports = { log, clearLog, LOG_FILE };

