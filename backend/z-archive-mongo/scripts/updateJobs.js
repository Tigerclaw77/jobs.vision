// const { MongoClient, ObjectId } = require('mongodb');
// require('dotenv').config();

// const uri = process.env.MONGO_URI;
// const dbName = 'Opportometry';
// const collectionName = 'jobs';

// const client = new MongoClient(uri);

// async function run() {
//   try {
//     await client.connect();
//     console.log('✅ Connected to MongoDB');

//     const db = client.db(dbName);
//     const jobs = db.collection(collectionName);

//     // ✅ Updated with exact ObjectIds from your list
//     const updates = [
//       {
//         id: '67b56371231db20d27f0bf6b',
//         data: {
//           location: 'The Woodlands, TX',
//           latitude: 30.1659,
//           longitude: -95.4613,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b56371231db20d27f0bf6e',
//         data: {
//           location: 'Spring, TX',
//           latitude: 30.0799,
//           longitude: -95.4172,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b56371231db20d27f0bf71',
//         data: {
//           location: 'Shenandoah, TX',
//           latitude: 30.1735,
//           longitude: -95.4550,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b652f03464fb308cca3733',
//         data: {
//           location: 'Magnolia, TX',
//           latitude: 30.2090,
//           longitude: -95.7508,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b6b1fe22431078338c877d',
//         data: {
//           location: 'Tomball, TX',
//           latitude: 30.0971,
//           longitude: -95.6161,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b6b57e22431078338c877f',
//         data: {
//           location: 'Porter, TX',
//           latitude: 30.1043,
//           longitude: -95.2355,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b6b7a1c41fef1105f7dada',
//         data: {
//           location: 'Humble, TX',
//           latitude: 29.9988,
//           longitude: -95.2622,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b78f2fe03346cb291b74cd',
//         data: {
//           location: 'Kingwood, TX',
//           latitude: 30.0560,
//           longitude: -95.1820,
//           state: 'TX',
//         },
//       },
//       {
//         id: '67b7d8ac455410383f23209f',
//         data: {
//           location: 'Conroe, TX',
//           latitude: 30.3119,
//           longitude: -95.4561,
//           state: 'TX',
//         },
//       },
//     ];

//     for (const update of updates) {
//       const result = await jobs.updateOne(
//         { _id: new ObjectId(update.id) },
//         { $set: update.data }
//       );

//       if (result.modifiedCount === 1) {
//         console.log(`✅ Successfully updated job with ID: ${update.id}`);
//       } else {
//         console.warn(`⚠️ No matching job found or already updated for ID: ${update.id}`);
//       }
//     }

//   } catch (err) {
//     console.error('❌ Error:', err);
//   } finally {
//     await client.close();
//     console.log('🔒 MongoDB connection closed');
//   }
// }

// run();
