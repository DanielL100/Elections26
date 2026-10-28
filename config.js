/*
 * CONFIGURATION FOR KNESSET 26 ELECTIONS
 * Used by browser pages and by GitHub Action Node scraper.
 */
const CONFIG = {
  // Scraper target URL
  electionUrl: 'https://votes26.bechirot.gov.il/',

  // Data path
  dataUrl: 'data/data.json',

  totalSeats: 120,
  thresholdPercent: 3.25,

  // Slider default position (after 'מחל' - Likud / end of Netanyahu bloc)
  defaultPointerAfter: 'מחל',

  // Default fallback bloc for unlisted parties
  defaultBloc: 'eizenkot',

  // Surplus-vote agreements for Knesset 26
  agreements: [
    ['דרך', 'אמת'], // ישר! - הדמוקרטים
    ['רק', 'ל'],    // ביחד - ישראל ביתנו
    ['מחל', 'ט'],   // הליכוד - הציונות הדתית
    ['שס', 'ג'],    // ש"ס - יהדות התורה
    ['עם', 'ודם'],  // רע"ם - חד"ש-תע"ל (הרשימה המשותפת)
  ],

  // Blocs configuration
  blocs: [
    { id: 'eizenkot',  label: 'גוש איזנקוט', color: 'rgb(255, 99, 132)' },
    { id: 'arabs',     label: 'ערבים',       color: 'rgb(255, 205, 86)' },
    { id: 'netanyahu', label: 'גוש נתניהו',   color: 'rgb(54, 162, 235)' },
  ],

  // Registered parties for Election 26
  parties: [
    { char: 'ני',   key: 'N', name: 'נעם', color: '#7B1FA2', bloc: 'netanyahu' },
    { char: 'ב',    key: 'K', name: 'עוצמה יהודית', color: '#C2185B', bloc: 'netanyahu' },
    { char: 'ט',    key: 'Z', name: 'הציונות הדתית', color: '#D32F2F', bloc: 'netanyahu' },
    { char: 'ך',    key: 'V', name: 'עמך ישראל (עופר וינטר)', color: '#FF9800', bloc: 'netanyahu' },
    { char: 'מחל',  key: 'L', name: 'הליכוד', color: '#1976D2', bloc: 'netanyahu' },
    { char: 'שס',   key: 'S', name: 'ש"ס', color: '#303F9F', bloc: 'netanyahu' },
    { char: 'ג',    key: 'G', name: 'יהדות התורה', color: '#388E3C', bloc: 'netanyahu' },
    
    { char: 'רק',   key: 'B', name: 'ביחד (בנט)', color: '#F57C00', bloc: 'eizenkot' },
    { char: 'דרך',  key: 'E', name: 'ישר! (איזנקוט)', color: '#00796B', bloc: 'eizenkot' },
    { char: 'די',   key: 'M', name: 'המילואימניקים', color: '#FFEB3B', bloc: 'eizenkot' },
    { char: 'ל',    key: 'I', name: 'ישראל ביתנו', color: '#455A64', bloc: 'eizenkot' },
    { char: 'אמת',  key: 'D', name: 'הדמוקרטים', color: '#E53935', bloc: 'eizenkot' },
    
    { char: 'עם',   key: 'R', name: 'רע"ם', color: '#8BC34A', bloc: 'arabs' },
    { char: 'ודם',  key: 'H', name: 'חד"ש-תע"ל / הרשימה המשותפת', color: '#9C27B0', bloc: 'arabs' },
  ],
};

if (typeof module !== 'undefined') module.exports = CONFIG;
