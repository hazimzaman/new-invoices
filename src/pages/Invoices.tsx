import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, Loader2, Eye, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';
import { generateInvoicePDF } from '../services/generateInvoicePDF';
import type { Settings } from '../types/settings';

interface Client {
  id: string;
  name: string;
  company_name: string;
}

interface InvoiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  created_at: string;
  total: number;
  client: Client;
  items: InvoiceItem[];
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchClients();
      fetchSettings();
    }
  }, [user]);

  async function fetchInvoices() {
    try {
      setIsLoading(true);
      // First fetch invoices with client information
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, company_name)
        `)
        .order('created_at', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        return;
      }

      // Then fetch items for each invoice
      const invoicesWithItems = await Promise.all((invoicesData || []).map(async (invoice) => {
        const { data: itemsData, error: itemsError } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id);

        if (itemsError) {
          console.error('Error fetching invoice items:', itemsError);
          return { ...invoice, items: [] };
        }

        return { ...invoice, items: itemsData || [] };
      }));

      setInvoices(invoicesWithItems);
    } catch (error) {
      console.error('Error in fetchInvoices:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company_name');

      if (error) {
        console.error('Error fetching clients:', error);
        return;
      }

      setClients(data || []);
    } catch (error) {
      console.error('Error in fetchClients:', error);
    }
  }

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      const total = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      
      if (editingInvoice) {
        // Update invoice
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            client_id: selectedClient,
            total
          })
          .eq('id', editingInvoice.id);

        if (updateError) {
          console.error('Error updating invoice:', updateError);
          return;
        }

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice.id);

        if (deleteError) {
          console.error('Error deleting existing items:', deleteError);
          return;
        }

        // Insert new items
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(
            items.map(item => ({
              invoice_id: editingInvoice.id,
              name: item.name,
              description: item.description || '',
              price: parseFloat(item.price) || 0
            }))
          );

        if (itemsError) {
          console.error('Error updating invoice items:', itemsError);
          return;
        }
      } else {
        // Create new invoice
        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert([{
            client_id: selectedClient,
            invoice_number: Math.floor(Math.random() * 10000).toString(), // Better invoice number generation
            total,
            user_id: user?.id
          }])
          .select()
          .single();

        if (error || !invoice) {
          console.error('Error creating invoice:', error);
          return;
        }

        // Insert items for new invoice
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(
            items.map(item => ({
              invoice_id: invoice.id,
              name: item.name,
              description: item.description || '',
              price: parseFloat(item.price) || 0
            }))
          );

        if (itemsError) {
          console.error('Error creating invoice items:', itemsError);
          return;
        }
      }

      // Reset form and fetch updated data
      setIsModalOpen(false);
      setEditingInvoice(null);
      setSelectedClient('');
      setItems([{ name: '', description: '', price: '' }]);
      await fetchInvoices();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        setIsLoading(true);
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting invoice:', error);
          return;
        }

        await fetchInvoices();
      } catch (error) {
        console.error('Error in handleDelete:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', description: '', price: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof typeof items[0], value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setSelectedClient(invoice.client_id);
    setItems(
      invoice.items.map(item => ({
        name: item.name,
        description: item.description || '',
        price: item.price.toString()
      }))
    );
    setIsModalOpen(true);
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      if (!settings) {
        console.error('Settings not loaded');
        return;
      }

      if (!invoice) {
        console.error('Invoice data not available');
        return;
      }

      setIsLoading(true);
      const pdfBlob = await generateInvoicePDF(invoice, settings);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${invoice.invoice_number || 'download'}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.client?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoice_number.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
        <button
          onClick={() => {
            setEditingInvoice(null);
            setSelectedClient('');
            setItems([{ name: '', description: '', price: '' }]);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Invoice
        </button>
      </div>

      <div className="mb-6 flex gap-4">
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
          className="px-4 py-2 border border-gray-300 rounded-lg flex items-center text-gray-700 hover:bg-gray-50"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{invoice.invoice_number}</td>
                <td className="px-6 py-4 whitespace-nowrap">{invoice.client?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{invoice.client?.company_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">${invoice.total.toFixed(2)}</td>
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
                      onClick={() => handleEdit(invoice)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="text-red-600 hover:text-red-800"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client</label>
                  <select
                    required
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Invoice Items</h3>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      disabled={isSubmitting}
                    >
                      + Add Item
                    </button>
                  </div>
                  
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-4 items-start border-b pb-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700">Item Name</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700">Price</label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateItem(index, 'price', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="mt-6 text-red-600 hover:text-red-800"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">
                    Total: ${items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingInvoice(null);
                    setSelectedClient('');
                    setItems([{ name: '', description: '', price: '' }]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingInvoice ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
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
                  <label className="block text-sm font-medium text-gray-500">Client Name</label>
                  <p className="mt-1 text-gray-900">{viewingInvoice.client?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Company Name</label>
                  <p className="mt-1 text-gray-900">{viewingInvoice.client?.company_name}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Invoice Items</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {viewingInvoice.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2">{item.description || '-'}</td>
                          <td className="px-4 py-2 text-right">${item.price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-right font-medium">Total:</td>
                        <td className="px-4 py-2 text-right font-bold">${viewingInvoice.total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setViewingInvoice(null);
                  setIsViewModalOpen(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadPDF(viewingInvoice)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  handleEdit(viewingInvoice);
                  setIsViewModalOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;