import React, { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toast } from 'react-hot-toast';

interface BusinessSettings {
  id?: string;
  user_id: string;
  business_name: string | null;
  business_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tax_number: string | null;
  registration_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  bank_swift: string | null;
  bank_iban: string | null;
  invoice_prefix: string | null;
  invoice_footer_note: string | null;
  wise_email: string | null;
  logo_url: string | null;
  invoice_number: number | null;
}

function Settings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>({
    user_id: user?.id || '',
    business_name: null,
    business_address: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    tax_number: null,
    registration_number: null,
    bank_name: null,
    bank_account_name: null,
    bank_account_number: null,
    bank_sort_code: null,
    bank_swift: null,
    bank_iban: null,
    invoice_prefix: null,
    invoice_footer_note: null,
    wise_email: null,
    logo_url: null,
    invoice_number: null,
  });

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    }
  }, [user?.id]);

  const fetchSettings = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('business_settings')
        .select()
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateInvoiceNumbers = (settings: BusinessSettings) => {
    const lastNumber = settings.last_invoice_number;
    const sequence = settings.invoice_number_sequence;

    if (sequence !== null && lastNumber !== null && sequence <= lastNumber) {
      return 'Invoice number sequence must be greater than the last invoice number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error('You must be logged in to save settings');
      return;
    }

    const savePromise = new Promise(async (resolve, reject) => {
      try {
        setIsSaving(true);

        const validationError = validateInvoiceNumbers(settings);
        if (validationError) {
          reject(new Error(validationError));
          return;
        }

        const { error } = await supabase
          .from('business_settings')
          .upsert({
            ...settings,
            user_id: user.id
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        await fetchSettings();
        resolve('Settings saved successfully!');
      } catch (error) {
        console.error('Error in handleSubmit:', error);
        reject(new Error(error instanceof Error ? error.message : 'Failed to save settings'));
      } finally {
        setIsSaving(false);
      }
    });

    toast.promise(savePromise, {
      loading: 'Saving settings...',
      success: (message) => message as string,
      error: (err) => err.message
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => {
      if (!prev) return prev;
      const newValue = value.trim() === '' ? null : value;
      return { ...prev, [name]: newValue };
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // Check authentication
    const session = await supabase.auth.getSession();
    const isAuthenticated = !!session.data.session;

    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    // Check file type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'jpg') {
      toast.error('Only JPG files are allowed');
      return;
    }

    const uploadPromise = new Promise(async (resolve, reject) => {
      try {
        const timestamp = new Date().getTime();
        // Use the appropriate folder based on authentication status
        const folderPrefix = isAuthenticated ? '1peuqw_1' : '1peuqw_1';
        const fileName = `${folderPrefix}/logo-${timestamp}.jpg`;

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('logos')
          .upload(fileName, file, {
            upsert: true,
            cacheControl: '3600'
          });

        if (error) {
          console.error('Upload error:', error);
          throw error;
        }

        // Get URL based on authentication status
        let fileUrl;
        if (isAuthenticated) {
          const { data: { signedUrl } } = await supabase.storage
            .from('logos')
            .createSignedUrl(data.path, 31536000); // 1 year expiry
          fileUrl = signedUrl;
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(data.path);
          fileUrl = publicUrl;
        }

        if (!fileUrl) throw new Error('Failed to generate URL');

        // Update settings with new logo URL
        if (isAuthenticated) {
          const { error: updateError } = await supabase
            .from('business_settings')
            .update({ logo_url: fileUrl })
            .eq('user_id', session.data.session!.user.id);

          if (updateError) throw updateError;
        }

        setSettings(prev => ({
          ...prev,
          logo_url: fileUrl
        }));

        // Clean up old file if exists in the appropriate folder
        if (settings.logo_url) {
          const oldPath = settings.logo_url.split('/').slice(-2).join('/');
          await supabase.storage
            .from('logos')
            .remove([oldPath]);
        }

        resolve('Logo uploaded successfully!');
      } catch (error) {
        console.error('Error uploading logo:', error);
        reject(new Error('Failed to upload logo. Please try again.'));
      }
    });

    toast.promise(uploadPromise, {
      loading: 'Uploading logo...',
      success: (message) => message as string,
      error: (err) => err.message
    });
  };

  // Function to refresh signed URLs for authenticated users
  const refreshSignedUrl = async (path: string) => {
    const session = await supabase.auth.getSession();
    if (session.data.session) {
      const { data: { signedUrl } } = await supabase.storage
        .from('logos')
        .createSignedUrl(path, 31536000);
      return signedUrl;
    }
    return null;
  };

  // Add this to your useEffect to refresh the URL when component mounts
  useEffect(() => {
    if (settings.logo_url) {
      const path = settings.logo_url.split('/').slice(-2).join('/');
      refreshSignedUrl(path).then(newUrl => {
        if (newUrl) {
          setSettings(prev => ({
            ...prev,
            logo_url: newUrl
          }));
        }
      });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Business Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          {/* Business Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Business Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Business Name</label>
                <input
                  type="text"
                  name="business_name"
                  value={settings.business_name || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <div className="flex flex-col space-y-4">
                  {settings?.logo_url && (
                    <div className="flex items-center space-x-4">
                      <img 
                        src={settings.logo_url} 
                        alt="Company Logo" 
                        className="h-16 w-auto object-contain rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSettings(prev => {
                            if (!prev) return prev;
                            return { ...prev, logo_url: null };
                          });
                          // Also delete from storage if needed
                          if (user?.id) {
                            toast.promise(
                              supabase.storage
                                .from('logos')
                                .remove([`${user.id}/logo.${settings.logo_url?.split('.').pop()}`]),
                              {
                                loading: 'Removing logo...',
                                success: 'Logo removed successfully',
                                error: 'Failed to remove logo'
                              }
                            );
                          }
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 hover:border-red-300 rounded-md"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-center w-full">
                    <label className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-gray-300 border-dashed cursor-pointer hover:border-blue-500 hover:bg-gray-50">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg
                          className="w-8 h-8 mb-3 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                {settings?.logo_url && (
                  <p className="mt-2 text-xs text-gray-500">
                    Current logo shown above. Upload a new one to replace it.
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Business Address</label>
                <textarea
                  name="business_address"
                  value={settings.business_address || ''}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Name</label>
                <input
                  type="text"
                  name="contact_name"
                  value={settings.contact_name || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                <input
                  type="email"
                  name="contact_email"
                  value={settings.contact_email || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={settings.contact_phone || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Wise Email</label>
                <input
                  type="email"
                  name="wise_email"
                  value={settings.wise_email || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Business Registration */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Business Registration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tax Number</label>
                <input
                  type="text"
                  name="tax_number"
                  value={settings.tax_number || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                <input
                  type="text"
                  name="registration_number"
                  value={settings.registration_number || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Banking Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Banking Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                <input
                  type="text"
                  name="bank_name"
                  value={settings.bank_name || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Name</label>
                <input
                  type="text"
                  name="bank_account_name"
                  value={settings.bank_account_name || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <input
                  type="text"
                  name="bank_account_number"
                  value={settings.bank_account_number || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sort Code</label>
                <input
                  type="text"
                  name="bank_sort_code"
                  value={settings.bank_sort_code || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">SWIFT/BIC</label>
                <input
                  type="text"
                  name="bank_swift"
                  value={settings.bank_swift || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">IBAN</label>
                <input
                  type="text"
                  name="bank_iban"
                  value={settings.bank_iban || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Invoice Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Invoice Number Prefix</label>
                <input
                  type="text"
                  name="invoice_prefix"
                  value={settings.invoice_prefix || ''}
                  onChange={handleChange}
                  placeholder="e.g., INV-"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Current Invoice Number
                  <span className="text-sm text-gray-500 ml-1">
                    (Next invoice will be {((settings.invoice_number || 0) + 1)})
                  </span>
                </label>
                <input
                  type="number"
                  name="invoice_number"
                  value={settings.invoice_number || ''}
                  onChange={handleChange}
                  placeholder="e.g., 156"
                  min="0"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Next invoice will automatically use {(settings.invoice_number || 0) + 1}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Invoice Footer Note</label>
                <textarea
                  name="invoice_footer_note"
                  value={settings.invoice_footer_note || ''}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g., Thank you for your business!"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;