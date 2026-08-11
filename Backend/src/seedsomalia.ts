import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // 👈 FIX 1: Change this line
import { User, UserRole } from './models/User';
import { PartnerLocation } from './models/PartnerLocation';
import dotenv from 'dotenv';

dotenv.config();

const seedsomalia = async () => {
  // 👈 FIX 2: You MUST connect to the DB
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing from .env");
    return;
  }
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("📦 Connected to MongoDB...");

  const portLocId = "699d9c5af6a51d35c35b87bf"; 
  
  try {
    const hashedPassword = await bcrypt.hash('PartnerSomalia123!', 12);
    
    await User.findOneAndUpdate(
      { email: 'somalia@partner.com' },
      {
        email: 'somalia@partner.com',
        password: hashedPassword,
        displayName: 'Abdullahi Port Officer',
        roles: [UserRole.PARTNER_OPS],
        partnerId: new mongoose.Types.ObjectId("6978656c24fb85681f9272e5"),
        assignedLocations: [new mongoose.Types.ObjectId(portLocId)],
        isVerified: true,
        isSuspended: false,
        tokenVersion: 0,
        firebaseUid: 'SEED_SOMALIA_PORT_001'
      },
      { upsert: true, new: true }
    );
    console.log("✅ Success: Somalia Port Operative created!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedsomalia();