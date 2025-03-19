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
import { Link, useNavigate } from 'react-router-dom';
import { Table } from '../components/Table';

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
    from: '',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    content: '',
    businessName: '',
    smtp: {
      host: '',
      port: 0,
      password: ''
    }
  });
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClientCurrency, setSelectedClientCurrency] = useState<string>('');
  const [downloadingInvoices, setDownloadingInvoices] = useState<Set<string>>(new Set());

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
    if (downloadingInvoices.has(invoice.id)) return;
    
    try {
      setDownloadingInvoices(prev => new Set([...prev, invoice.id]));
      
      // Show toast for mobile feedback
      const loadingToast = toast.loading('Preparing PDF...');
      
      if (!settings) {
        toast.error('Business settings not loaded', { id: loadingToast });
        return;
      }

      const pdfBlob = await generateInvoicePDF(invoice, settings);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename
      const invoiceNumber = invoice.invoice_number.replace(/^.*?(\d+)$/, '$1');
      const clientName = invoice.client?.name || 'Unknown Client';
      const fileName = `Invoice #${invoiceNumber} - ${clientName}.pdf`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully', {
        id: loadingToast
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingInvoices(prev => {
        const next = new Set(prev);
        next.delete(invoice.id);
        return next;
      });
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

  const handleEmailClick = async (invoice: Invoice) => {
    try {
      setEmailLoading(true);
      console.log('Starting email process for invoice:', invoice.id);
      
      // First just get the invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      console.log('Invoice data:', invoiceData);

      if (invoiceError) {
        console.error('Invoice error:', invoiceError);
        throw new Error('Could not fetch invoice');
      }

      // Then get the client separately
      const { data: clientData, error: clientError } = await supabase
        .from('clients') // or 'client' if that's your table name
        .select('*')
        .eq('id', invoiceData.client_id)
        .single();

      console.log('Client data:', clientData);

      if (clientError) {
        console.error('Client error:', clientError);
        throw new Error('Could not fetch client details');
      }

      // Fetch business settings
      const { data: settings, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .single();

      console.log('Business settings:', settings, 'Error:', settingsError);

      if (settingsError || !settings) {
        console.error('Settings fetch error:', settingsError);
        throw new Error('Could not fetch business settings');
      }

      // Set up email form with complete data
      setEmailForm({
        from: settings.contact_email || '',
        to: clientData?.email || '',
        cc: '',
        bcc: '',
        subject: `Invoice #${invoiceData.invoice_number} from ${settings.business_name}`,
        content: `Dear ${clientData?.name},\n\nPlease find attached invoice #${invoiceData.invoice_number}.\n\nBest regards,\n${settings.business_name}`,
        businessName: settings.business_name
      });

      // Store complete invoice data
      setSelectedInvoice(invoiceData);
      
      setEmailModalOpen(true);
    } catch (error) {
      console.error('Detailed error in handleEmailClick:', error);
      toast.error('Failed to prepare email: ' + (error as Error).message);
    } finally {
      setEmailLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setEmailLoading(true);

      if (!selectedInvoice) {
        toast.error('No invoice selected');
        return;
      }

      // Fetch fresh complete invoice data with correct query syntax
      const { data: completeInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(
            id,
            name,
            email,
            client_address,
            currency
          )
        `)
        .eq('id', selectedInvoice.id)
        .single();

      console.log('Complete invoice data:', completeInvoice, 'Error:', invoiceError);

      if (invoiceError || !completeInvoice) {
        console.error('Invoice fetch error:', invoiceError);
        throw new Error('Could not fetch invoice details');
      }

      // Fetch fresh settings data
      const { data: settings, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .single();

      if (settingsError || !settings) {
        console.error('Settings fetch error:', settingsError);
        throw new Error('Could not load business settings');
      }

      // Generate PDF with complete data
      const pdfBlob = await generateInvoicePDF(completeInvoice);

      // Send email with complete data
      await sendInvoiceEmail({
        from: emailForm.from,
        to: emailForm.to,
        cc: emailForm.cc,
        bcc: emailForm.bcc,
        invoiceNumber: completeInvoice.invoice_number,
        clientName: completeInvoice.client?.name || 'Valued Customer',
        amount: completeInvoice.total,
        currency: completeInvoice.client?.currency || '$',
        items: completeInvoice.items,
        customMessage: emailForm.content,
        pdfBlob,
        businessName: settings.business_name
      });

      toast.success('Email sent successfully!');
      setEmailModalOpen(false);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + (error as Error).message);
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

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setIsViewModalOpen(true);
  };

  // Mobile card view for invoices
  const renderInvoiceCard = (invoice: Invoice) => (
    <div key={invoice.id} className="bg-white rounded-lg shadow p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div 
          className="flex-1 cursor-pointer"
          onClick={() => handleViewInvoice(invoice)}
        >
          <h3 className="font-medium text-gray-900">#{invoice.invoice_number}</h3>
          <p className="text-sm text-gray-500">{invoice.client?.name}</p>
        </div>
        <ContextMenu
          options={[
            {
              label: 'View',
              icon: <Eye className="w-4 h-4" />,
              onClick: () => handleViewInvoice(invoice)
            },
            {
              label: 'Edit',
              icon: <Edit2 className="w-4 h-4" />,
              onClick: () => handleEdit(invoice)
            },
            {
              label: downloadingInvoices.has(invoice.id) ? 'Downloading...' : 'Download',
              icon: downloadingInvoices.has(invoice.id) ? 
                <Loader2 className="w-4 h-4 animate-spin" /> : 
                <Download className="w-4 h-4" />,
              onClick: () => handleDownloadPDF(invoice),
              disabled: downloadingInvoices.has(invoice.id)
            },
            {
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              onClick: () => handleDelete(invoice.id),
              className: 'text-red-600 hover:bg-red-50'
            }
          ]}
        />
      </div>
      
      <div className="text-sm text-gray-600">
        <p>{invoice.items?.[0]?.name}</p>
        <p className="text-xs text-gray-400">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</p>
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <div className="font-medium text-gray-900">
          {formatCurrency(invoice.total, invoice.client?.currency)}
        </div>
      </div>
    </div>
  );

  // Desktop action buttons
  const renderActionButtons = (invoice: Invoice) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleViewInvoice(invoice)}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="View invoice"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleEmailClick(invoice)}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Send email"
      >
        <Mail className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleEdit(invoice)}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Edit invoice"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleDownloadPDF(invoice)}
        className={`p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative
          ${downloadingInvoices.has(invoice.id) ? 'cursor-not-allowed opacity-50' : ''}`}
        title={downloadingInvoices.has(invoice.id) ? "Downloading..." : "Download PDF"}
        disabled={downloadingInvoices.has(invoice.id)}
      >
        {downloadingInvoices.has(invoice.id) ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={() => handleDelete(invoice.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Delete invoice"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-full"
              />
            </div>
            <button 
              onClick={() => {
                setEditingInvoice(null);
                setItems([{ name: '', description: '', price: '' }]);
                setIsModalOpen(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Invoice
            </button>
          </div>
        </div>

        {/* Content section */}
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No invoices found
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredInvoices.map(invoice => renderInvoiceCard(invoice))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <Table headers={["INVOICE #", "CLIENT", "ITEM", "DATE", "dasdas", "ACTIONS"]}>
                    {filteredInvoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{invoice.invoice_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{invoice.client?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{invoice.items?.[0]?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(invoice.total, invoice.client?.currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewInvoice(invoice)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEmailClick(invoice)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Send email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(invoice)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit invoice"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(invoice)}
                              className={`p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative
                                ${downloadingInvoices.has(invoice.id) ? 'cursor-not-allowed opacity-50' : ''}`}
                              title={downloadingInvoices.has(invoice.id) ? "Downloading..." : "Download PDF"}
                              disabled={downloadingInvoices.has(invoice.id)}
                            >
                              {downloadingInvoices.has(invoice.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(invoice.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </div>
            </div>
          </>
        )}
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Invoice #{viewingInvoice.invoice_number}
                </h2>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setViewingInvoice(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Client Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Client Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Name</p>
                      <p className="text-gray-900">{viewingInvoice.client?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Company</p>
                      <p className="text-gray-900">{viewingInvoice.client?.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-gray-900">{viewingInvoice.client?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Items</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {viewingInvoice.items.map((item, index) => (
                          <tr key={item.id || index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {formatCurrency(item.price, viewingInvoice.client?.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">Total</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(viewingInvoice.total, viewingInvoice.client?.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleDownloadPDF(viewingInvoice)}
                    className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    disabled={downloadingInvoices.has(viewingInvoice.id)}
                  >
                    {downloadingInvoices.has(viewingInvoice.id) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenEmailModal(viewingInvoice)}
                    className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </button>
                  <button
                    onClick={() => {
                      setIsViewModalOpen(false);
                      handleEdit(viewingInvoice);
                    }}
                    className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold">Send Invoice Email</h2>
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
              {/* From Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From
                </label>
                <input
                  type="email"
                  value={emailForm.from}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, from: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

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

              {/* CC Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CC
                </label>
                <input
                  type="email"
                  value={emailForm.cc}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, cc: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* BCC Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BCC
                </label>
                <input
                  type="email"
                  value={emailForm.bcc}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, bcc: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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

              {/* PDF Preview */}
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Invoice_{selectedInvoice.invoice_number}.pdf
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(selectedInvoice)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
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