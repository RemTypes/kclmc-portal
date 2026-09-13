'use client';
import { useState } from 'react';

export default function ReconcilePage() {
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  const processCSV = async (text: string) => {
    // A robust CSV parser that handles quotes and escaped commas
    const parseCSV = (csv: string) => {
      let result = [];
      let row = [];
      let currentWord = '';
      let inQuotes = false;
      
      for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (inQuotes) {
          if (char === '"' && nextChar === '"') {
            currentWord += '"';
            i++; 
          } else if (char === '"') {
            inQuotes = false;
          } else {
            currentWord += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            row.push(currentWord.trim());
            currentWord = '';
          } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
            row.push(currentWord.trim());
            result.push(row);
            row = [];
            currentWord = '';
            if (char === '\r') i++;
          } else {
            currentWord += char;
          }
        }
      }
      
      if (currentWord !== '' || row.length > 0) {
        row.push(currentWord.trim());
        result.push(row);
      }
      
      return result;
    };

    const lines = parseCSV(text.trim());
    if (lines.length < 2) return;
    const headers = lines[0];
    const data = lines.slice(1).map((values) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i];
      });
      return obj;
    });

    const res = await fetch('/api/reconcile', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
    const parsedRes = await res.json();
    if (parsedRes.results) setResults(parsedRes.results);
  };

  const handleDrop = async (e: any) => {
    e.preventDefault(); 
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const text = await e.dataTransfer.files[0].text();
      processCSV(text);
    }
  };

  const loadSample = () => {
    const sampleCSV = `Date,Order ID,Name,Email,Amount,Note\n2026-09-13,KCL-1234,Alice,alice@example.com,20,\n2026-09-13,LUB-5678,Bob,bob@example.com,20,Deposit\n2026-09-13,UNK-9999,Charlie,c@example.com,15,Missing Order`;
    processCSV(sampleCSV);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reconcile Payments</h1>
          <button onClick={loadSample} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold hover:bg-gray-300">Load Sample Data</button>
        </div>
        
        <div 
          className={`border-2 border-dashed rounded-xl p-12 text-center mb-8 transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-bold mb-2">Drop KCLSU CSV Report Here</h3>
          <p className="text-gray-500 mb-4">The 3-tier matching engine will automatically pair payments to pending orders.</p>
          <p className="text-xs text-gray-400">Required columns: Order ID, Amount</p>
        </div>
        
        {results && (
          <div className="grid gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
              <h2 className="text-lg font-bold mb-4 text-green-700">Matched ({results.matched.length})</h2>
              <ul className="space-y-2">
                {results.matched.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between p-3 bg-green-50 text-green-800 rounded">
                    <span className="font-mono font-bold">{m.orderCode}</span>
                    <span>£{m.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-6">
              <h2 className="text-lg font-bold mb-4 text-yellow-700">Partial Payments ({results.partial.length})</h2>
              <ul className="space-y-2">
                {results.partial.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between p-3 bg-yellow-50 text-yellow-800 rounded">
                    <span className="font-mono font-bold">{m.orderCode}</span>
                    <span>Paid: £{m.amount} / Expected: £{m.expected}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <h2 className="text-lg font-bold mb-4 text-red-700">Orphan Payments ({results.orphan.length})</h2>
              <ul className="space-y-2">
                {results.orphan.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between p-3 bg-red-50 text-red-800 rounded">
                    <span className="font-mono font-bold">{m.orderCode}</span>
                    <span className="flex gap-4">
                      <span>£{m.amount}</span>
                      {m.note && <span className="text-red-500 italic text-sm">{m.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
