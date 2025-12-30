#!/usr/bin/env python3
"""
Lightweight Neural Network Price Predictor
A simple feed-forward neural network for cryptocurrency price prediction.
Designed to run quickly on minimal hardware.
"""

import csv
import sys
import os
import numpy as np
from datetime import datetime, timezone

# ============================================================
# Simple Neural Network Implementation (numpy only)
# ============================================================

class SimpleNeuralNet:
    """A basic 2-layer neural network for time series prediction."""
    
    def __init__(self, input_size=14, hidden_size=16, learning_rate=0.001):
        self.lr = learning_rate
        self.input_size = input_size
        # Xavier initialization for better convergence
        self.w1 = np.random.randn(input_size, hidden_size) * np.sqrt(2.0 / input_size)
        self.b1 = np.zeros((1, hidden_size))
        self.w2 = np.random.randn(hidden_size, 1) * np.sqrt(2.0 / hidden_size)
        self.b2 = np.zeros((1, 1))
    
    def tanh(self, x):
        return np.tanh(x)
    
    def tanh_derivative(self, x):
        return 1 - np.tanh(x) ** 2
    
    def forward(self, X):
        self.z1 = X @ self.w1 + self.b1
        self.a1 = self.tanh(self.z1)
        self.z2 = self.a1 @ self.w2 + self.b2
        return self.z2
    
    def backward(self, X, y, output):
        m = max(X.shape[0], 1)
        
        dz2 = output - y
        dw2 = (self.a1.T @ dz2) / m
        db2 = np.sum(dz2, axis=0, keepdims=True) / m
        
        dz1 = (dz2 @ self.w2.T) * self.tanh_derivative(self.z1)
        dw1 = (X.T @ dz1) / m
        db1 = np.sum(dz1, axis=0, keepdims=True) / m
        
        # Gradient clipping
        for grad in [dw1, db1, dw2, db2]:
            np.clip(grad, -1, 1, out=grad)
        
        self.w2 -= self.lr * dw2
        self.b2 -= self.lr * db2
        self.w1 -= self.lr * dw1
        self.b1 -= self.lr * db1
    
    def train(self, X, y, epochs=500):
        for epoch in range(epochs):
            output = self.forward(X)
            self.backward(X, y, output)
    
    def predict(self, X):
        return self.forward(X)


def normalize(data):
    """Normalize data to -1 to 1 range for tanh."""
    min_val = np.min(data)
    max_val = np.max(data)
    if max_val - min_val == 0:
        return np.zeros_like(data), min_val, max_val
    return 2 * (data - min_val) / (max_val - min_val) - 1, min_val, max_val

def denormalize(data, min_val, max_val):
    """Convert normalized data back to original scale."""
    return (data + 1) / 2 * (max_val - min_val) + min_val

def create_sequences(data, seq_length):
    """Create input sequences and targets for training."""
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i + seq_length])
        y.append(data[i + seq_length])
    return np.array(X), np.array(y).reshape(-1, 1)

