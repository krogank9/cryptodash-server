
import numpy as np 
import pandas as pd 
from matplotlib import pyplot as plt
import sys

import tensorflow as tf

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
from tensorflow.keras.layers import LSTM

from tensorflow import keras

from sklearn.preprocessing import MinMaxScaler
min_max_scaler = MinMaxScaler()


#--------

import time
from datetime import timezone
from datetime import datetime

df = pd.read_csv(sys.argv[1])

pd_date = df.tail(1).values[0][0]
datetime_object = datetime.strptime(pd_date, '%Y-%m-%d %H:%M:%S')
last_real_date = datetime_object.replace(tzinfo=timezone.utc).timestamp() * 1000

df_norm = df.drop(['ds'], 1, inplace=True)

prediction_days = 90

df_train= df[:len(df)-prediction_days]
df_test= df[len(df)-prediction_days:]

#-----------

training_set = df_train.values
training_set = min_max_scaler.fit_transform(training_set)

x_train = training_set[0:len(training_set)-1]
y_train = training_set[1:len(training_set)]
x_train = np.reshape(x_train, (len(x_train), 1, 1))

#------------------
# load model
#------------------

regressor = keras.models.load_model('model.keras')

#------------------
# predict
#------------------

test_set = df_test.values

inputs = np.reshape(test_set, (len(test_set), 1))
inputs = min_max_scaler.transform(inputs)
inputs = np.reshape(inputs, (len(inputs), 1, 1))

predicted_price = regressor.predict(inputs)
predicted_price = min_max_scaler.inverse_transform(predicted_price)

def makeDateTuple(i, val):
    
    return [last_real_date + iDays, val]

prices = predicted_price[:, 0].tolist()
pricesWithDates = [['i', 'ds', 'y']]
for i in range(len(prices)):
    iDays = 1000*60*60*24 * (i + 1)
    elem = [i, int(last_real_date + iDays), prices[i]]
    pricesWithDates.append(elem)

csv = ""
for i in range(len(pricesWithDates)):
    csv += ",".join(map(str, pricesWithDates[i]))
    csv += "\n"

print(csv)
f = open("./predictions-cache/"+sys.argv[1], "w")
f.write(csv)
f.close()