import { useState, useRef } from 'react';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

const ReceiptUpload = ({ expenseId, onUploadSuccess, existingReceipts = [] }) => {
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [error, setError] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please upload an image or PDF.');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit.');
        return;
      }

      setError(null);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewImage(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewImage(null);
      }

      // Upload the file
      uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);
      const token = localStorage.getItem('token');

      const formData = new FormData();
      formData.append('receipt', file);

      const response = await fetch(`/api/receipts/${expenseId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload receipt');
      }

      const result = await response.json();

      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      setPreviewImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileUrl) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/receipts/${expenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to delete receipt');
      }

      if (onUploadSuccess) {
        onUploadSuccess({ deleted: true, fileUrl });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetPrimary = async (fileUrl) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/receipts/${expenseId}/primary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to set primary receipt');
      }

      if (onUploadSuccess) {
        onUploadSuccess({ primarySet: true, fileUrl });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="receipt-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <Card className="receipt-upload-card">
        <div className="receipt-upload-header">
          <h3>Receipts</h3>
          <Button
            onClick={triggerFileInput}
            disabled={uploading}
            size="small"
          >
            {uploading ? 'Uploading...' : '+ Upload Receipt'}
          </Button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} className="close-error">×</button>
          </div>
        )}

        {previewImage && (
          <div className="upload-preview">
            <img src={previewImage} alt="Preview" />
            <div className="preview-actions">
              <span className="preview-status">Uploading...</span>
            </div>
          </div>
        )}

        {existingReceipts.length > 0 ? (
          <div className="receipts-gallery">
            {existingReceipts.map((receipt, index) => (
              <div key={index} className="receipt-item">
                <div className="receipt-thumbnail">
                  {receipt.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img
                      src={receipt}
                      alt={`Receipt ${index + 1}`}
                      onClick={() => setShowGallery(true)}
                    />
                  ) : (
                    <div className="pdf-thumbnail" onClick={() => setShowGallery(true)}>
                      📄 PDF
                    </div>
                  )}
                </div>
                <div className="receipt-actions">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleSetPrimary(receipt)}
                    title="Set as primary"
                  >
                    ⭐
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => handleDelete(receipt)}
                    title="Delete"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-receipts">
            <p>No receipts uploaded yet</p>
            <p className="hint">Upload receipts to keep track of your expenses</p>
          </div>
        )}
      </Card>

      {showGallery && (
        <ReceiptGallery
          receipts={existingReceipts}
          onClose={() => setShowGallery(false)}
          onDelete={handleDelete}
          onSetPrimary={handleSetPrimary}
        />
      )}
    </div>
  );
};

const ReceiptGallery = ({ receipts, onClose, onDelete, onSetPrimary }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % receipts.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + receipts.length) % receipts.length);
  };

  const currentReceipt = receipts[currentIndex];
  const isImage = currentReceipt.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <Modal
      isOpen={true}
      title={`Receipt ${currentIndex + 1} of ${receipts.length}`}
      onClose={onClose}
      size="large"
    >
      <div className="receipt-gallery-modal">
        <div className="gallery-content">
          {isImage ? (
            <img src={currentReceipt} alt="Receipt" className="gallery-image" />
          ) : (
            <div className="gallery-pdf">
              <iframe
                src={currentReceipt}
                title="Receipt PDF"
                className="pdf-iframe"
              />
            </div>
          )}
        </div>

        <div className="gallery-controls">
          <Button onClick={prevImage} disabled={receipts.length <= 1}>
            ← Previous
          </Button>
          <span className="gallery-counter">
            {currentIndex + 1} / {receipts.length}
          </span>
          <Button onClick={nextImage} disabled={receipts.length <= 1}>
            Next →
          </Button>
        </div>

        <div className="gallery-actions">
          <Button variant="secondary" onClick={() => onSetPrimary(currentReceipt)}>
            Set as Primary
          </Button>
          <Button variant="danger" onClick={() => onDelete(currentReceipt)}>
            Delete
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReceiptUpload;