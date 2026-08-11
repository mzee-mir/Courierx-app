interface TimelineEvent {
  status: string;
  location: string;
  timestamp: Date;
  notes?: string;
  isLocalPhase: boolean; // True if the event belongs to the Bajaj/CourierX leg
}