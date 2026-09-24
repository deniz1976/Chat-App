import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  onClose(): void;
  className?: string;
  children: ReactNode;
}

export const Dialog = ({ title, onClose, className = '', children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      <div className="dialog-inner">{children}</div>
    </dialog>
  );
};

export const DialogHeader = ({ title, onClose }: { title: string; onClose(): void }) => (
  <div className="dialog-head">
    <h2>{title}</h2>
    <button type="button" className="close" onClick={onClose} aria-label="Close">
      ✕
    </button>
  </div>
);
