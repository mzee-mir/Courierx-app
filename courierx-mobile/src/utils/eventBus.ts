type Listener = () => void;

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
  this.listeners.add(listener);
  return () => {
    this.listeners.delete(listener);
  };
}

  emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const unauthorizedEventBus = new EventBus();
