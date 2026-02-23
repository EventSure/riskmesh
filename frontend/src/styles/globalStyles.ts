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
  .sub{color:var(--sub);}
  body::after{content:'';position:fixed;inset:0;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:.5;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}

  /* External library overrides */
  .wallet-adapter-button{font-family:'Space Grotesk',sans-serif!important;}
`;
