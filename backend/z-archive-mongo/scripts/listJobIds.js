// require('dotenv').config(); // ✅ Load env variables
// const { MongoClient } = require('mongodb');

// const uri = process.env.MONGO_URI || 'your_mongo_uri_here';
// const dbName = 'Opportometry';
// const collectionName = 'jobs';

// const client = new MongoClient(uri);

// async function run() {
//   try {
//     await client.connect();
//     const db = client.db(dbName);
//     const jobs = db.collection(collectionName);

//     const docs = await jobs.find({}, { projection: { _id: 1, title: 1 } }).toArray();

//     console.log("✅ Job IDs:");
//     docs.forEach((doc) => {
//       console.log(`${doc.title} — ${doc._id}`);
//     });

//   } catch (err) {
//     console.error("❌ Error:", err);
//   } finally {
//     await client.close();
//   }
// }

// run();