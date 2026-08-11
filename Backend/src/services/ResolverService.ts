import { User } from '../models/User';
import { Landmark } from '../models/Landmark';

export class ResolverService {
  /**
   * Generates a unique CX-Code for new customers.
   * Format: CX-XXXX (e.g., CX-4921)
   */
  public static async generateUserCode(): Promise<string> {
    let isUnique = false;
    let code = '';
    while (!isUnique) {
      code = `CX-${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = await User.findOne({ cxCode: code });
      if (!existing) isUnique = true;
    }
    return code;
  }

  /**
   * Snaps a read-only snapshot of customer data.
   * Ensures the Partner never sees live customer data after this point.
   */
  public static async resolveAddress(cxCode: string) {
    const user = await User.findOne({ cxCode: cxCode.toUpperCase() });
    if (!user) throw new Error('INVALID_CX_CODE');

    const defaultLandmark = await Landmark.findOne({ userId: user._id, isDefault: true });

    return {
      userId: user._id,
      snapshot: {
        name: user.displayName,
        phone: user.phoneNumber,
        deliveryLandmark: defaultLandmark?.label || 'No default landmark set',
        deliveryCoords: defaultLandmark?.location?.coordinates || [0,0]
      },
      resolvedAt: new Date(),
      version: 1
    };
  }
}