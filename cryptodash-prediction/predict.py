# Python
import pandas as pd
from fbprophet import Prophet
import sys

df = pd.read_csv(sys.argv[1])
df.head()

m = Prophet()
m.fit(df)

future = m.make_future_dataframe(periods=90)
future.tail()

forecast = m.predict(future)
forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail()

forecast.to_csv("./predictions-cache/"+sys.argv[1])

#fig1 = m.plot(forecast)
