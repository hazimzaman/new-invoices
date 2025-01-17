import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, Loader2, Eye, Download, Mail, FileText, X, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';
import { generateInvoicePDF } from '../services/generateInvoicePDF.tsx';
import type { Settings } from '../types/settings';
import { toast } from 'react-hot-toast';
// import { sendInvoiceEmail } from '../services/emailService';

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
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    content: ''
  });
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchEmailContent = async () => {
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('email_content')
          .single();

        if (error) throw error;
        if (data?.email_content) {
          setEmailContent(data.email_content);
        }
      } catch (error) {
        console.error('Error fetching email content:', error);
      }
    };

    fetchEmailContent();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveActionId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  async function fetchInvoices() {
    try {
      if (!initialLoadRef.current) {
        setIsRefreshing(true);
      }

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, company_name, email),
          items:invoice_items(id, name, description, price)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to fetch invoices');
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

      if (editingInvoice) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            client_id: selectedClient,
            total: items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0),
            user_id: user.id
          })
          .eq('id', editingInvoice.id);

        if (invoiceError) throw invoiceError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice.id);

        if (deleteError) throw deleteError;

        // Create new items
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items.map(item => ({
            invoice_id: editingInvoice.id,
            name: item.name,
            description: item.description,
            price: parseFloat(item.price),
            user_id: user.id
          })));

        if (itemsError) throw itemsError;

        toast.success('Invoice updated successfully!');
      } else {
        // Create new invoice
        const nextNumber = (settings.invoice_number || 0) + 1;
        const invoiceNumber = generateInvoiceNumber(settings);

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

        // Create items
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items.map(item => ({
            invoice_id: invoiceData.id,
            name: item.name,
            description: item.description,
            price: parseFloat(item.price),
            user_id: user.id
          })));

        if (itemsError) throw itemsError;

        toast.success('Invoice created successfully!');
      }

      setIsModalOpen(false);
      resetForm();
      await fetchInvoices();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save invoice. Please try again.');
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
    setEditingInvoice(null);
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

  const handleSendEmail = async (invoice: Invoice, message?: string) => {
    try {
      setEmailLoading(true);
      
      // Generate PDF
      const pdfBlob = await generateInvoicePDF(invoice, settings);
      
      // Send email
      await sendInvoiceEmail({
        to: invoice.client?.email || '',
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client?.name || 'Valued Customer',
        amount: invoice.total,
        pdfBlob: pdfBlob,
        items: invoice.items,
        customMessage: message
      });

      setEmailModalOpen(false);
      setSelectedInvoice(null);
      setCustomMessage('');
      toast.success('Invoice sent successfully');
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const replaceTemplateVariables = (content: string, invoice: Invoice) => {
    return content
      .replace(/{clientName}/g, invoice.client?.name || 'Valued Customer')
      .replace(/{invoiceNumber}/g, invoice.invoice_number)
      .replace(/{amount}/g, `$${invoice.total.toFixed(2)}`);
  };

  const handleOpenEmailModal = async (invoice: Invoice) => {
    try {
      // Fetch client details including email
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('email, name')
        .eq('id', invoice.client_id)
        .single();

      if (clientError) throw clientError;

      setSelectedInvoice(invoice);
      setEmailForm({
        to: clientData?.email || '',
        subject: `Invoice #${invoice.invoice_number} - ${clientData?.name || 'Client'}`,
        content: replaceTemplateVariables(emailContent, { 
          ...invoice, 
          client: { ...invoice.client, email: clientData?.email } 
        })
      });
      setEmailModalOpen(true);
    } catch (error) {
      console.error('Error fetching client email:', error);
      toast.error('Failed to fetch client email');
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setSelectedClient(invoice.client_id);
    // Map the existing items to match the form structure
    setItems(
      invoice.items.map(item => ({
        name: item.name,
        description: item.description,
        price: item.price.toString()
      }))
    );
    setIsModalOpen(true);
  };

  const addItem = () => {
    setItems([...items, { name: '', description: '', price: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
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
                  <span className="hidden sm:inline">Invoice #</span>
                  <span className="sm:hidden">Info</span>
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
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
                      <div>
                        <div>{invoice.invoice_number}</div>
                        <div className="sm:hidden text-sm text-gray-500">
                          {invoice.client?.name}
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                      <div>
                        {invoice.client?.name}
                        {invoice.client?.company_name && (
                          <span className="text-gray-500 text-sm block">
                            {invoice.client.company_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <div className="max-w-xs">
                        {invoice.items && invoice.items.length > 0 ? (
                          <div className="text-sm text-gray-600 space-y-1">
                            {invoice.items.map((item, index) => (
                              <div key={index}>{item.name}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No items</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ${invoice.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap w-24">
                      <div className="flex items-center justify-end space-x-2">
                        <div className="hidden sm:flex space-x-2">
                          <button
                            onClick={() => {
                              setViewingInvoice(invoice);
                              setIsViewModalOpen(true);
                            }}
                            className="text-gray-600 hover:text-gray-800 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(invoice)}
                            className="text-gray-600 hover:text-gray-800 p-1"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="text-blue-600 hover:text-primary-800 p-1"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEmailModal(invoice)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Send Email"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="sm:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionId(activeActionId === invoice.id ? null : invoice.id);
                            }}
                            className="text-gray-600 hover:text-gray-800 p-1"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeActionId === invoice.id && (
                            <div 
                              className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setViewingInvoice(invoice);
                                    setIsViewModalOpen(true);
                                    setActiveActionId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Eye className="w-4 h-4 mr-3" /> View Details
                                </button>
                                <button
                                  onClick={() => {
                                    handleDownloadPDF(invoice);
                                    setActiveActionId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Download className="w-4 h-4 mr-3" /> Download PDF
                                </button>
                                <button
                                  onClick={() => {
                                    handleEdit(invoice);
                                    setActiveActionId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Edit2 className="w-4 h-4 mr-3" /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(invoice.id);
                                    setActiveActionId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Trash2 className="w-4 h-4 mr-3" /> Delete
                                </button>
                                <button
                                  onClick={() => {
                                    handleOpenEmailModal(invoice);
                                    setActiveActionId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Mail className="w-4 h-4 mr-3" /> Send Email
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  required
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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

              {/* Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Items</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Add Item
                  </button>
                </div>
                
                {items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium">Item {index + 1}</h4>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name *</label>
                        <input
                          required
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].name = e.target.value;
                            setItems(newItems);
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Price *</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].price = e.target.value;
                            setItems(newItems);
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].description = e.target.value;
                            setItems(newItems);
                          }}
                          rows={2}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
                      {viewingInvoice.items && viewingInvoice.items.length > 0 ? (
                        viewingInvoice.items.map((item, index) => (
                          <tr key={item.id || index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{item.description}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">${item.price.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm text-gray-500 text-center">
                            No items found
                          </td>
                        </tr>
                      )}
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

      {/* Email Modal */}
      {emailModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Send Invoice</h3>
              <button
                onClick={() => {
                  setEmailModalOpen(false);
                  setSelectedInvoice(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Send To Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Send To
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter client email"
                  required
                />
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              {/* Content Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={emailForm.content}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              {/* Attachment Preview */}
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    Invoice_{selectedInvoice.invoice_number}.pdf
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEmailModalOpen(false);
                    setSelectedInvoice(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Send Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;