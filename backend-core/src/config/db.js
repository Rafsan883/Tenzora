import mongoose from 'mongoose';
import process from 'node:process';

let cachedConnection = null;
let connecting = null;

const connectDB = async (env = process.env) => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  if (connecting) return connecting;

  try {
    const uri = env.MONGO_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is required');
    }

    console.log("Creating new MongoDB connection...");
    // In serverless/edge environments, minimize pool size and set strict timeouts
    connecting = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is unreachable
      socketTimeoutMS: 30000,
      family: 4, // Force IPv4 to avoid DNS resolution delays on some Edge nodes
    });
    const conn = await connecting;
    
    cachedConnection = conn;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return cachedConnection;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    cachedConnection = null;
    throw error;
  } finally {
    connecting = null;
  }
};

export default connectDB;
