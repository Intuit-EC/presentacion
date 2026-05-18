import { useEffect, useState } from 'react';

interface ReportData {
  period: { startDate: string; endDate: string };
  stats: any;
  orders: any[];
  topProducts: any[];
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('this_month');
  const [error, setError] = useState('');

  const fetchReport = async (selectedRange: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/reports/data?range=${selectedRange}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Error al cargar reporte');
      
      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const response = await fetch(`/api/reports/excel?range=${range}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el Excel');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar Excel');
    }
  };

  useEffect(() => {
    fetchReport(range);
  }, []);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reportes de Ventas</h1>
        <p className="text-gray-400 mt-2">Genera reportes y descarga en PDF</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Período</label>
          <select
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              fetchReport(e.target.value);
            }}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
          >
            <option value="today">Hoy</option>
            <option value="this_week">Esta semana</option>
            <option value="this_month">Este mes</option>
            <option value="this_year">Este año</option>
          </select>
        </div>

        <button
          onClick={downloadExcel}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded transition"
        >
          {loading ? 'Cargando...' : '📥 Descargar Excel'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-400">Cargando reporte...</p>
        </div>
      )}

      {/* Datos */}
      {reportData && !loading && (
        <div className="space-y-6">
          {/* Período */}
          <div className="bg-slate-800 p-4 rounded border border-slate-700">
            <p className="text-sm">
              📅 {reportData.period.startDate} - {reportData.period.endDate}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded border border-slate-700">
              <p className="text-gray-400 text-sm">Total Órdenes</p>
              <p className="text-2xl font-bold text-blue-400 mt-2">
                {reportData.stats.totalOrders}
              </p>
            </div>

            <div className="bg-slate-800 p-4 rounded border border-slate-700">
              <p className="text-gray-400 text-sm">Ingresos Totales</p>
              <p className="text-2xl font-bold text-green-400 mt-2">
                ${reportData.stats.totalRevenue.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-800 p-4 rounded border border-slate-700">
              <p className="text-gray-400 text-sm">Órdenes Pagadas</p>
              <p className="text-2xl font-bold text-emerald-400 mt-2">
                {reportData.stats.paidOrders}
              </p>
            </div>

            <div className="bg-slate-800 p-4 rounded border border-slate-700">
              <p className="text-gray-400 text-sm">Órdenes Entregadas</p>
              <p className="text-2xl font-bold text-purple-400 mt-2">
                {reportData.stats.deliveredOrders}
              </p>
            </div>
          </div>

          {/* Top Productos */}
          {reportData.topProducts.length > 0 && (
            <div className="bg-slate-800 p-6 rounded border border-slate-700">
              <h2 className="text-lg font-bold mb-4">🏆 Top Productos</h2>
              <div className="space-y-2">
                {reportData.topProducts.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{i + 1}. {p.name}</span>
                    <span className="text-gray-400">{p.quantity} ud - ${p.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla Órdenes */}
          {reportData.orders.length > 0 && (
            <div className="bg-slate-800 p-6 rounded border border-slate-700 overflow-x-auto">
              <h2 className="text-lg font-bold mb-4">📋 Órdenes ({reportData.orders.length})</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-700">
                  <tr>
                    <th className="text-left py-3 px-2 font-bold">Orden</th>
                    <th className="text-left py-3 px-2 font-bold">Cliente</th>
                    <th className="text-left py-3 px-2 font-bold">Email</th>
                    <th className="text-right py-3 px-2 font-bold">Subtotal</th>
                    <th className="text-right py-3 px-2 font-bold">Envío</th>
                    <th className="text-right py-3 px-2 font-bold">Total</th>
                    <th className="text-left py-3 px-2 font-bold">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.orders.map((order, index) => (
                    <tr key={order.orderNumber} className={`border-b border-slate-700 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-900/30'} hover:bg-slate-700/30 transition`}>
                      <td className="py-3 px-2 text-blue-400">{order.orderNumber}</td>
                      <td className="py-3 px-2">{order.customerName}</td>
                      <td className="py-3 px-2 text-gray-400 text-xs">{order.customerEmail}</td>
                      <td className="py-3 px-2 text-gray-400 text-right">${order.subtotal.toFixed(2)}</td>
                      <td className="py-3 px-2 text-gray-400 text-right">${order.shipping.toFixed(2)}</td>
                      <td className="py-3 px-2 font-medium text-right">${order.total.toFixed(2)}</td>
                      <td className="py-3 px-2 text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.orders.length > 20 && (
                <p className="text-sm text-gray-400 mt-4">
                  Mostrando 20 de {reportData.orders.length} órdenes. El Excel contiene todas.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
