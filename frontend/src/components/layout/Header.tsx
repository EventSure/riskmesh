import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Header() {
  return (
    <div className="header">
      <div className="header-top">
        <div className="logo">
          <div className="logo-mark">OP</div>
          <div>
            <div className="logo-name">OpenParametric Protocol</div>
            <div className="logo-sub">On-chain Parametric Insurance · Solana Devnet</div>
          </div>
        </div>
        <div className="header-right">
          <div className="net-pill">
            <div className="net-dot"></div>
            devnet
          </div>
          <select className="role-select">
            <option value="leader">👑 Leader (Insurer)</option>
            <option value="partA">🔵 Participant A</option>
            <option value="partB">🟡 Participant B</option>
            <option value="operator">🛡️ Operator/Admin</option>
          </select>
          <span className="role-badge badge-live">● LIVE DEMO</span>
          <WalletMultiButton />
        </div>
      </div>
      <div className="kpi-bar">
        <div className="kpi">
          <div className="kpi-lbl">Active Policies</div>
          <div className="kpi-val mono">0</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total Locked Capital</div>
          <div className="kpi-val mono">0</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total Exposure</div>
          <div className="kpi-val mono">0</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total Paid Out</div>
          <div className="kpi-val mono">0</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pool Health</div>
          <div className="kpi-val mono">—</div>
        </div>
      </div>
    </div>
  );
}
