// const { MongoClient } = require('mongodb');
// require('dotenv').config(); // ✅ Load .env variables

// const uri = process.env.MONGO_URI; // ✅ Grab your MONGO_URI from .env

// if (!uri) {
//   console.error('❌ MONGO_URI not found in .env file!');
//   process.exit(1);
// }

// async function debug() {
//   const client = new MongoClient(uri);

//   try {
//     await client.connect();
//     console.log('✅ Connected to MongoDB');

//     const db = client.db('Opportometry'); // ✅ Confirm your database name
//     const jobsCollection = db.collection('jobs'); // ✅ Confirm your collection name

//     const jobs = await jobsCollection.find().limit(5).toArray();

//     if (jobs.length === 0) {
//       console.warn('⚠️ No jobs found in Opportometry.jobs collection');
//     } else {
//       console.log(`✅ Found ${jobs.length} jobs`);
//       console.log('📝 First 5 Jobs:', jobs);
//     }

//   } catch (err) {
//     console.error('❌ Error:', err.message);
//   } finally {
//     await client.close();
//     console.log('🔒 Connection closed');
//   }
// }

// debug();
