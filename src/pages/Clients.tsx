import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, Filter, Loader2, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';
import { toast } from 'react-hot-toast';
import { ContextMenu } from '../components/ContextMenu';

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
    <div>
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {selectionMode ? 'Cancel Selection' : 'Select'}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients..."
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
                    Filter by Name
                  </label>
                  <input
                    type="text"
                    value={filters.name}
                    onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Filter by name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Company
                  </label>
                  <input
                    type="text"
                    value={filters.company}
                    onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Filter by company..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Email
                  </label>
                  <input
                    type="text"
                    value={filters.email}
                    onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Filter by email..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Currency
                  </label>
                  <select
                    value={filters.currency}
                    onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Currencies</option>
                    <option value="$">$ (Dollar)</option>
                    <option value="€">€ (Euro)</option>
                    <option value="₹">₹ (Rupee)</option>
                    <option value="£">£ (Pound)</option>
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
                      <option value="name">Name</option>
                      <option value="company">Company</option>
                      <option value="date">Date Created</option>
                    </select>
                    <select
                      value={filters.sortOrder}
                      onChange={(e) => setFilters({
                        ...filters,
                        sortOrder: e.target.value as 'asc' | 'desc'
                      })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
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

        {/* Only show bulk actions when in selection mode and items are selected */}
        {selectionMode && selectedClients.length > 0 && (
          <div className="mb-4 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedClients.length} client(s) selected
            </div>
            <div className="flex gap-2">
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

        <div className="flex-1 bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {selectionMode && (
                  <th scope="col" className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedClients.length === filteredClients.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 can-select"
                    />
                  </th>
                )}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Currency</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  {selectionMode && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={() => handleSelectClient(client.id)}
                        className="rounded border-gray-300 can-select"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">{client.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{client.company_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{format(new Date(client.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-center">{client.currency || '$'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setViewingClient(client);
                          setIsViewModalOpen(true);
                        }}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
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

        {/* View Details Modal */}
        {isViewModalOpen && viewingClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold">Client Details</h2>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setViewingClient(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="mt-1 text-gray-900">{viewingClient.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Company</label>
                  <p className="mt-1 text-gray-900">{viewingClient.company_name || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Address</label>
                  <p className="mt-1 text-gray-900 whitespace-pre-line">
                    {viewingClient.client_address}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Tax Information</label>
                  <p className="mt-1 text-gray-900">
                    {viewingClient.tax_type}: {viewingClient.tax_number}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-gray-900">{viewingClient.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created</label>
                  <p className="mt-1 text-gray-900">
                    {format(new Date(viewingClient.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setViewingClient(null);
                    setIsViewModalOpen(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setEditingClient(viewingClient);
                    setFormData({
                      name: viewingClient.name,
                      company_name: viewingClient.company_name,
                      email: viewingClient.email,
                      client_address: viewingClient.client_address,
                      tax_number: viewingClient.tax_number,
                      tax_type: viewingClient.tax_type,
                      phone_number: viewingClient.phone_number,
                      currency: viewingClient.currency
                    });
                    setIsViewModalOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit/Create Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-8 max-w-[800px] w-full">
              <h2 className="text-xl font-bold mb-4">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tax Type</label>
                      <select
                        value={formData.tax_type}
                        onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">Select Tax Type</option>
                        <option value="VAT">VAT</option>
                        <option value="SSN">SSN</option>
                        <option value="EIN">EIN</option>
                        <option value="TIN">TIN</option>
                      </select>
                    </div>
                  </div>

                  {/* Second Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Name</label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="+1 (123) 456-7890"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tax Number</label>
                      <input
                        type="text"
                        value={formData.tax_number}
                        onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Currency Selector - Full Width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Currency *</label>
                  <select
                    required
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="$">$ (Dollar)</option>
                    <option value="€">€ (Euro)</option>
                    <option value="₹">₹ (Rupee)</option>
                    <option value="£">£ (Pound)</option>
                  </select>
                </div>

                {/* Full Width Address Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    rows={3}
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Street Address&#10;City, State/Province&#10;Country, Postal Code"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : editingClient ? 'Update Client' : 'Create Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Clients;