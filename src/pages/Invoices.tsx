import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, Loader2, Eye, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';
import { generateInvoicePDF } from '../services/generateInvoicePDF.tsx';
import type { Settings } from '../types/settings';
import { toast } from 'react-hot-toast';

interface Client {
  id: string;
  name: string;
  company_name: string;
}

interface InvoiceItem {
  id?: string;
  invoice_id: string;
  name: string;
  description: string;
  price: number;
  user_id: string;
}

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  created_at: string;
  total: number;
  user_id: string;
  client: Client;
  items: InvoiceItem[];
}

interface FilterState {
  client: string;
  dateRange: {
    from: string;
    to: string;
  };
  minAmount: string;
  maxAmount: string;
  sortBy: 'date' | 'amount' | 'client' | 'number' | 'none';
  sortOrder: 'asc' | 'desc';
}

function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [items, setItems] = useState<Array<{ name: string; description: string; price: string }>>([
    { name: '', description: '', price: '' }
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    client: '',
    dateRange: {
      from: '',
      to: ''
    },
    minAmount: '',
    maxAmount: '',
    sortBy: 'none',
    sortOrder: 'desc'
  });
  const [submitStatus, setSubmitStatus] = useState<{
    loading: boolean;
    message: string;
    type: 'success' | 'error' | null;
  }>({ loading: false, message: '', type: null });
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      if (!user || initialLoadRef.current) return;

      try {
        setIsLoading(true);
        await Promise.all([
          fetchInvoices(),
          fetchClients(),
          fetchSettings()
        ]);
        initialLoadRef.current = true;
      } catch (error) {
        console.error('Error in initial data fetch:', error);
        if (mounted) {
          toast.error('Failed to load initial data');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeData();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('invoice-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'invoices',
          filter: `user_id=eq.${user.id}`
        }, 
        () => {
          fetchInvoices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function fetchInvoices() {
    try {
      if (!initialLoadRef.current) {
        setIsRefreshing(true);
      }

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, company_name)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      if (!invoicesData) {
        setInvoices([]);
        return;
      }

      const invoicesWithItems = await Promise.all(
        invoicesData.map(async (invoice) => {
          const { data: itemsData } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoice.id);

          return { ...invoice, items: itemsData || [] };
        })
      );

      setInvoices(invoicesWithItems);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to fetch invoices. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company_name')
        .eq('user_id', user?.id);

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to fetch clients. Please try again.');
    }
  }

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch business settings. Please try again.');
    }
  }

  const generateInvoiceNumber = (settings: Settings | null) => {
    if (!settings) return `${Date.now()}`;
    
    const nextNumber = (settings.invoice_number || 0) + 1;
    const prefix = settings.invoice_prefix;
    
    return prefix ? `${prefix}${nextNumber}` : `${nextNumber}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      if (!selectedClient || !user?.id || !settings) {
        throw new Error('Please select a client and ensure settings are loaded');
      }

      if (items.length === 0 || items.some(item => !item.name || !item.price)) {
        throw new Error('Please add at least one item with name and price');
      }

      const nextNumber = (settings.invoice_number || 0) + 1;
      const invoiceNumber = generateInvoiceNumber(settings);

      // First create the invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          client_id: selectedClient,
          invoice_number: invoiceNumber,
          total: items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0),
          user_id: user.id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoiceData) throw new Error('No invoice data returned');

      // Update the invoice number in settings
      const { error: settingsError } = await supabase
        .from('business_settings')
        .update({ invoice_number: nextNumber })
        .eq('user_id', user.id);

      if (settingsError) {
        console.error('Error updating invoice number:', settingsError);
        toast.error('Warning: Invoice number may not have updated correctly');
      }

      // Then create all items
      const itemsToCreate = items.map(item => ({
        invoice_id: invoiceData.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        user_id: user.id
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToCreate);

      if (itemsError) {
        // If items creation fails, delete the invoice
        await supabase
          .from('invoices')
          .delete()
          .eq('id', invoiceData.id);
        throw itemsError;
      }

      toast.success('Invoice created successfully!');
      setIsModalOpen(false);
      resetForm();
      await Promise.all([
        fetchInvoices(),
        fetchSettings()
      ]);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;

    try {
      // First delete all invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id);

      if (itemsError) throw itemsError;

      // Then delete the invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Invoice deleted successfully');
      await fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice. Please try again.');
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setItems([{ name: '', description: '', price: '' }]);
    setSubmitStatus({ loading: false, message: '', type: null });
  };

  const resetFilters = () => {
    setFilters({
      client: '',
      dateRange: {
        from: '',
        to: ''
      },
      minAmount: '',
      maxAmount: '',
      sortBy: 'none',
      sortOrder: 'desc'
    });
  };

  const filteredInvoices = invoices
    .filter(invoice => {
      const matchesSearch = 
        invoice.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.client?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClient = !filters.client || 
        invoice.client_id === filters.client;

      const invoiceDate = new Date(invoice.created_at);
      const matchesDateRange = 
        (!filters.dateRange.from || invoiceDate >= new Date(filters.dateRange.from)) &&
        (!filters.dateRange.to || invoiceDate <= new Date(filters.dateRange.to));

      const matchesAmount = 
        (!filters.minAmount || invoice.total >= parseFloat(filters.minAmount)) &&
        (!filters.maxAmount || invoice.total <= parseFloat(filters.maxAmount));

      return matchesSearch && matchesClient && matchesDateRange && matchesAmount;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'none') return 0;
      
      let comparison = 0;
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'amount':
          comparison = a.total - b.total;
          break;
        case 'client':
          comparison = (a.client?.name || '').localeCompare(b.client?.name || '');
          break;
        case 'number':
          comparison = a.invoice_number.localeCompare(b.invoice_number);
          break;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      if (!settings) {
        throw new Error('Settings not loaded');
      }

      const pdfBlob = await generateInvoicePDF(invoice, settings);
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      const invoiceNumber = invoice.invoice_number.replace(/^.*?(\d+)$/, '$1');
      const clientName = invoice.client?.name || 'Unknown Client';
      const fileName = `Invoice #${invoiceNumber} - ${clientName}.pdf`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoice PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([
        fetchInvoices(),
        fetchClients(),
        fetchSettings()
      ]);
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
        <div className="flex items-center gap-4">
          {isRefreshing && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Invoice
          </button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search invoices..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {Object.values(filters).some(value => 
              value !== '' && value !== 'none' && 
              !(typeof value === 'object' && Object.values(value).every(v => v === ''))
            ) && (
              <span className="w-2 h-2 rounded-full bg-blue-600" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Client
                </label>
                <select
                  value={filters.client}
                  onChange={(e) => setFilters({ ...filters, client: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.from}
                    onChange={(e) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, from: e.target.value }
                    })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.to}
                    onChange={(e) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, to: e.target.value }
                    })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Amount Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Sort By
                </label>
                <div className="flex gap-2">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({
                      ...filters,
                      sortBy: e.target.value as FilterState['sortBy']
                    })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="none">No Sorting</option>
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="client">Client Name</option>
                    <option value="number">Invoice Number</option>
                  </select>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => setFilters({
                      ...filters,
                      sortOrder: e.target.value as 'asc' | 'desc'
                    })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center min-h-[200px]">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-gray-600">Loading invoices...</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 whitespace-nowrap">
                    <div className="text-center py-12">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                      <p className="text-gray-500 mb-6">Get started by creating your first invoice</p>
                      <button
                        onClick={() => {
                          setEditingInvoice(null);
                          setIsModalOpen(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center mx-auto"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.client?.name}
                      {invoice.client?.company_name && (
                        <span className="text-gray-500 text-sm block">
                          {invoice.client.company_name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ${invoice.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            setViewingInvoice(invoice);
                            setIsViewModalOpen(true);
                          }}
                          className="text-gray-600 hover:text-gray-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>

            <h2 className="text-xl font-bold mb-6">
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <select
                  required
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={isSubmitting}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Items */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Items *
                </label>
                {items.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].name = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].description = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].price = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = items.filter((_, i) => i !== index);
                          setItems(newItems);
                        }}
                        className="text-red-600 hover:text-red-800"
                        disabled={isSubmitting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setItems([...items, { name: '', description: '', price: '' }])}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  disabled={isSubmitting}
                >
                  + Add Item
                </button>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-700">Total: </span>
                  <span className="text-lg font-bold">
                    ${items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : editingInvoice ? (
                    'Update Invoice'
                  ) : (
                    'Create Invoice'
                  )}
                </button>
              </div>

              {/* Status Messages */}
              {submitStatus.message && (
                <div 
                  className={`mt-4 p-4 rounded-lg ${
                    submitStatus.type === 'success' ? 'bg-green-50 text-green-700' :
                    submitStatus.type === 'error' ? 'bg-red-50 text-red-700' :
                    'bg-blue-50 text-blue-700'
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {isViewModalOpen && viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold">Invoice Details</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingInvoice(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Invoice Number</label>
                  <p className="mt-1 text-gray-900">{viewingInvoice.invoice_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Date</label>
                  <p className="mt-1 text-gray-900">
                    {format(new Date(viewingInvoice.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Client</label>
                  <p className="mt-1 text-gray-900">
                    {viewingInvoice.client?.name}
                    {viewingInvoice.client?.company_name && (
                      <span className="text-gray-500 text-sm block">
                        {viewingInvoice.client.company_name}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Total Amount</label>
                  <p className="mt-1 text-gray-900">
                    ${viewingInvoice.total.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Items</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingInvoice.items.map((item, index) => (
                        <tr key={item.id || index}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{item.description}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">${item.price.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-4 py-2 text-sm font-medium text-gray-900 text-right">Total:</td>
                        <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                          ${viewingInvoice.total.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setViewingInvoice(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setEditingInvoice(viewingInvoice);
                    setIsViewModalOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;