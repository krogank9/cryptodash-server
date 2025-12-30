#!/usr/bin/env python3
"""
Lightweight Neural Network Price Predictor
Generates realistic-looking price predictions with proper volatility.
"""

import csv
import sys
import os
import numpy as np
from datetime import datetime, timezone

# ============================================================
# Simple Neural Network for trend detection
# ============================================================

class SimpleNeuralNet:
    def __init__(self, input_size=14, hidden_size=16, learning_rate=0.001):
        self.lr = learning_rate
        self.w1 = np.random.randn(input_size, hidden_size) * np.sqrt(2.0 / input_size)
        self.b1 = np.zeros((1, hidden_size))
        self.w2 = np.random.randn(hidden_size, 1) * np.sqrt(2.0 / hidden_size)
        self.b2 = np.zeros((1, 1))
    
    def forward(self, X):
        self.z1 = X @ self.w1 + self.b1
        self.a1 = np.tanh(self.z1)
        return self.a1 @ self.w2 + self.b2
    
    def train(self, X, y, epochs=300):
        for _ in range(epochs):
            out = self.forward(X)
            m = max(X.shape[0], 1)
            dz2 = out - y
            dw2 = (self.a1.T @ dz2) / m
            db2 = np.sum(dz2, axis=0, keepdims=True) / m
            dz1 = (dz2 @ self.w2.T) * (1 - np.tanh(self.z1) ** 2)
            dw1 = (X.T @ dz1) / m
            db1 = np.sum(dz1, axis=0, keepdims=True) / m
            np.clip(dw1, -1, 1, out=dw1)
            np.clip(dw2, -1, 1, out=dw2)
            self.w2 -= self.lr * dw2
            self.b2 -= self.lr * db2
            self.w1 -= self.lr * dw1
            self.b1 -= self.lr * db1
    
    def predict(self, X):
        return self.forward(X)


def normalize(data):
    min_val, max_val = np.min(data), np.max(data)
    if max_val - min_val == 0:
        return np.zeros_like(data), min_val, max_val
    return 2 * (data - min_val) / (max_val - min_val) - 1, min_val, max_val

def denormalize(data, min_val, max_val):
    return (data + 1) / 2 * (max_val - min_val) + min_val

def create_sequences(data, seq_length):
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i + seq_length])
        y.append(data[i + seq_length])
    return np.array(X), np.array(y).reshape(-1, 1) if y else (np.array([]), np.array([]))

def parse_date(date_str):
    try:
        parts = date_str.strip().split(' ')
        date_part = parts[0]
        time_part = parts[1] if len(parts) > 1 else '0:0:0'
        year, month, day = map(int, date_part.split('-'))
        tc = time_part.split(':')
        hour = int(tc[0]) if len(tc) > 0 else 0
        minute = int(tc[1]) if len(tc) > 1 else 0
        second = int(float(tc[2])) if len(tc) > 2 else 0
        return datetime(year, month, day, hour, minute, second)
    except:
        return datetime.now()


