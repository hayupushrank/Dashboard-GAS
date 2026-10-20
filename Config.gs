/**
 * Config.gs - Centralized Configuration File
 * Contains global constants, Spreadsheet IDs, sheet names, and cache settings.
 * Having a single config file means if a sheet name or ID changes, you only 
 * need to update it here instead of searching through all your code files!
 */

var CONFIG = {
  // The unique identifier of your Google Spreadsheet 
  // (You can find this string in the middle of your spreadsheet's browser URL: /d/YOUR_ID/edit)
  SPREADSHEET_ID: '1lI2vBqDWttzycGt_mpl0dEAHdvAkz2VREuKSIqPny0I',
  
  // A nested dictionary holding the exact names of the tabs (worksheets) inside your spreadsheet
  SHEETS: {
    PIVOT: 'PIVOT',
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND',
    REQUEST: 'REQUEST',
    PL_IMPORT: 'PLImport'
  },
  
  // How long data is saved temporarily in memory before reloading from the sheet (300 seconds = 5 minutes)
  // Caching speeds up the dashboard so it doesn't have to re-read the sheet every single time a user clicks.
  CACHE_DURATION_SEC: 300, 
  
  // The unique label (key) used to store and look up the cached dashboard data in Google Apps Script storage
  CACHE_KEY_DASHBOARD: 'WAREHOUSE_DASHBOARD_DATA',
  
  // The title of the application (displayed on the dashboard UI)
  APP_TITLE: 'CJ Logistics Operations Dashboard',
  
  // The version tag of your code (useful for debugging and confirming updates have rolled out)
  APP_VERSION: 'v0.1.0-beta1'
};
