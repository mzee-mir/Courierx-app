import { Schema, model, Document, Types } from 'mongoose';

export enum ImportStatus {
  DECLARED = 'DECLARED',                     // User added tracking number
  RECEIVED_AT_ORIGIN = 'RECEIVED_AT_ORIGIN', // China Hub received & weighed
  CONSOLIDATED = 'CONSOLIDATED',             // Packed into container
  IN_TRANSIT = 'IN_TRANSIT',                 // On Sea/Air
  ARRIVED_LOCAL = 'ARRIVED_LOCAL',           // At Port/Airport of Somalia
  READY_FOR_LOCAL_HANDOFF = 'READY_FOR_LOCAL_HANDOFF', // Cleared Customs
  HANDED_OFF = 'HANDED_OFF',                 // Transferred to CourierX Local Order
  DELIVERED = 'DELIVERED',                   // Final destination reached
  CANCELLED = 'CANCELLED',
  EXCEPTION = "EXCEPTION",
  WEIGHT_DISPUTE = 'WEIGHT_DISPUTE',
  CUSTOMS_HOLD = 'CUSTOMS_HOLD',
  LOST = 'LOST',
  RETURN_TO_SENDER = 'RETURN_TO_SENDER',
  EXPIRED = 'EXPIRED',
  PENDING_CUSTOMER_ACTION = 'PENDING_CUSTOMER_ACTION'
}

export interface IImportRequest extends Document {
  userId: Types.ObjectId;

  // PHYSICAL CUSTODY & AUTHORITY
  partnerId?: Types.ObjectId;      // Current Organization in control
  locationId?: Types.ObjectId;     // Current physical node (Warehouse/Port)

  // LEG ASSIGNMENTS (Admin controlled)
  chinaAgentId?: Types.ObjectId;
  freightPartnerId?: Types.ObjectId;
  clearingAgentId?: Types.ObjectId;

  // SHIPMENT CORE DATA
  externalTrackingNumber: string; // Alibaba / China Post ID
  itemDescription: string;
  originCountry: string;
  packageCode: string;

  // INTEGRITY GUARDS (Immutable once set)
  intake_weight: number;  // Set at China Hub
  arrival_weight?: number; // Set at Somalia Port

  status: ImportStatus;
  statusHistory: {
    status: string;
    changedAt: Date;
    changedBy: Types.ObjectId;
    changedByRole?: string;
    notes?: string;
  }[];
  customsDeclaration?: {
    declaredValue?: number;
    declaredCurrency?: string;
    hsCode?: string;
    countryOfManufacture?: string;
    quantity?: number;
    commercialInvoiceUrl?: string;
  };
  pendingAction?: {
    type: 'ACCEPT_REVISED_PRICE' | 'UPLOAD_CUSTOMS_DOC' | 'PAY_DUTIES' | 'CONFIRM_ADDRESS';
    deadline?: Date;
    details?: string;
  };
  declarationExpiresAt: Date;

  resolverSnapshot?: {
    image: string;
    name: string;
    phone: string;
    deliveryLandmark: string;
    deliveryCoords: [number, number]; // [lng, lat]
  };
  resolvedAt?: Date;
  currentLocationId?: Types.ObjectId; // For tracking current physical location
  manifestId?: Types.ObjectId; // If part of a bulk manifest
  binLocation?: string; // e.g., "A-12-04"
  intakeMethod: 'SCAN' | 'BULK_MANIFEST';
  hasPhotos: boolean;
  intakePhotos: {
    url: string;
    uploadedAt: Date;
  }[];

  // EXCEPTION HANDLING
  isFlagged: boolean;
  exceptionType?: 'WEIGHT_DISCREPANCY' | 'CUSTOMS_HOLD' | 'DAMAGED' | 'PROHIBITED' | 'LOST' | 'DATA_INTEGRITY_FAILURE';
  transportMode: 'AIR' | 'SEA';
  dimensions?: {
    length: number; // cm
    width: number;  // cm
    height: number; // cm
  };
  volumetricWeightKg?: number;
  chargeableWeightKg?: number;
  calculatedCBM?: number; // Cubic Meter volume
  // LOCAL HANDOFF DATA (Used to generate local order)
  preferredLocalVehicle: 'bajaj' | 'car' | 'truck';
  dropoffLandmark: string;
  dropoffLocation: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  pricingSnapshot: {
    rateCardId?: Types.ObjectId;
    totalCustomerPaid: number;
    partnerShare: number;
    systemShare: number;
    baseRateAtIntake?: number;
  };
  destinationBranchId?: Types.ObjectId;
  isDomesticPaid: boolean;
  domesticSurcharge: number;

