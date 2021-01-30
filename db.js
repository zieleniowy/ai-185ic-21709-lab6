// Import Dependencies
const url = require('url')
const MongoDB = require('mongodb');
MongoClient = MongoDB.MongoClient

let cachedDb = null

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb
  }
  const client = await MongoClient.connect(process.env.MONGO_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true })
  const db = await client.db(process.env.MONGO_DB)
  cachedDb = db
  return db
}
connectToDatabase();


const getCollection = async (collection) => {
  const db = await connectToDatabase();
  return await db.collection(collection);
}
const o = {
  id: MongoDB.ObjectID

};

getCollection('users').then(col=>o.users = col);

Object.defineProperty(o, 'handle', { get: ()=>cachedDb })
module.exports = o;