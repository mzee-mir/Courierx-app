import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserRole } from './models/User'; // Ensure UserRole is imported
import dotenv from 'dotenv';

dotenv.config();
const seedAdmin = async () => {
  // Ensure MONGODB_URI is available
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for Seeding');

    const email = 'admin@courierx.so'; // 👈 Your admin email
    const password = 'CourierXSecurePassword123!'; // 👈 Your SUPER ADMIN password

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create or Update the Super Admin user
    const adminUser = await User.findOneAndUpdate(
      { email }, // Find by email
      {
        email,
        password: hashedPassword,
        displayName: 'Super Admin',
        roles: [UserRole.SUPER_ADMIN], // Assign SUPER_ADMIN role
        isVerified: true, // Admins are always verified
        firebaseUid: 'MANUAL_SUPER_ADMIN_SEED', // Placeholder for non-Firebase logins
        lastLogin: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true } // Create if not exists, return new doc
    );

    console.log(`✅ Super Admin "${adminUser.email}" created/updated successfully.`);
    console.log(`🔑 Password set to: "${password}" (Please change after first login)`);
    
  } catch (error) {
    console.error('❌ Error seeding Super Admin:', error);
    process.exit(1); // Exit with an error code
  } finally {
    await mongoose.disconnect(); // Disconnect from DB
    console.log('MongoDB Disconnected after Seeding');
  }
};

// Execute the seed function
seedAdmin();