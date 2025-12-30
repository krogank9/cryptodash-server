"""
Lightweight Neural Network Price Predictor
A simple feed-forward neural network for cryptocurrency price prediction.
Designed to run quickly on minimal hardware.
"""

import csv
import sys
import numpy as np
from datetime import datetime, timezone

# ============================================================
# Simple Neural Network Implementation (numpy only)
# ============================================================

class SimpleNeuralNet:
    """A basic 2-layer neural network for time series prediction."""
    
    def __init__(self, input_size=14, hidden_size=8, learning_rate=0.01):
        self.lr = learning_rate
        # Initialize weights with small random values
        np.random.seed(42)
        self.w1 = np.random.randn(input_size, hidden_size) * 0.1
        self.b1 = np.zeros((1, hidden_size))
        self.w2 = np.random.randn(hidden_size, 1) * 0.1
        self.b2 = np.zeros((1, 1))
    
    def relu(self, x):
        return np.maximum(0, x)
    
    def relu_derivative(self, x):
        return (x > 0).astype(float)
    
    def forward(self, X):
        self.z1 = X @ self.w1 + self.b1
        self.a1 = self.relu(self.z1)
        self.z2 = self.a1 @ self.w2 + self.b2
        return self.z2
    
    def backward(self, X, y, output):
        m = X.shape[0]
        
        # Output layer gradients
        dz2 = output - y
        dw2 = (self.a1.T @ dz2) / m
        db2 = np.sum(dz2, axis=0, keepdims=True) / m
        
        # Hidden layer gradients
        dz1 = (dz2 @ self.w2.T) * self.relu_derivative(self.z1)
        dw1 = (X.T @ dz1) / m
        db1 = np.sum(dz1, axis=0, keepdims=True) / m
        
        # Update weights
        self.w2 -= self.lr * dw2
        self.b2 -= self.lr * db2
        self.w1 -= self.lr * dw1
        self.b1 -= self.lr * db1
    
    def train(self, X, y, epochs=100):
        for _ in range(epochs):
            output = self.forward(X)
            self.backward(X, y, output)
    
    def predict(self, X):
        return self.forward(X)


# ============================================================
# Data Processing
# ============================================================

def normalize(data):
    """Normalize data to 0-1 range."""
    min_val = np.min(data)
    max_val = np.max(data)
    if max_val - min_val == 0:
        return data, min_val, max_val
    return (data - min_val) / (max_val - min_val), min_val, max_val

def denormalize(data, min_val, max_val):
    """Convert normalized data back to original scale."""
    return data * (max_val - min_val) + min_val

def create_sequences(data, seq_length):
    """Create input sequences and targets for training."""
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i + seq_length])
        y.append(data[i + seq_length])
    return np.array(X), np.array(y).reshape(-1, 1)


# ============================================================
# Main Prediction Logic
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python predict.py <input.csv>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    # Read CSV data
    dates = []
    prices = []
    with open(input_file, 'r') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        for row in reader:
            dates.append(row[0])
            prices.append(float(row[1]))
    
    prices = np.array(prices)
    
    # Get last date for predictions
    last_date_str = dates[-1]
    last_date = datetime.strptime(last_date_str, '%Y-%m-%d %H:%M:%S')
    last_timestamp_ms = last_date.replace(tzinfo=timezone.utc).timestamp() * 1000
    
    # Parameters
    seq_length = min(14, len(prices) - 1)  # Window size for prediction
    prediction_days = 14
    
    # Normalize prices
    norm_prices, min_price, max_price = normalize(prices)
    
    # Create training data
    X, y = create_sequences(norm_prices, seq_length)
    
    if len(X) == 0:
        print("Not enough data for prediction")
        sys.exit(1)
    
    # Train neural network
    nn = SimpleNeuralNet(input_size=seq_length, hidden_size=8, learning_rate=0.05)
    nn.train(X, y, epochs=200)
    
    # Generate predictions
    predictions = []
    current_seq = norm_prices[-seq_length:].copy()
    
    for i in range(prediction_days):
        # Predict next value
        pred = nn.predict(current_seq.reshape(1, -1))[0, 0]
        
        # Add some realistic noise/volatility based on recent price movement
        volatility = np.std(norm_prices[-30:]) if len(norm_prices) >= 30 else np.std(norm_prices)
        noise = np.random.normal(0, volatility * 0.3)
        pred = pred + noise
        
        # Clamp to reasonable range
        pred = np.clip(pred, 0.0, 1.5)
        
        predictions.append(pred)
        
        # Slide window
        current_seq = np.append(current_seq[1:], pred)
    
    # Denormalize predictions
    predictions = denormalize(np.array(predictions), min_price, max_price)
    
    # Ensure predictions don't go negative
    predictions = np.maximum(predictions, min_price * 0.1)
    
    # Build output CSV
    output_lines = ['i,ds,y']
    for i, pred in enumerate(predictions):
        day_offset_ms = 1000 * 60 * 60 * 24 * (i + 1)
        timestamp = int(last_timestamp_ms + day_offset_ms)
        output_lines.append(f"{i},{timestamp},{pred}")
    
    output_csv = '\n'.join(output_lines) + '\n'
    
    # Print and save
    print(output_csv)
    
    output_path = f"./predictions-cache/{input_file}"
    with open(output_path, 'w') as f:
        f.write(output_csv)


if __name__ == '__main__':
    main()
