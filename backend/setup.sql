CREATE DATABASE energy_monitoring;
\c energy_monitoring
CREATE TABLE IF NOT EXISTS energy_readings (
  id SERIAL PRIMARY KEY,
  voltage DECIMAL(5,2),
  current DECIMAL(5,3),
  power DECIMAL(6,2),
  energy_kwh DECIMAL(8,4),
  timestamp TIMESTAMP WITH TIME ZONE
);
ALTER USER postgres PASSWORD 'ezzybii2';
