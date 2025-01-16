import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../lib/auth';

interface Client {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone_number: string;
  created_at: string;
  currency: string;
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
    phone_number: '',
    currency: '$'
  });

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  async function fetchClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }

    setClients(data || []);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);

      if (error) {
        console.error('Error updating client:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert([{ ...formData, user_id: user?.id }]);

      if (error) {
        console.error('Error creating client:', error);
        return;
      }
    }

    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({
      name: '',
      company_name: '',
      email: '',
      phone_number: '',
      currency: '$'
    });
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting client:', error);
        return;
      }

      fetchClients();
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search clients..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden min-h-0">
        <div className="overflow-x-auto h-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                <th scope="col" className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Company</th>
                <th scope="col" className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                <th scope="col" className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Currency</th>
                <th scope="col" className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{client.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{client.company_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(client.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{client.currency}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setViewingClient(client);
                          setIsViewModalOpen(true);
                        }}
                        className="text-gray-600 hover:text-gray-800"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingClient(client);
                          setFormData({
                            name: client.name,
                            company_name: client.company_name,
                            email: client.email,
                            phone_number: client.phone_number,
                            currency: client.currency
                          });
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
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
                <label className="block text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-gray-900">{viewingClient.email || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-gray-900">{viewingClient.phone_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Currency</label>
                <p className="mt-1 text-gray-900">{viewingClient.currency}</p>
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
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
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
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Currency</label>
                  <select
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
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingClient(null);
                    setFormData({
                      name: '',
                      company_name: '',
                      email: '',
                      phone_number: '',
                      currency: '$'
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingClient ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;