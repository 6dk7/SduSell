import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

// Toast + one shared modal <dialog>.
export function UIProvider({ children }) {
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef();
  const [dialog, setDialog] = useState(null); // { content, onClose }
  const dialogEl = useRef(null);

  const toast = useCallback((message) => {
    setToastMsg(message);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 3200);
  }, []);

  const openDialog = useCallback((content, onClose) => setDialog({ content, onClose }), []);
  const closeDialog = useCallback(() => dialogEl.current?.close(), []);

  // Resolves true if the person confirms, false for cancel / Escape / backdrop.
  const confirmAction = useCallback(({ title, text, confirmLabel }) => new Promise((resolve) => {
    let result = false;
    openDialog(
      <div className="dialog-body">
        <h2 className="dialog-title">{title}</h2>
        <p>{text}</p>
        <div className="dialog-actions">
          <button className="btn btn-quiet" type="button" onClick={() => dialogEl.current?.close()}>Cancel</button>
          <button className="btn btn-danger" type="button" onClick={() => { result = true; dialogEl.current?.close(); }}>{confirmLabel}</button>
        </div>
      </div>,
      () => resolve(result),
    );
  }), [openDialog]);

  useEffect(() => {
    const el = dialogEl.current;
    if (dialog && el && !el.open) el.showModal();
  }, [dialog]);

  const onDialogClose = () => {
    const done = dialog?.onClose;
    setDialog(null);
    if (done) done();
  };

  const value = useMemo(() => ({ toast, openDialog, closeDialog, confirmAction }), [toast, openDialog, closeDialog, confirmAction]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <dialog id="dialog" ref={dialogEl} onClose={onDialogClose}
        onClick={(e) => { if (e.target === dialogEl.current) dialogEl.current.close(); }}>
        {dialog?.content}
      </dialog>
      <div id="toast" role="status" aria-live="polite" className={toastShow ? 'show' : ''}>{toastMsg}</div>
    </UIContext.Provider>
  );
}
