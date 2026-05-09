require("dotenv").config();
console.log("ENV USER:", process.env.DB_USER);
const { Client } = require("pg");

async function setupDatabase() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: "energy_monitoring", // connect to default first
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Create database
    try {
      await client.query("CREATE DATABASE energy_monitoring;");
      console.log("✅ Database created");
    } catch (err) {
      if (err.code === "42P04") {
        console.log("⚠️ Database already exists");
      } else {
        throw err;
      }
    }

    await client.end();

    // Connect to energy_monitoring DB
    const dbClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: "energy_monitoring",
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    await dbClient.connect();
    console.log("✅ Connected to energy_monitoring");

    // Create energy_readings table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS energy_readings (
        id SERIAL PRIMARY KEY,
        voltage DECIMAL(5,2),
        current DECIMAL(5,3),
        power DECIMAL(6,2),
        energy_kwh DECIMAL(8,4),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ energy_readings table created");

    // Create users table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ users table created");

    // Create user_preferences table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        max_voltage DECIMAL(5,2) DEFAULT 240,
        max_current DECIMAL(5,3) DEFAULT 8,
        cost_per_kwh DECIMAL(6,2) DEFAULT 25,
        enable_alerts BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ user_preferences table created");

    // Create alerts table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'warning',
        is_resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log("✅ alerts table created");

    // Create reports table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_type VARCHAR(50) NOT NULL,
        report_date DATE NOT NULL,
        total_energy DECIMAL(10,4),
        average_power DECIMAL(8,2),
        peak_power DECIMAL(8,2),
        estimated_cost DECIMAL(10,2),
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ reports table created");

    // Create system_config table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value TEXT NOT NULL,
        description VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ system_config table created");

    // Create indexes for better performance
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_energy_readings_timestamp ON energy_readings(timestamp);
    `);
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
    `);
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    `);
    console.log("✅ Database indexes created");

    await dbClient.end();
    console.log("🎉 Setup complete!");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

setupDatabase();