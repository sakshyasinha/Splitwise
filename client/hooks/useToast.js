import useToastStore from '../store/toast.store.js';

export default function useToast() {
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  return {
    success: (message, duration = 3000) => addToast(message, 'success', duration),
    error: (message, duration = 5000) => addToast(message, 'error', duration),
    info: (message, duration = 3000) => addToast(message, 'info', duration),
    warning: (message, duration = 4000) => addToast(message, 'warning', duration),
    remove: removeToast,
  };
}