def main():
    try:
        if len(sys.argv) < 2:
            print("Usage: python predict.py <input.csv>", file=sys.stderr)
            sys.exit(1)
        
        input_file = sys.argv[1]
        coin_name = input_file.replace('.csv', '')
        
        print(f"[predict.py] Starting prediction for {coin_name}", file=sys.stderr)
        
        # Read CSV data
        dates, prices = [], []
        with open(input_file, 'r') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2:
                    dates.append(row[0])
                    try:
                        prices.append(float(row[1]))
                    except ValueError:
                        continue
        
        print(f"[predict.py] Read {len(prices)} data points", file=sys.stderr)
        
        if len(prices) < 20:
            print("[predict.py] Not enough data", file=sys.stderr)
            sys.exit(1)
        
        prices = np.array(prices)
        
        # Calculate the typical time interval between data points
        last_date = parse_date(dates[-1])
        if len(dates) >= 2:
            second_last = parse_date(dates[-2])
            typical_interval_ms = (last_date - second_last).total_seconds() * 1000
            # Clamp to reasonable range (5 min to 1 day)
            typical_interval_ms = max(5 * 60 * 1000, min(typical_interval_ms, 24 * 60 * 60 * 1000))
        else:
            typical_interval_ms = 60 * 60 * 1000  # Default 1 hour
        
        last_timestamp_ms = int(last_date.replace(tzinfo=timezone.utc).timestamp() * 1000)
        
        print(f"[predict.py] Interval: {typical_interval_ms/1000/60:.1f} min, Last: {last_date}", file=sys.stderr)
        
        # Calculate statistics from recent data
        recent = prices[-200:] if len(prices) >= 200 else prices
        
        # Calculate returns and volatility
        returns = np.diff(recent) / recent[:-1]
        volatility = np.std(returns) if len(returns) > 0 else 0.005
        mean_return = np.mean(returns) if len(returns) > 0 else 0
        
        # Detect recent trend
        if len(prices) >= 24:
            trend_24h = (prices[-1] - prices[-24]) / prices[-24]
        else:
            trend_24h = 0
        
        print(f"[predict.py] Volatility: {volatility:.4f}, Mean return: {mean_return:.6f}, 24h trend: {trend_24h:.4f}", file=sys.stderr)
        
        # Use neural net to get a directional bias
        seq_length = min(14, len(prices) - 1)
        norm_prices, min_p, max_p = normalize(prices)
        X, y = create_sequences(norm_prices, seq_length)
        
        nn_bias = 0
        if len(X) > 0:
            nn = SimpleNeuralNet(input_size=seq_length, hidden_size=16, learning_rate=0.01)
            nn.train(X, y, epochs=200)
            last_seq = norm_prices[-seq_length:].reshape(1, -1)
            nn_pred = nn.predict(last_seq)[0, 0]
            nn_bias = nn_pred - norm_prices[-1]
        
        print(f"[predict.py] Neural net bias: {nn_bias:.4f}", file=sys.stderr)
        
        # Generate predictions - HOURLY for 14 days = 336 points
        prediction_hours = 14 * 24  # 14 days worth of hours
        predictions = []
        timestamps = []
        
        current_price = float(prices[-1])
        
        # Use a momentum model with mean reversion and volatility
        momentum = mean_return * 0.5  # Start with some momentum from recent trend
        
        for i in range(prediction_hours):
            # Add neural network influence (decaying)
            nn_influence = nn_bias * 0.0005 * (0.995 ** i) * current_price
            
            # Mean reversion - pull slightly toward recent average
            mean_price = float(np.mean(recent[-100:]))
            reversion = (mean_price - current_price) * 0.001
            
            # Momentum with decay
            momentum = momentum * 0.998 + mean_return * 0.002
            momentum_move = momentum * current_price
            
            # Random volatility - this is the key for realistic look!
            # Use the actual volatility from the data
            random_move = np.random.normal(0, volatility) * current_price
            
            # Combine all factors
            price_change = random_move + momentum_move + reversion + nn_influence
            
            # Apply change
            new_price = current_price + price_change
            
            # Keep it reasonable (no more than 2% move per hour typically)
            max_move = current_price * 0.02
            new_price = np.clip(new_price, current_price - max_move, current_price + max_move)
            new_price = max(new_price, current_price * 0.5)  # Never drop more than 50%
            
            predictions.append(new_price)
            timestamps.append(last_timestamp_ms + int(typical_interval_ms * (i + 1)))
            
            current_price = new_price
        
        print(f"[predict.py] Generated {len(predictions)} predictions", file=sys.stderr)
        print(f"[predict.py] Range: {min(predictions):.2f} - {max(predictions):.2f}", file=sys.stderr)
        
        # Build output CSV
        output_lines = ['i,ds,y']
        for i, (ts, pred) in enumerate(zip(timestamps, predictions)):
            output_lines.append(f"{i},{ts},{pred}")
        
        output_csv = '\n'.join(output_lines) + '\n'
        
        # Ensure cache directory exists
        cache_dir = './predictions-cache'
        os.makedirs(cache_dir, exist_ok=True)
        
        # Save
        output_path = os.path.join(cache_dir, f"{coin_name}.csv")
        with open(output_path, 'w') as f:
            f.write(output_csv)
        
        print(f"[predict.py] Saved to {output_path}", file=sys.stderr)
        print(output_csv)
        
    except Exception as e:
        print(f"[predict.py] Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
