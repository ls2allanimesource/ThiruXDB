import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'thiruXDB';

if (!uri) {
  throw new Error('MONGODB_URI environment variable is not set');
}

let client;
let db;

export async function connectDb() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes(db);
  console.log(`Connected to MongoDB: ${dbName}`);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not connected. Call connectDb() first.');
  return db;
}

async function ensureIndexes(db) {
  // api_endpoints indexes
  const endpoints = db.collection('api_endpoints');
  await endpoints.createIndex({ is_active: 1 });
  await endpoints.createIndex({ created_at: -1 });

  // data_records indexes
  const records = db.collection('data_records');
  await records.createIndex({ endpoint_id: 1 });
  await records.createIndex({ fetched_at: -1 });
  await records.createIndex({ endpoint_id: 1, external_id: 1 }, { unique: true, sparse: true });
  // Text index for full-text search on raw_data (stored as string field)
  try {
    await records.createIndex({ _search_text: 'text' });
  } catch {
    // Index may already exist
  }

  // fetch_logs indexes
  const logs = db.collection('fetch_logs');
  await logs.createIndex({ endpoint_id: 1, created_at: -1 });
  await logs.createIndex({ created_at: -1 });
}