def parse_date(date_str):
    """Parse date string with flexible format."""
    try:
        parts = date_str.strip().split(' ')
        date_part = parts[0]
        time_part = parts[1] if len(parts) > 1 else '0:0:0'
        
        year, month, day = map(int, date_part.split('-'))
        time_components = time_part.split(':')
        hour = int(time_components[0]) if len(time_components) > 0 else 0
        minute = int(time_components[1]) if len(time_components) > 1 else 0
        second = int(float(time_components[2])) if len(time_components) > 2 else 0
        
        return datetime(year, month, day, hour, minute, second)
    except Exception as e:
        print(f"Date parse error for '{date_str}': {e}", file=sys.stderr)
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
        dates = []
        prices = []
        with open(input_file, 'r') as f:
            reader = csv.reader(f)
            next(reader)  # Skip header
            for row in reader:
                if len(row) >= 2:
                    dates.append(row[0])
                    try:
                        prices.append(float(row[1]))
                    except ValueError:
                        continue
        
        print(f"[predict.py] Read {len(prices)} data points", file=sys.stderr)
        
        if len(prices) < 15:
            print("[predict.py] Not enough data points, need at least 15", file=sys.stderr)
            # Create dummy predictions based on last price
            last_price = prices[-1] if prices else 100
            predictions = [last_price * (1 + np.random.uniform(-0.02, 0.02)) for _ in range(14)]
            last_date = parse_date(dates[-1]) if dates else datetime.now()
            last_timestamp_ms = int(last_date.replace(tzinfo=timezone.utc).timestamp() * 1000)
        else:
            prices = np.array(prices)
            
            # Get last date for predictions
            last_date_str = dates[-1]
            last_date = parse_date(last_date_str)
            last_timestamp_ms = int(last_date.replace(tzinfo=timezone.utc).timestamp() * 1000)
            
            print(f"[predict.py] Last date: {last_date}, timestamp: {last_timestamp_ms}", file=sys.stderr)
            print(f"[predict.py] Price range: {prices.min():.2f} - {prices.max():.2f}", file=sys.stderr)
            
            # Calculate recent statistics for generating realistic predictions
            recent_prices = prices[-60:] if len(prices) >= 60 else prices
            daily_returns = np.diff(recent_prices) / recent_prices[:-1]
            volatility = np.std(daily_returns) if len(daily_returns) > 0 else 0.02
            
            # Detect trend from recent data
            if len(prices) >= 14:
                short_trend = (prices[-1] - prices[-7]) / prices[-7] if prices[-7] != 0 else 0
                long_trend = (prices[-1] - prices[-14]) / prices[-14] if prices[-14] != 0 else 0
                trend = (short_trend + long_trend) / 2
            else:
                trend = 0
            
            print(f"[predict.py] Volatility: {volatility:.4f}, Trend: {trend:.4f}", file=sys.stderr)
            
            # Neural network training for pattern learning
            seq_length = min(14, len(prices) - 1)
            norm_prices, min_price, max_price = normalize(prices)
            X, y = create_sequences(norm_prices, seq_length)
            
            if len(X) > 0:
                nn = SimpleNeuralNet(input_size=seq_length, hidden_size=16, learning_rate=0.01)
                nn.train(X, y, epochs=300)
                
                # Get neural net's base prediction direction
                current_seq = norm_prices[-seq_length:].copy()
                nn_pred = nn.predict(current_seq.reshape(1, -1))[0, 0]
                nn_direction = np.sign(nn_pred - norm_prices[-1])
            else:
                nn_direction = np.sign(trend)
            
            # Generate predictions using a combination of:
            # 1. Neural network direction
            # 2. Trend momentum with decay
            # 3. Random walk with volatility
            # 4. Mean reversion
            
            prediction_days = 14
            predictions = []
            current_price = float(prices[-1])
            mean_price = float(np.mean(recent_prices))
            
            for i in range(prediction_days):
                # Trend component (decaying)
                trend_decay = 0.85 ** i
                trend_move = current_price * trend * trend_decay * 0.5
                
                # Volatility/random walk component
                random_move = current_price * np.random.normal(0, volatility * 1.5)
                
                # Mean reversion component (subtle pull towards mean)
                mean_reversion = (mean_price - current_price) * 0.02
                
                # Neural network influence
                nn_move = current_price * nn_direction * volatility * 0.3 * (0.9 ** i)
                
                # Combine all components
                price_change = trend_move + random_move + mean_reversion + nn_move
                
                # Calculate new price
                new_price = current_price + price_change
                
                # Ensure price stays positive and within reasonable bounds
                new_price = max(new_price, current_price * 0.7)  # Max 30% drop
                new_price = min(new_price, current_price * 1.3)  # Max 30% rise
                new_price = max(new_price, 0.001)  # Stay positive
                
                predictions.append(new_price)
                current_price = new_price
            
            predictions = np.array(predictions)
        
        print(f"[predict.py] Generated {len(predictions)} predictions", file=sys.stderr)
        print(f"[predict.py] Prediction range: {min(predictions):.2f} - {max(predictions):.2f}", file=sys.stderr)
        
        # Build output CSV
        output_lines = ['i,ds,y']
        one_day_ms = 1000 * 60 * 60 * 24
        
        for i, pred in enumerate(predictions):
            timestamp = last_timestamp_ms + (one_day_ms * (i + 1))
            output_lines.append(f"{i},{int(timestamp)},{float(pred)}")
        
        output_csv = '\n'.join(output_lines) + '\n'
        
        # Ensure predictions-cache directory exists
        cache_dir = './predictions-cache'
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        
        # Save to cache
        output_path = os.path.join(cache_dir, f"{coin_name}.csv")
        with open(output_path, 'w') as f:
            f.write(output_csv)
        
        print(f"[predict.py] Saved predictions to {output_path}", file=sys.stderr)
        
        # Print to stdout
        print(output_csv)
        
    except Exception as e:
        print(f"[predict.py] Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
