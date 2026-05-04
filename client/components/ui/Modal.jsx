import { useState } from 'react';
import Button from './Button.jsx';

/**
 * Modal component for dialogs and overlays
 * @param {object} props - Modal props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {string} props.title - Modal title
 * @param {string} props.subtitle - Modal subtitle
 * @param {function} props.onClose - Close handler
 * @param {React.ReactNode} props.children - Modal content
 */
export default function Modal({ isOpen, title, subtitle, onClose, children }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`modal-overlay ${isClosing ? 'closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleClose}
    >
      <div
        className="modal-shell"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            aria-label="Close modal"
          >
            Close
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}