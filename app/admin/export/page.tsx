'use client';
import { useEffect, useState } from 'react';

export default function ExportPage() {
  const [matrix, setMatrix] = useState<any[]>([]);
  
  useEffect(() => {
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        // Build matrix: Garment x Size
        const breakdown: Record<string, Record<string, number>> = {};
        
        data.forEach((order: any) => {
          order.items?.forEach((item: any) => {
            if (!breakdown[item.name]) {
              breakdown[item.name] = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, Total: 0 };
            }
            if (breakdown[item.name][item.size] !== undefined) {
              breakdown[item.name][item.size]++;
              breakdown[item.name].Total++;
            }
          });
        });
        
        const rows = Object.keys(breakdown).map(garment => ({
          name: garment,
          ...breakdown[garment]
        }));
        setMatrix(rows);
      });
  }, []);

  const downloadCSV = () => {
    if (matrix.length === 0) return;
    const header = ['Garment', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Total'];
    const rows = matrix.map(row => [
      row.name, row.XS, row.S, row.M, row.L, row.XL, row.XXL, row.Total
    ]);
    
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "printer_spec.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manufacturing Export</h1>
          <button onClick={downloadCSV} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition-colors">Download Printer Spec CSV</button>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-bold text-gray-700">Garment</th>
                <th className="p-4 font-bold text-gray-700">XS</th>
                <th className="p-4 font-bold text-gray-700">S</th>
                <th className="p-4 font-bold text-gray-700">M</th>
                <th className="p-4 font-bold text-gray-700">L</th>
                <th className="p-4 font-bold text-gray-700">XL</th>
                <th className="p-4 font-bold text-gray-700">XXL</th>
                <th className="p-4 font-bold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">No data found</td>
                </tr>
              ) : (
                matrix.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="p-4 font-medium">{row.name}</td>
                    <td className="p-4">{row.XS}</td>
                    <td className="p-4">{row.S}</td>
                    <td className="p-4">{row.M}</td>
                    <td className="p-4">{row.L}</td>
                    <td className="p-4">{row.XL}</td>
                    <td className="p-4">{row.XXL}</td>
                    <td className="p-4 font-bold">{row.Total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
