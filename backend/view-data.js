require("dotenv").config();
const pool = require('./db');
async function showData() {
  try {
    setInterval(async () => {
      const result = await pool.query('SELECT id, voltage, current, power, energy_kwh, timestamp FROM energy_readings ORDER BY id DESC LIMIT 10');
      console.clear();
      console.log('='.repeat(80));
      console.log('📊 ENERGY READINGS DATABASE (Last 10 Records)');
      console.log('='.repeat(80));
      result.rows.forEach(row => {
        console.log(`ID: ${row.id} | Voltage: ${row.voltage}V | Current: ${row.current}A | Power: ${row.power}W | Energy: ${row.energy_kwh}kWh | Time: ${row.timestamp}`);
      });
      console.log('='.repeat(80));
      console.log('(Refreshing every 5 seconds...)');
    }, 5000);
  } catch (err) {
    console.error('Database error:', err);
  }
}

showData();
