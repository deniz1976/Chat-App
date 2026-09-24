import { Dialog } from './Dialog';

export const Lightbox = ({ url, onClose }: { url: string; onClose(): void }) => (
  <Dialog title="Image" onClose={onClose} className="lightbox">
    <button type="button" className="close" onClick={onClose} aria-label="Close image">
      ✕
    </button>
    <img src={url} alt="Shared image" />
  </Dialog>
);
