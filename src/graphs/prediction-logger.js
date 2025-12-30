const fs = require('fs');
const path = require('path');

// Set to true to enable file logging (for debugging)
const ENABLE_FILE_LOGGING = false;

const LOG_FILE = path.join(__dirname, '../../prediction.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    
    // Always print to console
    console.log(logLine);
    
    // Optionally write to file
    if (ENABLE_FILE_LOGGING) {
        try {
            fs.appendFileSync(LOG_FILE, logLine + '\n');
        } catch (err) {
            // Ignore file write errors
        }
    }
}

function clearLog() {
    if (ENABLE_FILE_LOGGING) {
        try {
            fs.writeFileSync(LOG_FILE, '');
        } catch (err) {
            // Ignore
        }
    }
}

module.exports = { log, clearLog, LOG_FILE, ENABLE_FILE_LOGGING };
