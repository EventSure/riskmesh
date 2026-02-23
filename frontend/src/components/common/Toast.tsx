import { useState, useCallback, createContext, useContext, useRef } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

type ToastType = 's' | 'w' | 'i' | 'd';

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const ToastWrap = styled.div<{ type: ToastType; visible: boolean }>`
  position: fixed;
  bottom: 18px;
  right: 18px;
  z-index: 600;
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.35);
  animation: ${slideIn} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: ${p => (p.visible ? 'flex' : 'none')};
  align-items: center;
  gap: 7px;
  max-width: 300px;

  ${p => p.type === 's' && `background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.35);color:var(--success);`}
  ${p => p.type === 'w' && `background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);color:var(--warning);`}
  ${p => p.type === 'i' && `background:rgba(153,69,255,.15);border:1px solid rgba(153,69,255,.35);color:var(--primary);`}
  ${p => p.type === 'd' && `background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);color:var(--danger);`}
`;

interface ToastContextValue {
  toast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<ToastType>('i');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string, t: ToastType = 'i') => {
    setMsg(m);
    setType(t);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastWrap type={type} visible={visible}>{msg}</ToastWrap>
    </ToastContext.Provider>
  );
}
