const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDB(options = {}) {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/restaurantpro';
  const timeoutMs = options.timeoutMs || 8000;

  connectionPromise = mongoose
    .connect(uri, { serverSelectionTimeoutMS: timeoutMs })
    .then(() => {
      console.log('\x1b[32m%s\x1b[0m', '✓ MongoDB connected successfully');
      connectionPromise = null;
      return true;
    })
    .catch((err) => {
      connectionPromise = null;
      console.log('\n\x1b[33m%s\x1b[0m', '================================================================');
      console.log('\x1b[33m%s\x1b[0m', '  ⚠️  Could not connect to MongoDB database');
      console.log('\x1b[33m%s\x1b[0m', '----------------------------------------------------------------');
      console.log(`  Details: ${err.message}`);
      console.log('');
      console.log('  👉 HOW TO FIX (MongoDB Atlas):');
      console.log('  1. Open https://cloud.mongodb.com and log in.');
      console.log('  2. Click "Network Access" under "Security" in the left sidebar.');
      console.log('  3. Click "Add IP Address" -> choose "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0).');
      console.log('  4. Click "Confirm" (takes ~10 seconds).');
      console.log('');
      console.log('  👉 OR IF RUNNING LOCAL MONGODB:');
      console.log('  Start MongoDB service on mongodb://127.0.0.1:27017/restaurantpro');
      console.log('\x1b[33m%s\x1b[0m', '================================================================\n');

      if (options.exitOnError) {
        process.exit(1);
      }
      return false;
    });

  return connectionPromise;
}

module.exports = connectDB;
