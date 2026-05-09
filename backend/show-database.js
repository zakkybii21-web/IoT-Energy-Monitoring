require("dotenv").config();
const pool = require('./db');

async function showDatabase() {
  try {
    console.log('='.repeat(80));
    console.log('📊 DATABASE STRUCTURE & DATA');
    console.log('='.repeat(80));
    
    // Show all tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    
    console.log('\n📋 TABLES IN DATABASE:');
    tables.rows.forEach(row => console.log('  ✓ ' + row.table_name));
    
    // Show users count
    const users = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('\n👥 USERS: ' + users.rows[0].count);
    
    // Show user list if any
    if (users.rows[0].count > 0) {
      const userList = await pool.query('SELECT id, name, email, created_at FROM users');
      userList.rows.forEach(u => {
        console.log('  - ' + u.name + ' (' + u.email + ')');
      });
    }
    
    // Show energy readings count
    const readings = await pool.query('SELECT COUNT(*) as count FROM energy_readings');
    console.log('\n⚡ ENERGY READINGS: ' + readings.rows[0].count);
    
    // Show last 5 readings
    const lastReadings = await pool.query('SELECT id, voltage, current, power, energy_kwh, timestamp FROM energy_readings ORDER BY id DESC LIMIT 5');
    if (lastReadings.rows.length > 0) {
      console.log('\n  Recent readings:');
      lastReadings.rows.forEach(r => {
        console.log(`  ID: ${r.id} | ${r.voltage}V | ${r.current}A | ${r.power}W | ${r.energy_kwh}kWh`);
      });
    }
    
    // Show alerts
    const alerts = await pool.query('SELECT COUNT(*) as count FROM alerts');
    console.log('\n🚨 ALERTS: ' + alerts.rows[0].count);
    
    // Show reports
    const reports = await pool.query('SELECT COUNT(*) as count FROM reports');
    console.log('\n📈 REPORTS: ' + reports.rows[0].count);
    
    // Show user preferences
    const prefs = await pool.query('SELECT COUNT(*) as count FROM user_preferences');
    console.log('\n⚙️ USER PREFERENCES: ' + prefs.rows[0].count);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Database is ready!');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

showDatabase();
