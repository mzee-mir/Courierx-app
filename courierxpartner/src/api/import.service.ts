import api from './axios';


/**
 * IMPORT_SERVICE (Partner Portal Context)
 * Hardening: Stateless Transitions, Physical Custody Gating, and Pricing Snapshots.
 */


export const importService = {
  // --- 1. DASHBOARD & BRIEFING ---
  /**
   * getBriefing: The "Airport Board" summary.
   * Returns: { org, actionRequired, blocked, stats, activity }
   */
  getBriefing: async () => {
    const { data } = await api.get('/partner/dashboard/briefing');
    return data.data;
  },


  // --- 2. INVENTORY MANAGEMENT ---
  /**
   * getInventory: Scoped list of floor items at assigned locations.
   */
  getInventory: async (params: {
    search?: string;
    status?: string;
    transportMode?: string;
    page?: number
  }) => {
    const { data } = await api.get('/partner/my-inventory', { params });
    return data; // Returns { success, data: [], pagination: {} }
  },


  // --- 3. MICRO-OPS: INDIVIDUAL SHIPMENTS ---
  /**
   * getShipmentAuthority: Determines the single valid action for a box.
   */
  getShipmentAuthority: async (id: string) => {
    const { data } = await api.get(`/partner/shipments/${id}/authority`);
    return data.data; // Returns { shipment, allowed: [ActionCode], activity: [] }
  },


  /**
   * scanIntake: Processes a physical arrival at the China Hub.
   * Triggers: Pricing Snapshot & Weight Lock.
   */
  scanIntake: async (payload: {
    trackingNumber: string;
    weight: number;
    binLocation: string;
    mode: 'AIR' | 'SEA';
    locationId: string;
    isFragile?: boolean;
    dimensions?: { l: number; w: number; h: number };
  }) => {
    const { data } = await api.post('/partner/intake', payload);
    return data;
  },


  /**
   * quickIntake: Registers a "Surprise" package found on the floor.
   */
  quickIntake: async (payload: {
    phoneNumber: string;
    trackingNumber: string;
    weight: number;
    itemDescription: string;
    mode: 'AIR' | 'SEA';
    locationId: string;
  }) => {
    const { data } = await api.post('/partner/quick-intake', payload);
    return data;
  },


  /**
   * transitionStatus: Moves an individual box to the next FSM state.
   * Requirement: Must use the 'actionCode' provided by getShipmentAuthority.
   */
  transitionStatus: async (id: string, payload: {
    actionCode: string;
    weight?: number;
    photos?: string[];
    notes?: string;
  }) => {
    const { data } = await api.patch(`/partner/shipments/${id}/transition`, payload);
    return data;
  },


  // --- 4. MACRO-OPS: MANIFESTS (BATCHING) ---
  /**
   * initializeDraft: Creates an ephemeral manifest container.
   */
  initializeDraft: async (payload: {
    shippingMode: 'AIR' | 'SEA';
    destinationHub: string;
    originHub: string
  }) => {
    const { data } = await api.post('/partner/manifest/draft', payload);
    return data.draftId;
  },


  /**
   * updateDraft: Syncs the staged items list to the cloud.
   */
  updateDraft: async (id: string, shipmentIds: string[]) => {
    const { data } = await api.patch(`/partner/manifest/draft/${id}`, { shipmentIds });
    return data;
  },


  consolidateManifest: async (payload: any) => {
    const { data } = await api.post('/partner/manifest/consolidate', payload);
    return data;
  },


  /**
   * sealManifest: Finalizes a batch and moves all items to CONSOLIDATED.
   */
  sealManifest: async (id: string) => {
    const { data } = await api.post(`/partner/manifest/${id}/seal`);
    return data;
  },


  getManifests: async () => {
    const { data } = await api.get('/partner/manifests');
    return data.manifests; // Returns array of manifests for this partner
  },


  /**
   * getManifestAuthority: Rules for batch movement (e.g., DEPARTED).
   */
  getManifestAuthority: async (_id: string) => {
    const { data } = await api.get(`/partner/manifests/${_id}/authority`);
    return data.data;
  },


  /**
   * transitionManifest: Moves the entire container (propagates to all items).
   */
  transitionManifest: async (id: string, actionCode: string) => {
    const { data } = await api.patch(`/partner/manifests/${id}/transition`, { actionCode });
    return data;
  },


  // --- 5. DESTINATION HUB: UNSEALING ---
  /**
   * verifyUnsealItem: Destination weigh-in and integrity check.
   */
  verifyUnsealItem: async (manifestId: string, payload: {
    trackingNumber: string;
    arrivalWeight: number;
    notes?: string;
    photos?: string[];
  }) => {
    const { data } = await api.post(`/partner/manifests/${manifestId}/verify-item`, payload);
    return data;
  },


  // src/api/import.service.ts
  trackShipment: async (trackingNumber: string) => {
    const { data } = await api.get(`/partner/shipments/track/${trackingNumber}`);
    return data.data; // Returns basic info and the internal 'id' for navigation
  },


  /**
   * finalizeUnsealing: Dismantles manifest and logs closing audit.
   */
  finalizeUnsealing: async (manifestId: string, description: string) => {
    const { data } = await api.post(`/partner/manifests/${manifestId}/finalize`, {
      closingDescription: description
    });
    return data;
  },


  // --- 6. TERMINAL ECONOMICS ---
  /**
   * getActiveRates: Fetches current contract and system price ceiling.
   */
  getActiveRates: async () => {
    const { data } = await api.get('/partner/settings/active-rates');
    return data.data;
  },


  getManifestsDirectory: async () => {
    const { data } = await api.get('/partner/manifests/directory');
    return data.manifests; // Returns array of all active manifests across the partner org
  },


  /**
   * updateRates: Proposes/Sets new $/KG rates.
   */
  updateRates: async (payload: {
    airRate: number;
    seaRate: number;
    dailyIntakeTarget: number; // 👈 Added
    reason: string
  }) => {
    const { data } = await api.patch('/partner/settings/rates', payload);
    return data;
  },


  /**
   * getLocations: Fetches all physical nodes belonging to the partner organization.
   * Required for: Staff assignment and Terminal oversight.
   */
  getLocations: async () => {
    const { data } = await api.get('/partner/my-locations');
    return data.locations; // Should return array of { id, name, type }
  },


  getPublicProfile: async () => {
    const { data } = await api.get('/partner/profile/public');
    return data.data;
  },


  updatePublicProfile: async (profileData: any) => {
    const { data } = await api.patch('/partner/profile/public', profileData);
    return data.data;
  },


  getHandoffQueue: async () => {
    const { data } = await api.get('/partner/handoff/queue');
    return data.data;
  },


  executeHandoff: async (id: string) => {
    const { data } = await api.post(`/partner/shipments/${id}/handoff`);
    return data;
  },
  getBlockedInventory: async () => {
    const { data } = await api.get('/partner/inventory/blocked');
    return data.data;
  },
  resolveException: async (id: string, payload: { resolutionAction: string, notes: string }) => {
    const { data } = await api.post(`/partner/shipments/${id}/resolve-exception`, payload);
    return data;
  }
};
