import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Scatter
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, parseISO, startOfYear, eachMonthOfInterval } from 'date-fns';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReportStats {
  totalInvoices: number;
  totalAmount: number;
  totalCredits: number;
  averageInvoiceValue: number;
  topClients: Array<{
    client_name: string;
    total_invoices: number;
    total_amount: number;
  }>;
  monthlyData: Array<{
    date: string;
    invoices: number;
    amount: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
}

interface PaymentAnalytics {
  averagePaymentTime: number;
  overdueInvoices: number;
  totalOverdueAmount: number;
  paymentMethods: { [key: string]: number };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const STATUS_COLORS = {
  'paid': '#00C49F',
  'pending': '#FFBB28',
  'overdue': '#FF8042',
  'draft': '#8884d8'
};

export default function Reports() {
  const [timeFrame, setTimeFrame] = useState<'7days' | '30days' | 'month' | 'year'>('30days');
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentAnalytics, setPaymentAnalytics] = useState<PaymentAnalytics | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchInvoiceStats();
  }, [timeFrame]);

  const fetchInvoiceStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        setError('User not authenticated');
        return;
      }

      let startDate;
      const endDate = new Date();

      switch (timeFrame) {
        case '7days':
          startDate = subDays(new Date(), 7);
          break;
        case '30days':
          startDate = subDays(new Date(), 30);
          break;
        case 'month':
          startDate = startOfMonth(new Date());
          break;
        case 'year':
          startDate = new Date(new Date().getFullYear(), 0, 1);
          break;
      }

      // Fetch invoices data - matching your Invoices.tsx structure
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, company_name)
        `)
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (invoiceError) throw invoiceError;

      if (!invoiceData || invoiceData.length === 0) {
        setStats({
          totalInvoices: 0,
          totalAmount: 0,
          totalCredits: 0,
          averageInvoiceValue: 0,
          topClients: [],
          monthlyData: [],
          statusDistribution: []
        });
        return;
      }

      // Process daily data
      const dailyData: { [key: string]: { invoices: number; amount: number } } = {};
      const clientStats: { [key: string]: { invoices: number; amount: number; name: string } } = {};
      const statusStats: { [key: string]: number } = {};

      invoiceData.forEach(invoice => {
        // Process daily stats
        const date = format(parseISO(invoice.created_at), 'yyyy-MM-dd');
        if (!dailyData[date]) {
          dailyData[date] = { invoices: 0, amount: 0 };
        }
        dailyData[date].invoices += 1;
        dailyData[date].amount += invoice.total || 0; // Changed from total_amount to total

        // Process client stats
        const clientName = invoice.client?.company_name || invoice.client?.name || 'Unknown Client';
        if (!clientStats[invoice.client_id]) {
          clientStats[invoice.client_id] = { invoices: 0, amount: 0, name: clientName };
        }
        clientStats[invoice.client_id].invoices += 1;
        clientStats[invoice.client_id].amount += invoice.total || 0; // Changed from total_amount to total

        // Process status stats with a default value
        const status = invoice.status || 'draft';
        statusStats[status] = (statusStats[status] || 0) + 1;
      });

      // Calculate metrics
      const totalAmount = invoiceData.reduce((sum, invoice) => sum + (invoice.total || 0), 0); // Changed from total_amount to total
      const averageInvoiceValue = totalAmount / invoiceData.length;

      setStats({
        totalInvoices: invoiceData.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalCredits: invoiceData.reduce((sum, invoice) => sum + (invoice.credits_used || 0), 0),
        averageInvoiceValue: Number(averageInvoiceValue.toFixed(2)),
        topClients: Object.values(clientStats)
          .map(client => ({
            client_name: client.name,
            total_invoices: client.invoices,
            total_amount: Number(client.amount.toFixed(2)),
          }))
          .sort((a, b) => b.total_amount - a.total_amount)
          .slice(0, 5),
        monthlyData: Object.entries(dailyData)
          .map(([date, data]) => ({
            date,
            invoices: data.invoices,
            amount: Number(data.amount.toFixed(2)),
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        statusDistribution: Object.entries(statusStats)
          .map(([status, count]) => ({
            status,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      });

    } catch (err) {
      console.error('Error fetching invoice stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
      toast.error('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setExportLoading(true);
      
      const workbook = XLSX.utils.book_new();
      
      // Summary Sheet
      const summaryData = [
        ['Summary Statistics'],
        ['Total Invoices', stats?.totalInvoices],
        ['Total Revenue', `$${stats?.totalAmount}`],
        ['Average Invoice Value', `$${stats?.averageInvoiceValue}`],
        ['Total Credits Used', stats?.totalCredits],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Monthly Data Sheet
      const monthlyData = stats?.monthlyData.map(item => ({
        Date: item.date,
        Invoices: item.invoices,
        Revenue: `$${item.amount}`
      }));
      if (monthlyData) {
        const monthlySheet = XLSX.utils.json_to_sheet(monthlyData);
        XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Data');
      }

      // Top Clients Sheet
      const clientData = stats?.topClients.map(client => ({
        Client: client.client_name,
        Invoices: client.total_invoices,
        Revenue: `$${client.total_amount}`
      }));
      if (clientData) {
        const clientSheet = XLSX.utils.json_to_sheet(clientData);
        XLSX.utils.book_append_sheet(workbook, clientSheet, 'Top Clients');
      }

      // Generate & Download
      XLSX.writeFile(workbook, `Invoice_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (error) {
      toast.error('Failed to export data');
      console.error('Export error:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const calculatePaymentAnalytics = (invoices: any[]) => {
    const now = new Date();
    let totalPaymentDays = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    const paymentMethods: { [key: string]: number } = {};

    invoices.forEach(invoice => {
      // Payment time calculation
      if (invoice.paid_at) {
        const paymentTime = (new Date(invoice.paid_at).getTime() - new Date(invoice.created_at).getTime()) / (1000 * 3600 * 24);
        totalPaymentDays += paymentTime;
      }

      // Overdue calculation
      if (invoice.due_date && new Date(invoice.due_date) < now && invoice.status !== 'paid') {
        overdueCount++;
        overdueAmount += invoice.total || 0;
      }

      // Payment method tracking
      if (invoice.payment_method) {
        paymentMethods[invoice.payment_method] = (paymentMethods[invoice.payment_method] || 0) + 1;
      }
    });

    return {
      averagePaymentTime: invoices.length ? totalPaymentDays / invoices.length : 0,
      overdueInvoices: overdueCount,
      totalOverdueAmount: overdueAmount,
      paymentMethods
    };
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded relative">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Financial Analytics Dashboard</h1>
        <div className="flex gap-4 mb-6">
          <select
            className="border rounded p-2"
            value={timeFrame}
            onChange={(e) => setTimeFrame(e.target.value as typeof timeFrame)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={exportToExcel}
          disabled={exportLoading || !stats}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {exportLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Total Invoices</h3>
          <p className="text-3xl font-bold">{stats.totalInvoices}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold">${stats.totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Average Invoice Value</h3>
          <p className="text-3xl font-bold">${stats.averageInvoiceValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Credits Used</h3>
          <p className="text-3xl font-bold">{stats.totalCredits}</p>
        </div>
      </div>

      {/* New Payment Analytics Cards */}
      {paymentAnalytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Average Payment Time</h3>
            <p className="text-3xl font-bold">{paymentAnalytics.averagePaymentTime.toFixed(1)} days</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Overdue Invoices</h3>
            <p className="text-3xl font-bold text-red-600">{paymentAnalytics.overdueInvoices}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Overdue Amount</h3>
            <p className="text-3xl font-bold text-red-600">${paymentAnalytics.totalOverdueAmount.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {stats.monthlyData.length > 0 ? (
          <>
            {/* Revenue Trend */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3}
                    name="Revenue ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Invoice Volume */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Invoice Volume</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="invoices" 
                    stroke="#82ca9d" 
                    name="Number of Invoices"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="col-span-2 bg-gray-50 p-6 rounded-lg text-center text-gray-500">
            No time-series data available for the selected period
          </div>
        )}

        {stats.topClients.length > 0 ? (
          <>
            {/* Top Clients by Revenue */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Top Clients by Revenue</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.topClients}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="client_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="total_amount" 
                    fill="#8884d8" 
                    name="Revenue ($)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Invoice Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Invoice Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.statusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {stats.statusDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="col-span-2 bg-gray-50 p-6 rounded-lg text-center text-gray-500">
            No client data available for the selected period
          </div>
        )}
      </div>
    </div>
  );
} 