
import numpy as np 
import pandas as pd 
from matplotlib import pyplot as plt
import sys

import tensorflow as tf

from tensorflow import keras

from tensorflow.keras.layers import Bidirectional, Dropout, Activation, Dense, LSTM
from tensorflow.keras.models import Sequential

from sklearn.preprocessing import MinMaxScaler
min_max_scaler = MinMaxScaler()


#--------

import time
from datetime import timezone
from datetime import datetime

df = pd.read_csv("bitcoin_all.csv")
df_norm = df.drop(['ds'], 1, inplace=True)

prediction_days = 90

df_train= df[:len(df)-prediction_days]
df_test= df[len(df)-prediction_days:]

#-----------

training_set = df_train.values
training_set = min_max_scaler.fit_transform(training_set)

training_set = training_set.reshape(-1, 1)

x_train = training_set[0:len(training_set)-1]
y_train = training_set[1:len(training_set)]
x_train = np.reshape(x_train, (len(x_train), 1, 1))

#------------------
# Setup training sequences
#------------------
"""
SEQ_LEN = 100

def to_sequences(data, seq_len):
    d = []

    for index in range(len(data) - seq_len):
        d.append(data[index: index + seq_len])

    return np.array(d)

def preprocess(data_raw, seq_len, train_split):

    data = to_sequences(data_raw, seq_len)

    num_train = int(train_split * data.shape[0])

    x_train = data[:num_train, :-1, :]
    y_train = data[:num_train, -1, :]

    x_test = data[num_train:, :-1, :]
    y_test = data[num_train:, -1, :]

    return x_train, y_train, x_test, y_test

x_train, y_train, x_test, y_test = preprocess(training_set, SEQ_LEN, train_split = 0.95)
"""

#------------------
# Setup model
#------------------

# Initialising the RNN
model = Sequential()

# LSTM layer 1
model.add(LSTM(units = 50, return_sequences=True, input_shape = (x_train.shape[1], 1)))
model.add(Dropout(0.2))
# LSTM layer 2,3,4
model.add(LSTM(units = 50, return_sequences=True))
model.add(Dropout(0.2))
model.add(LSTM(units = 50, return_sequences=True))
model.add(Dropout(0.2))
model.add(LSTM(units = 50, return_sequences=True))
model.add(Dropout(0.2))
model.add(LSTM(units = 50, return_sequences=True))
model.add(Dropout(0.2))
# LSTM layer 5
model.add(LSTM(units = 50))
model.add(Dropout(0.2))

# Adding the output layer
model.add(Dense(units = 1))

#-------------
# Compile/fit
#-------------

# Compiling the RNN
model.compile(optimizer = 'adam', loss = 'mean_squared_error')

# Using the training set to train the model
model.fit(x_train, y_train, batch_size=32, epochs=50)

model.save('model.keras')

print("Done fitting-------------------------")