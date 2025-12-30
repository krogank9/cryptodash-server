#!/usr/bin/env node
/**
 * Test script for the prediction system
 * Run with: npm run test-prediction
 * Or: node test-prediction.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PREDICTION_DIR = path.join(__dirname, 'cryptodash-prediction');
const TEST_COIN = 'test-coin';

// Generate fake price data (simulating ~100 days of hourly data)
function generateTestData() {
    const data = [];
    let price = 100; // Starting price
    const now = Date.now();
    const ONE_HOUR = 1000 * 60 * 60;
    
    // Generate 100 data points (like ~100 hours of data)
    for (let i = 100; i >= 0; i--) {
        const timestamp = now - (i * ONE_HOUR);
        const date = new Date(timestamp);
        
        // Format date like the server does
        const yyyy = date.getFullYear();
        const mm = ('0' + (date.getMonth() + 1)).slice(-2);
        const dd = ('0' + date.getDate()).slice(-2);
        const h = date.getHours();
        const min = ('0' + date.getMinutes()).slice(-2);
        const sec = ('0' + date.getSeconds()).slice(-2);
        
        const dateStr = `${yyyy}-${mm}-${dd} ${h}:${min}:${sec}`;
        
        // Random walk for price
        price = price * (1 + (Math.random() - 0.5) * 0.02);
        
        data.push({ date: dateStr, price: price });
    }
    
    return data;
}

// Create CSV in the format the server uses
function createTestCSV(data) {
    let csv = '"ds","y"\n';
    csv += data.map(d => `"${d.date}",${d.price}`).join('\n') + '\n';
    return csv;
}

// Parse the prediction output CSV
function parsePredictionCSV(csvContent) {
    const lines = csvContent.trim().split(/\r?\n/).slice(1); // Skip header
    return lines.map(line => {
        const parts = line.split(',');
        return {
            index: parts[0],
            timestamp: parts[1],
            price: parts[2],
            date: new Date(parseInt(parts[1])).toISOString()
        };
    });
}

async function runTest() {
    console.log('='.repeat(60));
    console.log('PREDICTION SCRIPT TEST');
    console.log('='.repeat(60));
    
    // Step 1: Generate test data
    console.log('\n[1] Generating test price data...');
    const testData = generateTestData();
    console.log(`    Generated ${testData.length} data points`);
    console.log(`    Price range: ${Math.min(...testData.map(d => d.price)).toFixed(2)} - ${Math.max(...testData.map(d => d.price)).toFixed(2)}`);
    console.log(`    Last date: ${testData[testData.length - 1].date}`);
    
    // Step 2: Write CSV file
    console.log('\n[2] Writing test CSV...');
    const csvContent = createTestCSV(testData);
    const inputPath = path.join(PREDICTION_DIR, `${TEST_COIN}.csv`);
    fs.writeFileSync(inputPath, csvContent);
    console.log(`    Written to: ${inputPath}`);
    console.log(`    First few lines:\n${csvContent.split('\n').slice(0, 4).map(l => '      ' + l).join('\n')}`);
    
    // Step 3: Check if Python/Python3 exists
    console.log('\n[3] Checking Python availability...');
    
    const checkPython = (cmd) => new Promise((resolve) => {
        exec(`${cmd} --version`, (err, stdout, stderr) => {
            if (err) {
                resolve(null);
            } else {
                resolve(stdout.trim() || stderr.trim());
            }
        });
    });
    
    const python3Version = await checkPython('python3');
    const pythonVersion = await checkPython('python');
    
    console.log(`    python3: ${python3Version || 'NOT FOUND'}`);
    console.log(`    python: ${pythonVersion || 'NOT FOUND'}`);
    
    const pythonCmd = python3Version ? 'python3' : (pythonVersion ? 'python' : null);
    
    if (!pythonCmd) {
        console.log('\n❌ ERROR: No Python installation found!');
        process.exit(1);
    }
    
    console.log(`    Using: ${pythonCmd}`);
    
    // Step 4: Check if numpy is installed
    console.log('\n[4] Checking numpy installation...');
    const checkNumpy = () => new Promise((resolve) => {
        exec(`${pythonCmd} -c "import numpy; print(numpy.__version__)"`, (err, stdout, stderr) => {
            if (err) {
                resolve(null);
            } else {
                resolve(stdout.trim());
            }
        });
    });
    
    const numpyVersion = await checkNumpy();
    if (numpyVersion) {
        console.log(`    numpy version: ${numpyVersion}`);
    } else {
        console.log('    ❌ numpy NOT FOUND! Run: pip3 install numpy');
        process.exit(1);
    }
    
    // Step 5: Run the prediction script
    console.log('\n[5] Running prediction script...');
    const startTime = Date.now();
    
    const runPrediction = () => new Promise((resolve, reject) => {
        const cmd = `cd ${PREDICTION_DIR} && ${pythonCmd} predict.py ${TEST_COIN}.csv`;
        console.log(`    Command: ${cmd}`);
        
        exec(cmd, (err, stdout, stderr) => {
            resolve({ err, stdout, stderr });
        });
    });
    
    const result = await runPrediction();
    const elapsed = Date.now() - startTime;
    
    console.log(`    Completed in ${elapsed}ms`);
    
    if (result.stderr) {
        console.log('\n    --- STDERR (debug output) ---');
        result.stderr.split('\n').forEach(line => {
            if (line.trim()) console.log(`    ${line}`);
        });
    }
    
    if (result.stdout) {
        console.log('\n    --- STDOUT ---');
        const lines = result.stdout.trim().split('\n');
        if (lines.length > 6) {
            lines.slice(0, 3).forEach(line => console.log(`    ${line}`));
            console.log(`    ... (${lines.length - 6} more lines) ...`);
            lines.slice(-3).forEach(line => console.log(`    ${line}`));
        } else {
            lines.forEach(line => console.log(`    ${line}`));
        }
    }
    
    if (result.err) {
        console.log(`\n    ❌ ERROR: ${result.err.message}`);
    }
    
    // Step 6: Check if output file was created
    console.log('\n[6] Checking output file...');
    const outputPath = path.join(PREDICTION_DIR, 'predictions-cache', `${TEST_COIN}.csv`);
    
    if (fs.existsSync(outputPath)) {
        console.log(`    ✓ Output file exists: ${outputPath}`);
        
        const outputContent = fs.readFileSync(outputPath, 'utf8');
        console.log(`    File size: ${outputContent.length} bytes`);
        
        const predictions = parsePredictionCSV(outputContent);
        console.log(`    Predictions count: ${predictions.length}`);
        
        if (predictions.length > 0) {
            console.log('\n    --- PREDICTIONS ---');
            predictions.forEach(p => {
                console.log(`    Day ${parseInt(p.index) + 1}: ${parseFloat(p.price).toFixed(2)} (${p.date})`);
            });
            
            console.log('\n' + '='.repeat(60));
            console.log('✓ SUCCESS! Prediction script is working correctly.');
            console.log('='.repeat(60));
        } else {
            console.log('\n    ❌ No predictions in output file!');
        }
    } else {
        console.log(`    ❌ Output file NOT FOUND: ${outputPath}`);
        console.log('    The prediction script may have failed silently.');
    }
    
    // Cleanup
    console.log('\n[7] Cleaning up test files...');
    try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        console.log('    Cleaned up test files.');
    } catch (e) {
        console.log(`    Warning: Could not clean up: ${e.message}`);
    }
}

runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

