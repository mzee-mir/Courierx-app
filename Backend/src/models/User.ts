// Backend/src/models/User.ts
import { Schema, model, Document } from 'mongoose';

export enum UserRole {
  CUSTOMER = 'customer',
  DRIVER = 'driver',
  MERCHANT = 'merchant',
  SUPER_ADMIN = 'super_admin',
  OPS_ADMIN = 'ops_admin',
  FINANCE_ADMIN = 'finance_admin',
  SUPPORT_ADMIN = 'support_admin',
  PARTNER_OWNER = 'partner_owner', // Org management
  PARTNER_OPS = 'partner_ops',     // Scanning and status updates
  PARTNER_READONLY = 'partner_readonly'
}

export interface IUser extends Document {
  firebaseUid: string;
  phoneNumber?: string;
  email?: string;
  password?: string;
  displayName?: string;
  imageUrl?: string;
  pushToken: string;
  partnerId?: Schema.Types.ObjectId;
  assignedLocations: Schema.Types.ObjectId[];
  permissions: string[];
  cxCode?: string; // e.g., CX-8821
  // NEW: Support for holding multiple professional roles
  roles: UserRole[];
  // NEW: authoritative flag for professional/driver access
  isVerified: boolean;
  tokenVersion: number;
  isSuspended: boolean;
  lastLogin: Date;
  createdAt: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  notificationPreferences: {
    import_received:       boolean;
    import_in_transit:     boolean;
    import_customs_hold:   boolean;
    import_arrived:        boolean;
    import_ready:          boolean;
    import_weight_dispute: boolean;
    import_delivered:      boolean;
  };
}

const userSchema = new Schema<IUser>({
  firebaseUid: { type: String, required: true, unique: true, select: false },
  phoneNumber: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  password: {
    type: String,
    select: false // Crucial: Prevents password from showing up in queries by default
  },
  pushToken: { type: String, select: false },
  displayName: { type: String, default: 'CourierX User' },
  imageUrl: { type: String },
  roles: {
    type: [String],
    enum: Object.values(UserRole),
    default: [UserRole.CUSTOMER] // All users are customers by default
  },
  partnerId: {
    type: Schema.Types.ObjectId,
    ref: 'PartnerOrganization',
    index: true
  },
  assignedLocations: [{
    type: Schema.Types.ObjectId,
    ref: 'PartnerLocation'
  }],
  permissions: {
    type: [String],
    default: ['PARTNER_READ'] // Every staff gets basic view access by default
  },
  cxCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true
  }, // e.g., CX-8821
  isVerified: {
    type: Boolean,
    default: false // Verification is an administrative action
  },
  tokenVersion: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  isSuspended: {
    type: Boolean,
    default: false // 👈 Add this line to the schema
  },
  lastLogin: { type: Date, default: Date.now },
  notificationPreferences: {
    import_received:       { type: Boolean, default: true },
    import_in_transit:     { type: Boolean, default: true },
    import_customs_hold:   { type: Boolean, default: true },
    import_arrived:        { type: Boolean, default: true },
    import_ready:          { type: Boolean, default: true },
    import_weight_dispute: { type: Boolean, default: true },
    import_delivered:      { type: Boolean, default: true },
  },
}, {
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      const obj = ret as any;
      delete obj.__v;
      return obj;
    }
  }
});

// Index roles for fast marketplace queries (e.g. Find all online drivers)
userSchema.index({ roles: 1, isSuspended: 1 });

export const User = model<IUser>('User', userSchema);