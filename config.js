/*
 * THE ONLY FILE YOU EDIT BETWEEN ELECTIONS.
 * Used by the pages (browser) and by the GitHub Action (Node).
 */
const CONFIG = {
  // Where the GitHub Action scrapes results from
  electionUrl: 'https://votes26.bechirot.gov.il/',

  // Where pages read data from. If GitHub Pages lags behind your commits,
  // switch to: 'https://raw.githubusercontent.com/USER/REPO/main/data/data.json'
  dataUrl: 'data/data.json',

  totalSeats: 120,
  thresholdPercent: 3.25,

  // Slider starts to the left of this party's right edge (ballot letter). Default: end of the right-wing bloc.
  defaultPointerAfter: 'יז',

  // Parties not listed below land in this bloc
  defaultBloc: 'lapid',

  // Surplus-vote agreements, as pairs of ballot letters
  agreements: [
    ['פה', 'כן'],
    ['אמת', 'מרצ'],
    ['שס', 'ג'],
    ['מחל', 'ט'],
    ['נק', 'ף'],
  ],

  // Blocs, in the order they appear in the stats charts
  blocs: [
    { id: 'lapid',     label: 'גוש לפיד',  color: 'rgb(255, 99, 132)' },
    { id: 'arabs',     label: 'ערבים',     color: 'rgb(255, 205, 86)' },
    { id: 'netanyahu', label: 'גוש נתניהו', color: 'rgb(54, 162, 235)' },
  ],

  // char  = ballot letter(s) exactly as shown on the elections site
  // key   = one unique Latin letter, used in share links
  // name  = short display name
  // Array order = default order on the bar
  parties: [
    { char: 'ט',   key: 'Z', name: 'הציונות הדתית',  color: '#D32F2F', bloc: 'netanyahu' },
    { char: 'שס',  key: 'S', name: 'ש"ס',           color: '#303F9F', bloc: 'netanyahu' },
    { char: 'ג',   key: 'G', name: 'יהדות התורה',    color: '#388E3C', bloc: 'netanyahu' },
    { char: 'ב',   key: 'J', name: 'הבית היהודי',    color: '#F57C00', bloc: 'netanyahu' },
    { char: 'מחל', key: 'L', name: 'הליכוד',         color: '#1976D2', bloc: 'netanyahu' },
    { char: 'צ',   key: 'F', name: 'צעירים בוערים',  color: '#C2185B', bloc: 'netanyahu' },
    { char: 'אצ',  key: 'C', name: 'חופש כלכלי',     color: '#AFB42B', bloc: 'netanyahu' },
    { char: 'יז',  key: 'K', name: 'הכלכלית',        color: '#FFEB3B', bloc: 'netanyahu' },
    { char: 'כן',  key: 'B', name: 'המחנה הממלכתי',  color: '#00796B', bloc: 'lapid' },
    { char: 'פה',  key: 'Y', name: 'יש עתיד',        color: '#512DA8', bloc: 'lapid' },
    { char: 'ל',   key: 'I', name: 'ישראל ביתנו',    color: '#455A64', bloc: 'lapid' },
    { char: 'אמת', key: 'W', name: 'העבודה',         color: '#9E9E9E', bloc: 'lapid' },
    { char: 'מרצ', key: 'M', name: 'מרצ',            color: '#5D4037', bloc: 'lapid' },
    { char: 'עם',  key: 'R', name: 'רעם',            color: '#8BC34A', bloc: 'arabs' },
    { char: 'ום',  key: 'H', name: 'חדש תעל',        color: '#9C27B0', bloc: 'arabs' },
    { char: 'ד',   key: 'A', name: 'בלד',            color: '#E040FB', bloc: 'arabs' },
  ],
};

if (typeof module !== 'undefined') module.exports = CONFIG;
