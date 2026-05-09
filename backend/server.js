require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

function generateFakeReading() {
  const now = new Date();
  const basePower = 150 + Math.random() * 200;
  const powerVariation = (Math.sin(now.getTime() / 10000) * 50) + (Math.random() - 0.5) * 20;
  const power = Math.max(0, basePower + powerVariation);
  const baseVoltage = 220 + Math.random() * 20;
  const voltageVariation = Math.sin(now.getTime() / 15000) * 5;
  const voltage = baseVoltage + voltageVariation;
  const current = power / voltage;
  return {
    timestamp: now.toISOString(),
    voltage: Math.round(voltage * 100) / 100,
    current: Math.round(current * 1000) / 1000,
    power: Math.round(power * 100) / 100,
    energy_kwh: Math.round((power / 1000) * (5 / 3600) * 1000) / 1000
  };
}

async function insertSimulatedData() {
  try {
    const reading = generateFakeReading();
    const query = "INSERT INTO energy_readings (voltage, current, power, energy_kwh, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING *";
    const values = [reading.voltage, reading.current, reading.power, reading.energy_kwh, reading.timestamp];
    const result = await pool.query(query, values);
    console.log("? Data inserted successfully: " + reading.power + "W, " + reading.voltage + "V, " + reading.current + "A, " + reading.energy_kwh + "kWh");
    return result.rows[0];
  } catch (error) {
    console.error("? Error inserting simulated data:", error.message);
    throw error;
  }
}


console.log("?? Starting IoT Energy Monitoring Simulation...");
console.log("?? Inserting simulated data every 5 seconds into PostgreSQL");

let accumulatedEnergyToday = 0;
let lastResetDate = new Date().toDateString();

