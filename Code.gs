/**
 * Code.gs - Main Server Entry Point
 * This file acts as the control center for your Google Apps Script Web App. 
 * It handles loading the frontend web page and bridging communication between the browser and your spreadsheet data.
 */

/**
 * doGet() is a special, mandatory Google Apps Script function. 
 * When a user visits your deployed Web App URL, Google automatically runs this function first.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index') // Loads 'index.html' as a template
    .evaluate() // Evaluates any embedded server scripts inside the HTML
    .setTitle(CONFIG.APP_TITLE) // Sets the browser tab title using our CONFIG file
    .addMetaTag('viewport', 'width=device-width, initial-scale=1') // Makes the dashboard mobile/tablet responsive
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Allows the app to be embedded or framed if needed
}

/**
 * Helper function used inside HTML files (like index.html) to include other files 
 * (like CSS stylesheets or JavaScript snippets) via template tags like <?!= include('Stylesheet'); ?>.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Server endpoint called by the client-side browser code (via google.script.run).
 * When someone opens or refreshes the dashboard, the frontend calls this function to get all the data.
 */
function getDashboardData() {
  try {
    // Calls the main data-fetching function from DataService.gs
    return fetchDashboardData();
  } catch (e) {
    // If something goes wrong, catch the error and return a clean, descriptive message
    throw new Error('Failed to load dashboard data: ' + e.message);
  }
}

/**
 * Call this function (manually or via an automated trigger) whenever your spreadsheet data 
 * updates to clear out the old cache immediately so users see fresh data right away.
 */
function clearDashboardCache() {
  CacheService.getScriptCache().remove(CONFIG.CACHE_KEY_DASHBOARD);
}
