const compressInvoiceData = async (data: any) => {
  // If there are any images in the invoice data, compress them
  if (data.images) {
    const compressedImages = await Promise.all(
      data.images.map(async (image: string) => {
        // If it's a base64 image, compress it
        if (image.startsWith('data:image')) {
          return await compressImage(image);
        }
        return image;
      })
    );
    return { ...data, images: compressedImages };
  }
  return data;
};

const handleSendEmail = async () => {
  try {
    // Show loading indicator
    setIsLoading(true);

    // Compress any images or large data before sending
    const compressedData = await compressInvoiceData(data);
    
    const result = await sendInvoiceEmail(compressedData);
    
    // Show success message
    toast.success('Invoice sent successfully!');
  } catch (error: any) {
    console.error('Error sending invoice:', error);
    // Show specific error message
    toast.error(
      error.message === 'Payload size too large' 
        ? 'The invoice data is too large. Please reduce the size of any attachments.'
        : 'Failed to send invoice. Please try again or contact support.'
    );
  } finally {
    setIsLoading(false);
  }
}; 