setInterval(async () => {
  try {
    const now = new Date();
    const currentDate = now.toDateString();
    
    // Reset accumulator if day changed
    if (currentDate !== lastResetDate) {
      accumulatedEnergyToday = 0;
      lastResetDate = currentDate;
    }

    // Generate natural power fluctuation
    const basePower = 150 + Math.random() * 200;
    const powerVariation = (Math.sin(now.getTime() / 10000) * 50) + (Math.random() - 0.5) * 20;
    const power = Math.max(0, basePower + powerVariation);
    
    // Generate stable voltage and current
    const baseVoltage = 220 + Math.random() * 20;
    const voltageVariation = Math.sin(now.getTime() / 15000) * 5;
    const voltage = baseVoltage + voltageVariation;
    const current = power / voltage;
    
    // Accumulate energy continuously (power * 5 seconds / 3600 seconds per hour / 1000 to convert to kWh)
    const energyThisInterval = (power * (5 / 3600)) / 1000;
    accumulatedEnergyToday += energyThisInterval;
    const totalEnergyToday = Math.round(accumulatedEnergyToday * 10000) / 10000;

    console.log(
      `Generated: ${Math.round(power)}W, ${Math.round(voltage * 100) / 100}V, ${Math.round(current * 1000) / 1000}A | Energy interval: ${Math.round(energyThisInterval * 100000) / 100000}kWh | Total today: ${totalEnergyToday}kWh`
    );

    await pool.query(
      `INSERT INTO energy_readings (voltage, current, power, energy_kwh, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        Math.round(voltage * 100) / 100,
        Math.round(current * 1000) / 1000,
        Math.round(power * 100) / 100,
        Math.round(totalEnergyToday * 10000) / 10000,
        now.toISOString()
      ]
    );

    console.log("?? Data inserted successfully");

  } catch (err) {
    console.error("?? DB ERROR:", err.message);
  }
}, 5000);

app.get("/api/readings", async (req, res) => {
  try {
    const query = "SELECT id, voltage, current, power, energy_kwh, timestamp FROM energy_readings ORDER BY timestamp DESC LIMIT 30";
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("? Error fetching readings:", err.message);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// Hourly aggregated data for charts (12 consecutive hours with forward-fill)
app.get("/api/hourly-data", async (req, res) => {
  try {
    const now = new Date();
    
    // Query: Get hourly averages for the last 12 hours
    const query = `
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        AVG(power) as avg_power,
        AVG(voltage) as avg_voltage,
        AVG(current) as avg_current
      FROM energy_readings
      WHERE timestamp >= NOW() - INTERVAL '12 hours'
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour ASC
    `;
    
    const result = await pool.query(query);
    const dbRows = result.rows;
    
    // Build 12 consecutive hourly slots with forward-fill
    const hourlyData = [];
    const latestKnown = {
      power: 350,
      voltage: 230,
      current: 350 / 230
    };
    
    for (let i = 11; i >= 0; i--) {
      const hour = new Date(now);
      hour.setMinutes(0, 0, 0);
      hour.setSeconds(0, 0);
      hour.setHours(hour.getHours() - i);
      
      const hourKey = hour.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      
      // Find matching database row for this hour
      const dbRow = dbRows.find(r => {
        const dbHourKey = new Date(r.hour).toISOString().slice(0, 13);
        return dbHourKey === hourKey;
      });
      
      if (dbRow) {
        // Use database values and update lastKnown for forward-fill
        latestKnown.power = Number(dbRow.avg_power) || latestKnown.power;
        latestKnown.voltage = Number(dbRow.avg_voltage) || latestKnown.voltage;
        latestKnown.current = Number(dbRow.avg_current) || latestKnown.current;
      }
      
      // Add to hourly data (forward-filled with latestKnown)
      hourlyData.push({
        timestamp: hour.toISOString(),
        power: Number(latestKnown.power.toFixed(2)),
        voltage: Number(latestKnown.voltage.toFixed(2)),
        current: Number(latestKnown.current.toFixed(2))
      });
    }
    
    res.json(hourlyData);
  } catch (err) {
    console.error("? Error fetching hourly data:", err.message);
    res.status(500).json({ error: "Failed to fetch hourly data" });
  }
});

// Cost totals (daily, monthly, yearly) based on cumulative energy
app.get("/api/cost-totals", async (req, res) => {
  try {
    const COST_PER_UNIT = 25; // KES per kWh

    const result = await pool.query(`
      SELECT
        COALESCE(
          SUM(CASE
            WHEN timestamp >= date_trunc('day', NOW())
            THEN energy_kwh ELSE 0
          END), 0
        ) AS daily_kwh,

        COALESCE(
          SUM(CASE
            WHEN timestamp >= date_trunc('month', NOW())
            THEN energy_kwh ELSE 0
          END), 0
        ) AS monthly_kwh,

        COALESCE(
          SUM(CASE
            WHEN timestamp >= date_trunc('year', NOW())
            THEN energy_kwh ELSE 0
          END), 0
        ) AS yearly_kwh
      FROM energy_readings
    `);

    const row = result.rows[0];

    const totals = {
      dailyEnergy: Number(row.daily_kwh || 0),
      monthlyEnergy: Number(row.monthly_kwh || 0),
      yearlyEnergy: Number(row.yearly_kwh || 0),

      dailyCost: Number((Number(row.daily_kwh || 0) * COST_PER_UNIT).toFixed(2)),
      monthlyCost: Number((Number(row.monthly_kwh || 0) * COST_PER_UNIT).toFixed(2)),
      yearlyCost: Number((Number(row.yearly_kwh || 0) * COST_PER_UNIT).toFixed(2)),

      costPerUnit: COST_PER_UNIT
    };

    res.json(totals);
  } catch (err) {
    console.error("? Error fetching cost totals:", err.message);
    res.status(500).json({ error: "Failed to fetch cost totals" });
  }
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "Database connected successfully", timestamp: result.rows[0].now });
  } catch (err) {
    console.error("? Database connection error:", err.message);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// User Management Endpoints

// Signup endpoint
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    // Check if user already exists
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Insert new user
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, password]
    );

    const userId = result.rows[0].id;

    // Create default user preferences
    await pool.query(
      "INSERT INTO user_preferences (user_id, max_voltage, max_current, cost_per_kwh) VALUES ($1, 240, 8, 25)",
      [userId]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("? Signup error:", err.message);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("? Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get user by email
app.get("/api/users/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("? Error fetching user:", err.message);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get user preferences
app.get("/api/users/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT * FROM user_preferences WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Preferences not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("? Error fetching preferences:", err.message);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// Update user preferences
app.put("/api/users/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;
    const { max_voltage, max_current, cost_per_kwh, enable_alerts } = req.body;

    const result = await pool.query(
      "UPDATE user_preferences SET max_voltage = $1, max_current = $2, cost_per_kwh = $3, enable_alerts = $4, updated_at = CURRENT_TIMESTAMP WHERE user_id = $5 RETURNING *",
      [max_voltage, max_current, cost_per_kwh, enable_alerts, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Preferences not found" });
    }

    res.json({
      message: "Preferences updated successfully",
      preferences: result.rows[0]
    });
  } catch (err) {
    console.error("? Error updating preferences:", err.message);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// Get all alerts for a user
app.get("/api/users/:userId/alerts", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("? Error fetching alerts:", err.message);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// Create alert
app.post("/api/users/:userId/alerts", async (req, res) => {
  try {
    const { userId } = req.params;
    const { alert_type, message, severity } = req.body;

    const result = await pool.query(
      "INSERT INTO alerts (user_id, alert_type, message, severity) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, alert_type, message, severity || "warning"]
    );

    res.status(201).json({
      message: "Alert created",
      alert: result.rows[0]
    });
  } catch (err) {
    console.error("? Error creating alert:", err.message);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

// Save report to database
app.post("/api/users/:userId/reports", async (req, res) => {
  try {
    const { userId } = req.params;
    const { report_type, report_date, total_energy, average_power, peak_power, estimated_cost, data } = req.body;

    const result = await pool.query(
      "INSERT INTO reports (user_id, report_type, report_date, total_energy, average_power, peak_power, estimated_cost, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [userId, report_type, report_date, total_energy, average_power, peak_power, estimated_cost, JSON.stringify(data)]
    );

    res.status(201).json({
      message: "Report saved successfully",
      report: result.rows[0]
    });
  } catch (err) {
    console.error("? Error saving report:", err.message);
    res.status(500).json({ error: "Failed to save report" });
  }
});

// Get all saved reports for a user
app.get("/api/users/:userId/reports", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      "SELECT * FROM reports WHERE user_id = $1 ORDER BY report_date DESC",
      [userId]
    );

    res.json({
      reports: result.rows.map(r => ({
        ...r,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      }))
    });
  } catch (err) {
    console.error("? Error retrieving reports:", err.message);
    res.status(500).json({ error: "Failed to retrieve reports" });
  }
});

// Get specific report
app.get("/api/users/:userId/reports/:reportId", async (req, res) => {
  try {
    const { userId, reportId } = req.params;

    const result = await pool.query(
      "SELECT * FROM reports WHERE id = $1 AND user_id = $2",
      [reportId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = result.rows[0];
    res.json({
      ...report,
      data: typeof report.data === 'string' ? JSON.parse(report.data) : report.data
    });
  } catch (err) {
    console.error("? Error retrieving report:", err.message);
    res.status(500).json({ error: "Failed to retrieve report" });
  }
});

// Delete report
app.post("/api/users/:userId/reports/:reportId/delete", async (req, res) => {
  try {
    const { userId, reportId } = req.params;

    const result = await pool.query(
      "DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING *",
      [reportId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ message: "Report deleted successfully" });
  } catch (err) {
    console.error("? Error deleting report:", err.message);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("?? Backend running on http://localhost:" + PORT);
  console.log("?? PostgreSQL simulation active - inserting data every 5 seconds");
  console.log("?? Test database connection: http://localhost:" + PORT + "/api/test-db");
});
