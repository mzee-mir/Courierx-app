export const redactUser = (user: any) => ({
  id: user._id,
  displayName: user.displayName,
  phoneNumber: user.phoneNumber,
  email: user.email,
  roles: user.roles,
  isVerified: user.isVerified,
  isSuspended: user.isSuspended,
  assignedLocations: user.assignedLocations || [],
  imageUrl: user.imageUrl,
  permissions: user.permissions || [],
  createdAt: user.createdAt
});

export const redactOrder = (order: any) => ({
  id: order._id,
  status: order.status,
  price: order.price,
  vehicleType: order.vehicleType,
  intake_weight: order.intake_weight,
  hasPhotos: order.hasPhotos,
  intakePhotos: order.intakePhotos || [],
  arrival_weight: order.arrival_weight,
  isFlagged: order.isFlagged || false,
  exceptionType: order.exceptionType || null,
  pickupLandmark: order.pickupLandmark,
  pickupLandmarkId: order.pickupLandmarkId || null,
  pickupCoordinates: order.pickupCoordinates || order.pickupLocation?.coordinates || null,
  externalTrackingNumber: order.externalTrackingNumber,
  calculatedCBM: order.calculatedCBM,
  dimensions: order.dimensions,
  transportMode: order.transportMode,
  manifestId: order.manifestId || null,
  dropoffLandmark: order.dropoffLandmark,
  dropoffLandmarkId: order.dropoffLandmarkId || null,
  dropoffCoordinates: order.dropoffCoordinates || order.dropoffLocation?.coordinates || null,
  customerId: order.customerId?._id || order.customerId,
  driverId: order.driverId?._id || order.driverId,
  isDisputed: order.isDisputed,
  createdAt: order.createdAt,
  version: order.__v
});

export const redactUserForPartner = (user: any, capabilities: string[]) => {
  const base = {
    id: user._id,
    displayName: user.displayName,
    email: user.email,
    imageUrl: user.imageUrl,
  };

  // 👈 THE AUTHORITY SHIFT: If they have the capability, show the real phone number
  if (capabilities.includes('PARTNER_VIEW_PII')) {
    return { ...base, phoneNumber: user.phoneNumber };
  }

  // Otherwise, return masked/null
  return { ...base, phoneNumber: 'HIDDEN_CONTACT_ADMIN' };
};