  localOrderId?: Types.ObjectId; // Link to CourierX Order

  createdAt: Date;
  updatedAt: Date;
  __v: number; // For Optimistic Locking
}

const ImportRequestSchema = new Schema<IImportRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // CUSTODY
    partnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'PartnerLocation', index: true },

    // LEG ASSIGNMENTS
    chinaAgentId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization' },
    freightPartnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization' },
    clearingAgentId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization' },

    externalTrackingNumber: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
      index: true
    },
    itemDescription: { type: String, required: true },
    originCountry: { type: String, required: true },

    // WEIGHT GUARDS (Mongoose Immutable Logic)
    intake_weight: { type: Number }, // Locked at China Hub
    arrival_weight: { type: Number }, // Locked at Mogadishu Port

    status: {
      type: String,
      enum: Object.values(ImportStatus),
      default: ImportStatus.DECLARED,
      index: true,
    },
    statusHistory: [{
      status: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      changedByRole: { type: String },
      notes: { type: String },
    }],
    customsDeclaration: {
      declaredValue: { type: Number },
      declaredCurrency: { type: String, default: 'USD' },
      hsCode: { type: String },
      countryOfManufacture: { type: String },
      quantity: { type: Number },
      commercialInvoiceUrl: { type: String },
    },
    pendingAction: {
      type: { type: String, enum: ['ACCEPT_REVISED_PRICE', 'UPLOAD_CUSTOMS_DOC', 'PAY_DUTIES', 'CONFIRM_ADDRESS'] },
      deadline: { type: Date },
      details: { type: String },
    },
    declarationExpiresAt: { 
      type: Date, 
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) 
    },
    pricingSnapshot: {
      rateCardId: { type: Schema.Types.ObjectId, ref: 'PartnerRateCard' },
      totalCustomerPaid: { type: Number, required: true },
      partnerShare: { type: Number, required: true },  // $3.00 portion
      systemShare: { type: Number, required: true },   // $0.50 portion
      baseRateAtIntake: { type: Number }
    },
    binLocation: { type: String, trim: true }, // e.g., "A-12-04"
    intakeMethod: { type: String, enum: ['SCAN', 'BULK_MANIFEST'], required: true },
    manifestId: { type: Schema.Types.ObjectId, ref: 'Manifest' },
    hasPhotos: { type: Boolean, default: false },
    intakePhotos: [{
      url: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    packageCode: { type: String, length: 8 },
    transportMode: { type: String, enum: ['AIR', 'SEA'], required: true },
    dimensions: {
      length: Number, // cm
      width: Number,  // cm
      height: Number  // cm
    },
    volumetricWeightKg: { type: Number },
    chargeableWeightKg: { type: Number },
    destinationBranchId: { type: Schema.Types.ObjectId, ref: 'PartnerLocation', required: false },
    isDomesticPaid: { type: Boolean, default: false },
    domesticSurcharge: { type: Number, default: 0 },
    calculatedCBM: { type: Number },
    isFlagged: { type: Boolean, default: false },
    exceptionType: {
      type: String,
      enum: ['WEIGHT_DISCREPANCY', 'CUSTOMS_HOLD', 'DAMAGED', 'PROHIBITED', 'LOST']
    },

    resolverSnapshot: {
      name: String,
      phone: String,
      deliveryLandmark: String,
      deliveryCoords: [Number] // [lng, lat]
    },
    resolvedAt: Date,

    currentLocationId: { type: Schema.Types.ObjectId, ref: 'PartnerLocation' },

    preferredLocalVehicle: {
      type: String,
      enum: ['bajaj', 'car', 'truck'],
      default: 'bajaj'
    },
    dropoffLandmark: { type: String, required: true },
    dropoffLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    localOrderId: { type: Schema.Types.ObjectId, ref: 'Order' }
  },
  {
    timestamps: true,
    optimisticConcurrency: true // 👈 Enable Module D (Concurrency Control)
  }
);

// Search optimization
ImportRequestSchema.index({ dropoffLocation: '2dsphere' });
ImportRequestSchema.index({ externalTrackingNumber: 'text' });
ImportRequestSchema.index({ userId: 1, status: 1 });
ImportRequestSchema.index({ partnerId: 1, status: 1 });
ImportRequestSchema.index({ createdAt: -1 });
ImportRequestSchema.index({ status: 1, updatedAt: 1 });

export const ImportRequest = model<IImportRequest>('ImportRequest', ImportRequestSchema);