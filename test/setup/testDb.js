const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

/**
 * Connect to the in-memory database
 */
async function connect() {
  // Only disconnect if we're already connected to a different database
  if (mongoose.connection.readyState !== 0 && !mongoose.connection.host.includes('127.0.0.1')) {
    await mongoose.disconnect();
  }

  // Prefer an externally-provided MongoDB (e.g., docker-compose mongodb-test)
  // to avoid mongodb-memory-server downloading binaries in containerized runs.
  const externalMongoUri = process.env.MONGO_URI;
  if (externalMongoUri) {
    mongoServer = undefined;
    await mongoose.connect(externalMongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    return;
  }

  // Create or reuse existing memory server
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }
  
  const mongoUri = mongoServer.getUri();

  // Only connect if not already connected to this URI
  if (mongoose.connection.readyState === 0 || mongoose.connection.host !== mongoUri) {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
}

/**
 * Drop database, close the connection and stop mongod
 */
async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Remove all the data for all db collections
 */
async function clearDatabase() {
  if (mongoose.connection.readyState !== 0) {
    // Use dropDatabase for better performance
    await mongoose.connection.dropDatabase();
  }
}

/**
 * Seed the database with test data
 */
async function seedDatabase(data) {
  for (const modelName in data) {
    const Model = mongoose.model(modelName);
    await Model.insertMany(data[modelName]);
  }
}

module.exports = {
  connect,
  closeDatabase,
  clearDatabase,
  seedDatabase,
};
