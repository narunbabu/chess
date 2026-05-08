import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';

const AmbassadorPoster = () => {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const shareUrl = code ? `https://chess99.com/r/${code}` : '';

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, {
      width: 1024,
      margin: 1,
      color: { dark: '#262421', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl).catch(() => {});
  }, [shareUrl]);

  return (
    <div className="poster-root">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        .poster-root {
          background: #ffffff;
          color: #262421;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .poster {
          width: 210mm;
          max-width: 100%;
          padding: 18mm 14mm;
          background: #fff;
          border: 2px solid #262421;
          box-sizing: border-box;
          text-align: center;
        }
        .poster h1 {
          font-size: 56px;
          margin: 0 0 4px;
          letter-spacing: -1px;
          color: #262421;
        }
        .poster .accent { color: #81b64c; }
        .poster .tag {
          font-size: 22px;
          color: #555;
          margin: 0 0 24px;
        }
        .poster .qr {
          margin: 18px auto;
          width: 280px;
          height: 280px;
          padding: 12px;
          background: #fff;
          border: 4px solid #262421;
          border-radius: 12px;
        }
        .poster .qr img { width: 100%; height: 100%; display: block; }
        .poster .url {
          font-family: 'Courier New', monospace;
          font-size: 28px;
          color: #262421;
          margin: 12px 0 6px;
          font-weight: bold;
        }
        .poster .scan {
          font-size: 18px;
          color: #555;
          margin-bottom: 24px;
        }
        .poster .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 18px;
          text-align: left;
        }
        .poster .feature {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
        }
        .poster .feature b { display: block; color: #81b64c; font-size: 16px; margin-bottom: 2px; }
        .poster .footer {
          margin-top: 22px;
          font-size: 13px;
          color: #888;
          border-top: 1px solid #eee;
          padding-top: 12px;
        }
        .poster .actions {
          margin-top: 16px;
        }
        .print-btn {
          position: fixed;
          top: 16px;
          right: 16px;
          background: #81b64c;
          color: #fff;
          border: none;
          padding: 10px 20px;
          font-size: 14px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }
        @media print {
          .print-btn { display: none; }
          .poster-root { padding: 0; min-height: auto; }
          .poster { border: none; padding: 0; }
        }
      `}</style>

      <button className="print-btn" onClick={() => window.print()}>Print / Save as PDF</button>

      <div className="poster">
        <h1>Chess<span className="accent">99</span></h1>
        <p className="tag">India's Chess Platform — Play. Learn. Improve.</p>

        <div className="qr">
          {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" /> : null}
        </div>

        <div className="url">chess99.com/r/{code}</div>
        <div className="scan">Scan the QR or visit the link to join</div>

        <div className="features">
          <div className="feature"><b>Rated Games</b>Play opponents at your level. ELO tracking, full game review.</div>
          <div className="feature"><b>Tactical Trainer</b>5 stages, 2,000+ puzzles. Built for Indian students.</div>
          <div className="feature"><b>Daily Practice</b>Streaks, leaderboards, lessons. No ads, clean UI.</div>
        </div>

        <div className="footer">
          Free signup · Web + Android + iOS · Hindi / English / Telugu support
        </div>
      </div>
    </div>
  );
};

export default AmbassadorPoster;
