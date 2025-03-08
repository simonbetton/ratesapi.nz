-- Schema for RatesAPI.nz Cloudflare D1 Database

-- Create table for historical data snapshots
CREATE TABLE IF NOT EXISTS historical_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL,  -- 'mortgage-rates', 'car-loan-rates', 'personal-loan-rates', 'credit-card-rates'
  date TEXT NOT NULL,       -- ISO date format (YYYY-MM-DD)
  data TEXT NOT NULL,       -- JSON string containing the entire data snapshot
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure we don't have duplicate entries for the same data_type and date
  UNIQUE(data_type, date)
);

-- Create table to store the latest data for quick access
CREATE TABLE IF NOT EXISTS latest_data (
  data_type TEXT PRIMARY KEY,  -- 'mortgage-rates', 'car-loan-rates', 'personal-loan-rates', 'credit-card-rates'
  data TEXT NOT NULL,          -- JSON string containing the entire data snapshot
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_historical_data_type ON historical_data(data_type);
CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_data(date);