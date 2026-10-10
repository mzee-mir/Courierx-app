import { ImportStatus } from '../models/ImportRequest';
import { OrderStatus } from '../enums/OrderEnums';

/**
 * 1. LOCAL ORDER FSM (CourierX Core)
 * Governs Bajaj, Car, and Truck logistics within Somalia.
 */
export const ORDER_FSM: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CHAINED_RESERVED, OrderStatus.CANCELLED],
  [OrderStatus.CHAINED_RESERVED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.ARRIVED_AT_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.ARRIVED_AT_PICKUP]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [OrderStatus.ARRIVED_AT_DROPOFF],
  [OrderStatus.ARRIVED_AT_DROPOFF]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * 2. IMPORT SHIPMENT FSM (Global Supply Chain)
 * Hardened for Chain-of-Custody and multi-partner handoffs.
 * Logic: "Location determines Authority."
 */
export const IMPORT_FSM: Record<ImportStatus, ImportStatus[]> = {
  // --- INTAKE PHASE (Customer/China Partner) ---
  [ImportStatus.DECLARED]: [ImportStatus.RECEIVED_AT_ORIGIN, ImportStatus.CANCELLED],

  // --- WAREHOUSE PHASE (China Partner) ---
  [ImportStatus.RECEIVED_AT_ORIGIN]: [ImportStatus.CONSOLIDATED, ImportStatus.CANCELLED],
  [ImportStatus.CONSOLIDATED]: [ImportStatus.IN_TRANSIT],

  // --- TRANSIT PHASE (System Owned) ---
  [ImportStatus.IN_TRANSIT]: [ImportStatus.ARRIVED_LOCAL],

  // --- ARRIVAL & CLEARANCE PHASE (Somalia Partner) ---
  [ImportStatus.ARRIVED_LOCAL]: [ImportStatus.READY_FOR_LOCAL_HANDOFF],
  [ImportStatus.READY_FOR_LOCAL_HANDOFF]: [ImportStatus.HANDED_OFF],

  // --- LOCAL DELIVERY PHASE (CourierX Core) ---
  [ImportStatus.HANDED_OFF]: [ImportStatus.DELIVERED],
  [ImportStatus.DELIVERED]: [],
  [ImportStatus.CANCELLED]: [],
  [ImportStatus.EXCEPTION]: [],

  // --- EXCEPTIONAL / HOLD STATES (terminal until manually resolved) ---
  [ImportStatus.WEIGHT_DISPUTE]: [],
  [ImportStatus.CUSTOMS_HOLD]: [],
  [ImportStatus.LOST]: [],
  [ImportStatus.RETURN_TO_SENDER]: [],
  [ImportStatus.EXPIRED]: [],
  [ImportStatus.PENDING_CUSTOMER_ACTION]: [],
};

/**
 * 3. MANIFEST FSM (Container/Consolidation Logic)
 * Ensures 100+ shipments move as a single physical unit.
 */
export enum ManifestStatus {
  DRAFT = 'DRAFT',
  CONSOLIDATED = 'CONSOLIDATED',
  DEPARTED = 'DEPARTED',
  ARRIVED = 'ARRIVED',
  DISMANTLED = 'DISMANTLED'
}

export const MANIFEST_FSM: Record<ManifestStatus, ManifestStatus[]> = {
  [ManifestStatus.DRAFT]: [ManifestStatus.CONSOLIDATED],
  [ManifestStatus.CONSOLIDATED]: [ManifestStatus.DEPARTED],
  [ManifestStatus.DEPARTED]: [ManifestStatus.ARRIVED],
  [ManifestStatus.ARRIVED]: [ManifestStatus.DISMANTLED],
  [ManifestStatus.DISMANTLED]: [],
};

/**
 * HARDENED VALIDATION ENGINE
 * This is the "Lead Architect" gatekeeper.
 */
export const validateImportTransition = (
  shipment: any, 
  nextStatus: ImportStatus,
  user: any
) => {
  const currentStatus = shipment.status as ImportStatus;

  // 1. EXCEPTION LOCK (Rule 4)
  // If flagged (isFlagged: true), all standard movement is physically blocked.
  if (shipment.isFlagged) {
    throw new Error('FSM_VIOLATION: Shipment is frozen due to active exception.');
  }

  // 2. AUTHORITY GUARD (Rule 1)
  // Only the current physical custodian can move the state.
  const isSuper = user.roles.includes('super_admin');
  const hasCustody = user.assignedLocations?.some(
    (locId: any) => locId.toString() === shipment.currentLocationId.toString()
  );

  if (!isSuper && !hasCustody) {
    throw new Error('AUTHORITY_VIOLATION: User does not have custody over this shipment.');
  }

  // 3. WEIGHT INTEGRITY GUARD (Rule 5)
  // Prevent arrival in Somalia if intake weight was never captured in China.
  if (nextStatus === ImportStatus.ARRIVED_LOCAL && !shipment.intake_weight) {
    throw new Error('DATA_INTEGRITY_FAILURE: Cannot arrive at Port. Missing intake weight.');
  }

  // 4. MULTI-MODAL CONSTRAINTS
  // Air shipments have a max weight; Sea shipments require CBM dimensions.
  if (shipment.transportMode === 'AIR' && (shipment.intake_weight || 0) > 30) {
    throw new Error('MODAL_VIOLATION: Package exceeds maximum Air Freight weight (30kg).');
  }

  // 5. LOGICAL PATHING
  const allowed = IMPORT_FSM[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new Error(`FSM_VIOLATION: Cannot move from ${currentStatus} to ${nextStatus}.`);
  }

  return true;
};