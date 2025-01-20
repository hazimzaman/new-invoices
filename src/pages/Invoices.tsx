import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, Loader2, Eye, Download, Mail, FileText, X, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';
import { generateInvoicePDF } from '../services/generateInvoicePDF.tsx';
import type { Settings } from '../types/settings';
import { toast } from 'react-hot-toast';
import { sendInvoiceEmail } from '../services/emailService';
import { ContextMenu } from '../components/ContextMenu';

interface Client {
  id: string;
  name: string;
  company_name: string;
  currency: string;
  email: string;
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

interface BusinessSettings {
  logo_url: string | null;
  business_name: string | null;
  // ... other settings fields
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
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
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
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClientCurrency, setSelectedClientCurrency] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      if (!user || initialLoadRef.current) return;

      try {
        setIsLoading(true);
        await Promise.all([
          fetchInvoices(),
          fetchClients()
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

  useEffect(() => {
    if (!selectionMode) {
      setSelectedInvoices([]);
    }
  }, [selectionMode]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, [user?.id]);

  async function fetchInvoices() {
    try {
      if (!initialLoadRef.current) {
        setIsRefreshing(true);
      }

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(
            id, 
            name, 
            company_name, 
            currency,
            email
          ),
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
        .select('id, name, company_name, currency')
        .eq('user_id', user?.id);

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to fetch clients. Please try again.');
    }
  }

  const generateInvoiceNumber = (settings: Settings | null) => {
    if (!settings) return `${Date.now()}`;
    
    const nextNumber = (settings.invoice_number || 0) + 1;
    const prefix = settings.invoice_prefix;
    
    return prefix ? `${prefix}${nextNumber}` : `${nextNumber}`;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      return sum + price;
    }, 0);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemsWithNumericPrices = items.map(item => ({
      ...item,
      price: parseFloat(item.price) || 0
    }));

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
            total: itemsWithNumericPrices.reduce((sum, item) => sum + item.price, 0),
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
          .insert(itemsWithNumericPrices.map(item => ({
            invoice_id: editingInvoice.id,
            name: item.name,
            description: item.description,
            price: item.price,
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
            total: itemsWithNumericPrices.reduce((sum, item) => sum + item.price, 0),
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
          .insert(itemsWithNumericPrices.map(item => ({
            invoice_id: invoiceData.id,
            name: item.name,
            description: item.description,
            price: item.price,
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
        toast.error('Business settings not loaded');
        return;
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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInvoice) return;

    try {
      setEmailLoading(true);
      
      // Generate PDF
      if (!settings) {
        throw new Error('Settings not loaded');
      }
      const pdfBlob = await generateInvoicePDF(selectedInvoice, settings);
      
      // Send email with currency
      await sendInvoiceEmail({
        to: emailForm.to,
        invoiceNumber: selectedInvoice.invoice_number,
        clientName: selectedInvoice.client?.name || 'Valued Customer',
        amount: selectedInvoice.total,
        currency: selectedInvoice.client?.currency || 'USD',
        pdfBlob: pdfBlob,
        items: selectedInvoice.items,
        customMessage: emailForm.content
      });

      setEmailModalOpen(false);
      setSelectedInvoice(null);
      setEmailForm({
        to: '',
        subject: '',
        content: ''
      });
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
      .replace(/{amount}/g, formatCurrency(invoice.total, invoice.client?.currency || 'USD'));
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

  const formatCurrency = (amount: number, currency: string = '$') => {
    // Use the exact currency strings from database
    const currencySymbol = currency || '$';  // Default to $ if no currency specified
    
    // Format the number with 2 decimal places
    const formattedAmount = amount.toFixed(2);
    
    // Place the currency symbol in the correct position
    if (currencySymbol === 'RM' || currencySymbol === 'S$') {
      return `${currencySymbol}${formattedAmount}`;
    } else {
      return `${currencySymbol}${formattedAmount}`;
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedInvoices(filteredInvoices.map(invoice => invoice.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedInvoices.length) return;

    if (window.confirm(`Are you sure you want to delete ${selectedInvoices.length} invoice(s)?`)) {
      try {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .in('id', selectedInvoices);

        if (error) throw error;

        toast.success(`Successfully deleted ${selectedInvoices.length} invoice(s)`);
        setSelectedInvoices([]);
        fetchInvoices();
      } catch (error) {
        console.error('Error deleting invoices:', error);
        toast.error('Failed to delete invoices');
      }
    }
  };

  const handleBulkDownload = async () => {
    try {
      for (const invoiceId of selectedInvoices) {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (invoice) {
          await handleDownloadPDF(invoice);
        }
      }
      toast.success(`Downloaded ${selectedInvoices.length} invoice(s)`);
    } catch (error) {
      console.error('Error downloading invoices:', error);
      toast.error('Failed to download some invoices');
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClientCurrency(client.currency || '$');
    }
  };

  return (
    <div>
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

      {/* Add Bulk Actions */}
      {selectionMode && selectedInvoices.length > 0 && (
        <div className="mb-4 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedInvoices.length} invoice(s) selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDownload}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {selectionMode && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.length === filteredInvoices.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 can-select"
                  />
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                {selectionMode && (
                  <td className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.includes(invoice.id)}
                      onChange={() => handleSelectInvoice(invoice.id)}
                      className="rounded border-gray-300 can-select"
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-gray-900">{invoice.invoice_number}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{invoice.client?.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{invoice.items?.[0]?.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(invoice.total, invoice.client?.currency)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => {
                        setViewingInvoice(invoice);
                        setIsViewModalOpen(true);
                      }}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(invoice)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(invoice)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEmailModal(invoice)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold">
                {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingInvoice(null);
                  setItems([{ name: '', description: '', price: '' }]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Client Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <select
                  required
                  value={selectedClient}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  disabled={isSubmitting}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.company_name ? `- ${client.company_name}` : ''}
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
                    onClick={() => setItems([...items, { name: '', description: '', price: '' }])}
                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
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
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Price ({selectedClientCurrency || '$'}) *
                        </label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
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
                    {formatCurrency(calculateTotal(), selectedClientCurrency || '$')}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingInvoice(null);
                    setItems([{ name: '', description: '', price: '' }]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {isViewModalOpen && viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl">
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
                    {formatCurrency(viewingInvoice.total, viewingInvoice.client?.currency)}
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
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(item.price, viewingInvoice.client?.currency)}
                            </td>
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

            <form onSubmit={handleSendEmail} className="space-y-4">
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
                  disabled={emailLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center"
                  disabled={emailLoading}
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Invoice'
                  )}
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