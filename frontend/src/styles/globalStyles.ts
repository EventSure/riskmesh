import { css } from '@emotion/react';

export const globalStyles = css`
  :root {
    --bg: #0B1120;
    --card: #111827;
    --card2: #0d1626;
    --primary: #9945FF;
    --accent: #14F195;
    --danger: #EF4444;
    --success: #22C55E;
    --warning: #F59E0B;
    --text: #F8FAFC;
    --sub: #94A3B8;
    --border: #1F2937;
    --border2: #263045;
    --gp: rgba(153,69,255,0.25);
    --ga: rgba(20,241,149,0.25);
    --gd: rgba(239,68,68,0.25);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html{font-size:14px;}
  body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;}
  .mono{font-family:'DM Mono',monospace;}
  .sub{color:var(--sub);}
  body::after{content:'';position:fixed;inset:0;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:.5;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}
  .header{background:rgba(11,17,32,.97);border-bottom:1px solid var(--border);padding:0 20px;position:sticky;top:0;z-index:100;backdrop-filter:blur(16px);}
  .header-top{display:flex;align-items:center;justify-content:space-between;padding:12px 0 10px;border-bottom:1px solid var(--border);}
  .logo{display:flex;align-items:center;gap:10px;}
  .logo-mark{width:32px;height:32px;background:linear-gradient(135deg,var(--primary),var(--accent));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;box-shadow:0 0 20px var(--gp);}
  .logo-name{font-size:16px;font-weight:700;letter-spacing:.03em;}
  .logo-sub{font-size:10px;color:var(--sub);letter-spacing:.1em;text-transform:uppercase;margin-top:1px;}
  .header-right{display:flex;align-items:center;gap:10px;}
  .role-select{background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;padding:6px 28px 6px 10px;border-radius:8px;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;}
  .role-badge{padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-family:'DM Mono',monospace;}
  .badge-live{background:rgba(20,241,149,.1);color:var(--accent);border:1px solid rgba(20,241,149,.3);animation:blink 2s infinite;}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
  .net-pill{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:11px;font-family:'DM Mono',monospace;}
  .net-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent);animation:blink 2s infinite;}
  .kpi-bar{display:flex;padding:8px 0;}
  .kpi{flex:1;padding:6px 16px;border-right:1px solid var(--border);}
  .kpi:first-child{padding-left:0;}
  .kpi:last-child{border-right:none;}
  .kpi-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);margin-bottom:2px;}
  .kpi-val{font-family:'DM Mono',monospace;font-size:16px;font-weight:500;transition:color .4s;}
  .kpi-val.flash{color:var(--accent);}
  .main{display:grid;grid-template-columns:300px 1fr 300px;gap:0;height:calc(100vh - 106px);min-height:600px;}
  .col{overflow-y:auto;border-right:1px solid var(--border);padding:14px;}
  .col:last-child{border-right:none;}
  .card{background:var(--card);border:1px solid var(--border);border-radius:16px;margin-bottom:12px;overflow:hidden;}
  .card-hdr{padding:11px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);}
  .card-body{padding:14px;}
  .fg{margin-bottom:10px;}
  .fl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--sub);margin-bottom:4px;display:block;}
  .fi{width:100%;padding:8px 10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;outline:none;transition:border-color .2s;}
  .fi:focus{border-color:var(--primary);}
  .fsel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-color:var(--card2);padding-right:28px;}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .srow{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--card2);border-radius:8px;margin-bottom:5px;border:1px solid var(--border);}
  .srow-lbl{font-size:11px;color:var(--sub);}
  .srow-val{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--accent);}
  .btn{padding:8px 14px;border-radius:8px;border:none;font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px;}
  .btn-p{background:var(--primary);color:#fff;box-shadow:0 0 14px var(--gp);}
  .btn-p:hover{box-shadow:0 0 24px rgba(153,69,255,.5);transform:translateY(-1px);}
  .btn-a{background:var(--accent);color:#0B1120;font-weight:700;}
  .btn-a:hover{box-shadow:0 0 20px var(--ga);transform:translateY(-1px);}
  .btn-o{background:transparent;color:var(--text);border:1px solid var(--border);}
  .btn-o:hover{border-color:var(--primary);color:var(--primary);}
  .btn-d{background:var(--danger);color:#fff;}
  .btn-w{background:var(--warning);color:#0B1120;}
  .btn-sm{padding:5px 10px;font-size:11px;border-radius:6px;}
  .btn-full{width:100%;justify-content:center;}
  .btn:disabled{opacity:.3;cursor:not-allowed;transform:none!important;box-shadow:none!important;}
  .sm-wrap{padding:16px 14px 10px;overflow-x:auto;}
  .sm-track{display:flex;align-items:flex-start;gap:0;min-width:560px;}
  .sm-node{display:flex;flex-direction:column;align-items:center;flex:1;gap:6px;}
  .sm-circle{width:36px;height:36px;border-radius:50%;border:2px solid var(--border);background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--sub);transition:all .5s;z-index:2;position:relative;}
  .sm-circle.done{border-color:var(--success);background:rgba(34,197,94,.12);color:var(--success);box-shadow:0 0 12px rgba(34,197,94,.3);}
  .sm-circle.cur{border-color:var(--primary);background:rgba(153,69,255,.18);color:var(--primary);box-shadow:0 0 18px var(--gp);animation:pulse-p 2s infinite;}
  .sm-circle.claimable{border-color:var(--warning);background:rgba(245,158,11,.18);color:var(--warning);box-shadow:0 0 18px rgba(245,158,11,.3);animation:pulse-w 1.5s infinite;}
  .sm-circle.settled{border-color:var(--accent);background:rgba(20,241,149,.12);color:var(--accent);box-shadow:0 0 18px var(--ga);}
  .sm-circle.expired{border-color:var(--sub);background:rgba(148,163,184,.08);color:var(--sub);}
  @keyframes pulse-p{0%,100%{box-shadow:0 0 18px var(--gp)}50%{box-shadow:0 0 32px rgba(153,69,255,.6)}}
  @keyframes pulse-w{0%,100%{box-shadow:0 0 18px rgba(245,158,11,.3)}50%{box-shadow:0 0 32px rgba(245,158,11,.6)}}
  .sm-lbl{font-size:9px;font-weight:600;letter-spacing:.04em;color:var(--sub);text-align:center;transition:color .4s;}
  .sm-lbl.cur{color:var(--primary);}
  .sm-lbl.done{color:var(--success);}
  .sm-lbl.claimable{color:var(--warning);}
  .sm-lbl.settled{color:var(--accent);}
  .sm-conn{flex:1;height:2px;background:var(--border);margin-top:17px;z-index:1;transition:background .5s;min-width:8px;}
  .sm-conn.done{background:var(--success);}
  .step-item{background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;transition:all .3s;}
  .step-item.active{border-color:var(--primary);background:rgba(153,69,255,.06);}
  .step-item.done-step{border-color:var(--success);background:rgba(34,197,94,.05);}
  .step-item.error-step{border-color:var(--danger);}
  .step-hdr{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
  .step-num{width:20px;height:20px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
  .step-num.done-n{background:var(--success);color:#0B1120;}
  .step-num.cur-n{background:var(--primary);color:#fff;}
  .step-name{font-size:12px;font-weight:700;font-family:'DM Mono',monospace;}
  .step-role{font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;font-family:'DM Mono',monospace;}
  .step-detail{font-size:10px;color:var(--sub);line-height:1.6;padding-left:28px;}
  .step-checks{margin-top:6px;padding-left:28px;}
  .check-item{font-size:10px;display:flex;align-items:center;gap:5px;margin-bottom:2px;}
  .check-ok{color:var(--success);}
  .check-fail{color:var(--danger);}
  .pt-row{background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;transition:border-color .3s;}
  .pt-row.committed{border-color:rgba(153,69,255,.35);}
  .pt-row.funded{border-color:rgba(20,241,149,.35);}
  .pt-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;}
  .pt-name{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;}
  .pt-dot{width:7px;height:7px;border-radius:50%;}
  .pt-chip{font-size:9px;padding:2px 7px;border-radius:5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-family:'DM Mono',monospace;}
  .progwrap{height:5px;background:var(--card2);border-radius:3px;overflow:hidden;margin-bottom:3px;}
  .progfill{height:100%;border-radius:3px;transition:width .8s cubic-bezier(.34,1.56,.64,1);}
  .prog-lbl{display:flex;justify-content:space-between;font-size:9px;color:var(--sub);font-family:'DM Mono',monospace;margin-bottom:3px;}
  .inspector-account{background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;}
  .ia-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
  .ia-icon{width:26px;height:26px;border-radius:6px;background:rgba(153,69,255,.15);border:1px solid rgba(153,69,255,.3);display:flex;align-items:center;justify-content:center;font-size:11px;}
  .ia-name{font-size:11px;font-weight:700;font-family:'DM Mono',monospace;}
  .ia-pda{font-size:9px;color:var(--sub);font-family:'DM Mono',monospace;margin-top:1px;word-break:break-all;}
  .ia-field{display:flex;justify-content:space-between;align-items:flex-start;padding:3px 0;border-bottom:1px solid rgba(31,41,55,.5);}
  .ia-field:last-child{border-bottom:none;}
  .ia-key{font-size:10px;color:var(--sub);font-family:'DM Mono',monospace;flex-shrink:0;margin-right:8px;}
  .ia-val{font-size:10px;font-family:'DM Mono',monospace;text-align:right;word-break:break-all;color:var(--text);}
  .ia-val.accent{color:var(--accent);}
  .ia-val.warn{color:var(--warning);}
  .ia-val.danger{color:var(--danger);}
  .pda-seed{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}
  .seed-chip{padding:2px 7px;background:rgba(153,69,255,.1);border:1px solid rgba(153,69,255,.25);border-radius:4px;font-size:9px;font-family:'DM Mono',monospace;color:var(--primary);}
  .bottom-section{border-top:1px solid var(--border);height:220px;display:flex;gap:0;}
  .log-col{flex:1;overflow-y:auto;padding:12px 14px;border-right:1px solid var(--border);}
  .log-col:last-child{border-right:none;}
  .log-entry{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(31,41,55,.4);animation:log-in .3s ease;}
  @keyframes log-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
  .log-dot{width:5px;height:5px;border-radius:50%;margin-top:5px;flex-shrink:0;}
  .log-time{font-family:'DM Mono',monospace;font-size:9px;color:var(--sub);white-space:nowrap;padding-top:1px;}
  .log-body{font-size:11px;color:var(--text);}
  .log-detail{font-size:10px;color:var(--sub);margin-top:1px;}
  .error-box{padding:10px 12px;border-radius:8px;border:1px solid var(--danger);background:rgba(239,68,68,.08);margin-bottom:12px;display:none;}
  .error-code{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--danger);}
  .error-msg{font-size:11px;color:var(--sub);margin-top:2px;}
  .success-box{padding:10px 12px;border-radius:8px;border:1px solid var(--success);background:rgba(34,197,94,.08);margin-bottom:12px;display:none;}
  .cmp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
  .cmp-panel{border-radius:10px;padding:12px;border:1px solid;}
  .cmp-trad{border-color:rgba(148,163,184,.25);background:rgba(148,163,184,.04);}
  .cmp-chain{border-color:rgba(153,69,255,.35);background:rgba(153,69,255,.07);}
  .cmp-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;}
  .cmp-trad .cmp-title{color:var(--sub);}
  .cmp-chain .cmp-title{color:var(--primary);}
  .cmp-item{font-size:10px;margin-bottom:4px;display:flex;align-items:center;gap:5px;}
  .cmp-item::before{content:'';width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0;}
  .cmp-trad .cmp-item{color:var(--danger);}
  .cmp-chain .cmp-item{color:var(--success);}
  .toast{position:fixed;bottom:20px;right:20px;z-index:600;padding:11px 16px;border-radius:10px;font-size:12px;font-weight:500;box-shadow:0 8px 28px rgba(0,0,0,.35);animation:toast-in .4s cubic-bezier(.34,1.56,.64,1);display:none;align-items:center;gap:8px;max-width:320px;}
  .toast.show{display:flex;}
  .toast.s{background:rgba(34,197,94,.16);border:1px solid rgba(34,197,94,.35);color:var(--success);}
  .toast.w{background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.35);color:var(--warning);}
  .toast.i{background:rgba(153,69,255,.16);border:1px solid rgba(153,69,255,.35);color:var(--primary);}
  .toast.d{background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.35);color:var(--danger);}
  @keyframes toast-in{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
  .div-line{height:1px;background:var(--border);margin:10px 0;}
  .token-toggle{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(153,69,255,.08);border:1px solid rgba(153,69,255,.2);border-radius:8px;cursor:pointer;margin-bottom:10px;}
  .toggle-sw{width:32px;height:18px;border-radius:9px;background:var(--border);position:relative;transition:background .3s;flex-shrink:0;}
  .toggle-sw::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .3s;}
  .toggle-sw.on{background:var(--primary);}
  .toggle-sw.on::after{transform:translateX(14px);}
  .token-lbl{font-size:11px;font-weight:600;}
  .token-hint{font-size:9px;color:var(--sub);margin-top:1px;}
  .tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-family:'DM Mono',monospace;}
  .tag-p{background:rgba(153,69,255,.12);color:var(--primary);border:1px solid rgba(153,69,255,.3);}
  .tag-a{background:rgba(20,241,149,.12);color:var(--accent);border:1px solid rgba(20,241,149,.3);}
  .tag-w{background:rgba(245,158,11,.12);color:var(--warning);border:1px solid rgba(245,158,11,.3);}
  .tag-d{background:rgba(239,68,68,.12);color:var(--danger);border:1px solid rgba(239,68,68,.3);}
  .tag-s{background:rgba(148,163,184,.1);color:var(--sub);border:1px solid rgba(148,163,184,.2);}
  .wallet-adapter-button{font-family:'Space Grotesk',sans-serif!important;}
`;
