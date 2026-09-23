export interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  items: any[];
  status: 'PENDING' | 'PAID' | 'COLLECTED';
  total: number;
}

export interface TelemetryEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

class Store {
  orders: Order[] = [
    { id: '1', orderCode: 'KCL-1234', customerName: 'Alice', items: [{ name: 'KCLMC Tee', size: 'M' }], status: 'PAID', total: 20 },
    { id: '2', orderCode: 'LUB-5678', customerName: 'Bob', items: [{ name: 'LUBE Hoodie', size: 'L' }], status: 'PENDING', total: 40 },
  ];
  telemetry: TelemetryEvent[] = [];

  addOrder(order: Order) {
    this.orders.push(order);
  }

  getOrders() {
    return this.orders;
  }
  
  getOrder(code: string) {
    return this.orders.find(o => o.orderCode === code);
  }
  
  updateOrderStatus(code: string, status: Order['status']) {
    const order = this.getOrder(code);
    if (order) order.status = status;
  }

  logEvent(event: TelemetryEvent) {
    this.telemetry.push(event);
  }
  
  getTelemetry() {
    return this.telemetry;
  }
}

export const store = new Store();
