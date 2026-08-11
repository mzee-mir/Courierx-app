import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserRole } from './models/User';
import { PartnerOrganization } from './models/PartnerOrganization';
import { PartnerLocation } from './models/PartnerLocation';
import { Wallet } from './models/Wallet';
import dotenv from 'dotenv';

dotenv.config();

const seedPartner = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('📦 Connected to MongoDB for Partner Seeding...');

    // 1. Create a Test Organization (China-side)
    const org = await PartnerOrganization.findOneAndUpdate(
      { name: 'Guangzhou Logistics Hub' },
      { 
        status: 'ACTIVE',
        operatingCountries: ['CN', 'SO'] 
      },
      { upsert: true, new: true }
    );

    // 2. Create a Physical Location for that Org
    const location = await PartnerLocation.findOneAndUpdate(
      { name: 'Guangzhou Warehouse A' },
      {
        partnerId: org._id,
        type: 'WAREHOUSE',
        country: 'CN',
        city: 'Guangzhou',
        address: '123 Logistics Way, Baiyun District'
      },
      { upsert: true, new: true }
    );

    const mogadishuPort = await PartnerLocation.findOneAndUpdate(
  { name: 'Mogadishu Port Terminal' },
  {
    partnerId: org._id, // Assign to the same or a different partner
    type: 'PORT',
    country: 'SO', // 👈 This is what the frontend is looking for
    city: 'Mogadishu',
    address: 'Main Port Authority, Gate 4'
  },
  { upsert: true, new: true }
  );

  console.log("✅ Somalia Port created with ID:", mogadishuPort._id);

    // 3. Create the Partner User (Owner)
    const email = 'courierX@partner.com';
    const password = 'PartnerPassword123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    const partnerUser = await User.findOneAndUpdate(
      { email },
      {
        email,
        password: hashedPassword,
        displayName: 'Mohamed Sadiq (Warehouse Mgr)',
        roles: [UserRole.PARTNER_OWNER], // 👈 Crucial Role
        partnerId: org._id,              // 👈 Link to Org
        assignedLocations: [location._id], // 👈 Link to Location
        isVerified: true,
        isSuspended: false,
        tokenVersion: 0,
        firebaseUid: 'SEED_PARTNER_001'
      },
      { upsert: true, new: true }
    );

    // 4. Initialize the Partner Wallet (For payouts)
    await Wallet.findOneAndUpdate(
      { userId: partnerUser._id },
      { balance: 0, currency: 'USD' },
      { upsert: true }
    );

    console.log(`
    ✅ Partner Test Data Ready!
    ---------------------------------
    Email: ${email}
    Password: ${password}
    Role: ${UserRole.PARTNER_OWNER}
    Org: ${org.name}
    Location: ${location.name}
    ---------------------------------
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedPartner();