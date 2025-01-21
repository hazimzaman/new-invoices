import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, Filter, Loader2, MoreVertical, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';
import { toast } from 'react-hot-toast';
import { ContextMenu } from '../components/ContextMenu';
import { Table } from '../components/Table';

interface Client {
  id: string;
  name: string;
  company_name: string;
  email: string;
  client_address: string;
  tax_number: string;
  tax_type: string;
  created_at: string;
  currency: string;
  phone_number?: string;
}

interface FilterState {
  name: string;
  company: string;
  email: string;
  currency: string;
  dateRange: {
    from: string;
    to: string;
  };
  sortBy: 'name' | 'company' | 'date' | 'none';
  sortOrder: 'asc' | 'desc';
}

function ActionButtons({ client, onEdit, onDelete }: {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onEdit(client)}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Edit client"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDelete(client.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Delete client"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function ClientCard({ client, onEdit, onDelete }: { 
  client: Client; 
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-900">{client.name}</h3>
          <p className="text-sm text-gray-500">{client.company_name}</p>
        </div>
        <ContextMenu
          options={[
            {
              label: 'Edit',
              icon: <Edit2 className="w-4 h-4" />,
              onClick: () => onEdit(client)
            },
            {
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              onClick: () => onDelete(client.id),
              className: 'text-red-600 hover:bg-red-50'
            }
          ]}
        />
      </div>
      
      {client.email && (
        <p className="text-sm text-gray-600 flex items-center gap-2">
          <span className="font-medium">Email:</span> {client.email}
        </p>
      )}
      
      <div className="flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span className="font-medium">Currency:</span> {client.currency}
        </div>
        <div className="text-gray-400">
          {format(new Date(client.created_at), 'MMM d, yyyy')}
        </div>
      </div>
    </div>
  );
}

function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    client_address: '',
    tax_number: '',
    tax_type: '',
    phone_number: '',
    currency: '$'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    name: '',
    company: '',
    email: '',
    currency: '',
    dateRange: {
      from: '',
      to: ''
    },
    sortBy: 'none',
    sortOrder: 'asc'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  async function fetchClients() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          company_name,
          email,
          client_address,
          tax_number,
          tax_type,
          created_at,
          currency,
          phone_number
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to fetch clients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      if (!formData.name.trim()) {
        throw new Error('Client name is required');
      }

      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', editingClient.id);

        if (error) throw error;
        toast.success('Client updated successfully');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([{ ...formData, user_id: user?.id }]);

        if (error) throw error;
        toast.success('Client created successfully');
      }

      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({
        name: '',
        company_name: '',
        email: '',
        client_address: '',
        tax_number: '',
        tax_type: '',
        phone_number: '',
        currency: '$'
      });
      await fetchClients();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast.success('Client deleted successfully');
        await fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
        toast.error('Failed to delete client. Please try again.');
      }
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      company_name: client.company_name,
      email: client.email,
      client_address: client.client_address,
      tax_number: client.tax_number,
      tax_type: client.tax_type,
      phone_number: client.phone_number,
      currency: client.currency
    });
    setIsModalOpen(true);
  };

  const filteredClients = clients
    .filter(client => {
      const matchesSearch = 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesNameFilter = !filters.name || 
        client.name.toLowerCase().includes(filters.name.toLowerCase());
      
      const matchesCompanyFilter = !filters.company || 
        client.company_name.toLowerCase().includes(filters.company.toLowerCase());
      
      const matchesEmailFilter = !filters.email || 
        client.email.toLowerCase().includes(filters.email.toLowerCase());
      
      const matchesCurrencyFilter = !filters.currency || 
        client.currency === filters.currency;
      
      const clientDate = new Date(client.created_at);
      const matchesDateFilter = 
        (!filters.dateRange.from || clientDate >= new Date(filters.dateRange.from)) &&
        (!filters.dateRange.to || clientDate <= new Date(filters.dateRange.to));

      return matchesSearch && 
             matchesNameFilter && 
             matchesCompanyFilter && 
             matchesEmailFilter && 
             matchesCurrencyFilter && 
             matchesDateFilter;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'none') return 0;
      
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'company':
          comparison = a.company_name.localeCompare(b.company_name);
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

  const resetFilters = () => {
    setFilters({
      name: '',
      company: '',
      email: '',
      currency: '',
      dateRange: {
        from: '',
        to: ''
      },
      sortBy: 'none',
      sortOrder: 'asc'
    });
  };

  // Bulk selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedClients(filteredClients.map(client => client.id));
    } else {
      setSelectedClients([]);
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!selectedClients.length) return;

    if (window.confirm(`Are you sure you want to delete ${selectedClients.length} client(s)?`)) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .in('id', selectedClients);

        if (error) throw error;

        toast.success(`Successfully deleted ${selectedClients.length} client(s)`);
        setSelectedClients([]);
        fetchClients();
      } catch (error) {
        console.error('Error deleting clients:', error);
        toast.error('Failed to delete clients');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-full"
              />
            </div>
            <button 
              onClick={() => {
                setEditingClient(null);
                setFormData({
                  name: '',
                  company_name: '',
                  email: '',
                  client_address: '',
                  tax_number: '',
                  tax_type: '',
                  phone_number: '',
                  currency: '$'
                });
                setIsModalOpen(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Client
            </button>
          </div>
        </div>

        {/* Content section - Cards for mobile, Table for desktop */}
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No clients found
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredClients.map(client => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block">
              <Table headers={["NAME", "COMPANY", "CREATED", "CURRENCY", "ACTIONS"]}>
                {filteredClients.map(client => (
                  <tr key={client.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{client.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{client.company_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(client.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{client.currency}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ActionButtons
                        client={client}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="client_address" className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <textarea
                    id="client_address"
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="$">USD ($)</option>
                    <option value="€">EUR (€)</option>
                    <option value="£">GBP (£)</option>
                    {/* Add more currency options as needed */}
                  </select>
                </div>

                {/* Tax Information */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="tax_number" className="block text-sm font-medium text-gray-700">
                      Tax Number
                    </label>
                    <input
                      type="text"
                      id="tax_number"
                      value={formData.tax_number}
                      onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="tax_type" className="block text-sm font-medium text-gray-700">
                      Tax Type
                    </label>
                    <input
                      type="text"
                      id="tax_type"
                      value={formData.tax_type}
                      onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingClient ? 'Update Client' : 'Add Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;