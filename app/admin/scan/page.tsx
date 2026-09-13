'use client';
import { useState } from 'react';

export default function ScanPage() {
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const lookup = async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders?code=${code}`);
      const data = await res.json();
      if (res.ok && data) {
        setOrder(data);
      } else {
        setOrder(null);
        setError('Order not found');
      }
    } catch (err) {
      setError('Error fetching order');
    }
    setLoading(false);
  };

  const markCollected = async () => {
    if (!order) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ code: order.orderCode, status: 'COLLECTED' }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setOrder({ ...order, status: 'COLLECTED' });
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-8">Pass Scanner</h1>
      
      {!order ? (
        <div className="w-full max-w-md aspect-square bg-black border-4 border-gray-700 rounded-2xl mb-8 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 border-2 border-green-500 m-8 rounded-lg opacity-50"></div>
          <div className="absolute w-full h-1 bg-green-500 shadow-[0_0_15px_#22c55e] animate-[scan_2s_ease-in-out_infinite]"></div>
          <span className="text-gray-500 z-10 bg-black/50 px-4 py-2 rounded">Camera Feed Active</span>
        </div>
      ) : (
        <div className="w-full max-w-md bg-gray-800 rounded-2xl mb-8 overflow-hidden border border-gray-700">
          <div className={`p-4 text-center font-bold text-xl ${
            order.status === 'COLLECTED' ? 'bg-blue-600' :
            order.status === 'PAID' ? 'bg-green-600' : 'bg-yellow-600'
          }`}>
            {order.status}
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-mono mb-1">{order.orderCode}</h2>
            <p className="text-gray-400 mb-6">{order.customerName}</p>
            
            <h3 className="font-bold mb-2 text-sm text-gray-400 uppercase tracking-wider">Items</h3>
            <ul className="mb-6 space-y-2">
              {order.items?.map((item: any, i: number) => (
                <li key={i} className="flex justify-between bg-gray-900 p-3 rounded border border-gray-700">
                  <span>{item.name}</span>
                  <span className="font-bold text-blue-400">{item.size}</span>
                </li>
              ))}
            </ul>
            
            {order.status === 'PAID' && (
              <button onClick={markCollected} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-colors">
                Mark as Collected
              </button>
            )}
            
            <button onClick={() => setOrder(null)} className="w-full mt-3 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition-colors">
              Scan Another
            </button>
          </div>
        </div>
      )}
      
      {!order && (
        <div className="w-full max-w-md">
          <p className="text-center text-gray-400 mb-2">Or enter code manually:</p>
          <div className="flex">
            <input 
              type="text" 
              value={code} 
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-l px-4 py-3 text-xl font-mono focus:outline-none focus:border-blue-500 uppercase"
              placeholder="KCL-1234"
            />
            <button onClick={lookup} disabled={loading} className="bg-blue-600 px-6 py-3 rounded-r font-bold hover:bg-blue-500 transition-colors disabled:opacity-50">
              {loading ? '...' : 'Lookup'}
            </button>
          </div>
          {error && <p className="text-red-400 text-center mt-4">{error}</p>}
        </div>
      )}
    </div>
  );
}
