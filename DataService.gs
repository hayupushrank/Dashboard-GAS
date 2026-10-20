/**
 * DataService.gs - Handles reading and parsing Spreadsheet data
 */

/**
 * Reads a quick, specific snapshot of data from the PIVOT sheet.
 * Limiting the selection to columns A to N prevents reading thousands of empty grid cells.
 */
function getRawPivotData() {
  // 1. Open the Google Sheet using the ID configured in the CONFIG object
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // 2. Fetch the specific worksheet named in CONFIG.SHEETS.PIVOT
  var sheet = ss.getSheetByName(CONFIG.SHEETS.PIVOT);
  
  // 3. Throw an error if the worksheet cannot be found
  if (!sheet) {
    throw new Error('Sheet "' + CONFIG.SHEETS.PIVOT + '" not found.');
  }

  // 4. Check the last row that contains data
  var lastRow = sheet.getLastRow();
  
  // If there are less than 2 rows (i.e., only headers or empty), return an empty array
  if (lastRow < 2) return [];

  // 5. Read ONLY Columns A to N (14 columns) down to the last populated row
  // getRange(startRow, startColumn, numRows, numColumns)
  return sheet.getRange(1, 1, lastRow, 14).getValues();
}

/**
 * Main service method to process all 4 data tables from the PIVOT sheet and build the dashboard payload.
 */
function fetchDashboardData() {
  // 1. Open the Spreadsheet and target sheet
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.PIVOT);
  
  if (!sheet) {
    throw new Error('Sheet "' + CONFIG.SHEETS.PIVOT + '" not found.');
  }

  // 2. Determine grid boundaries
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  // Return a default empty structure if there's no data below headers
  if (lastRow < 2) return getEmptyPayload();

  // 3. Read the full populated range into a 2D JavaScript Array ( rows[ columns[] ] )
  var rawValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  
  // 4. Extract Row 1 (header names), trim whitespace, and convert to lowercase for easy matching
  var headerRow = rawValues[0].map(function(h) { 
    return String(h).trim().toLowerCase(); 
  });

  // 5. Map header names to their 0-based column index position
  // Some pivot sheets reuse column titles (like 'date' or 'countunique of sku'), 
  // so we find the 1st, 2nd, or 3rd occurrence depending on the target table.
  var colIdx = {
    t1Loc: headerRow.indexOf('location'),
    t1Containers: headerRow.indexOf('countunique of container'),
    t1Skus: headerRow.indexOf('countunique of sku'),
    
    // Finds the first occurrence of 'date' for Table 2, second for Table 3, etc.
    t2Date: findHeaderOccurrence(headerRow, 'date', 1),
    t2Container: headerRow.indexOf('container'),
    t2Skus: findHeaderOccurrence(headerRow, 'countunique of sku', 2),

    t3Date: findHeaderOccurrence(headerRow, 'date', 2),
    t3Deliveries: headerRow.indexOf('countunique of delivery order'),

    t4Date: headerRow.indexOf('request date'),
    t4Containers: findHeaderOccurrence(headerRow, 'countunique of container', 2),
    t4Skus: findHeaderOccurrence(headerRow, 'countunique of sku', 3)
  };

  // Arrays to hold processed data objects for each section
  var table1Location = [];
  var zoneMap = {}; // Helper object to accumulate container/SKU totals per zone
  var table2Inbound = [];
  var table3Outbound = [];
  var table4Request = [];

  // 6. Loop over all data rows (starting at index 1 to skip the header row)
  for (var i = 1; i < rawValues.length; i++) {
    var row = rawValues[i];

    // --- Table 1 Parsing (Location / Zone metrics) ---
    if (colIdx.t1Loc !== -1 && row[colIdx.t1Loc]) {
      var rawLoc = String(row[colIdx.t1Loc]).trim();
      
      // Ensure row is non-empty and not a repeated header string
      if (rawLoc !== '' && rawLoc.toLowerCase() !== 'location') {
        var containers = parseNumber(row[colIdx.t1Containers]);
        var skus = parseNumber(row[colIdx.t1Skus]);

        // Aggregate counts into zone categories (e.g., "A1-01" -> "Zone A")
        var zoneKey = getZonePrefix(rawLoc);
        if (!zoneMap[zoneKey]) {
          zoneMap[zoneKey] = { location: zoneKey, containers: 0, skus: 0 };
        }
        zoneMap[zoneKey].containers += containers;
        zoneMap[zoneKey].skus += skus;

        // Push detailed row into Table 1 list
        table1Location.push({ location: rawLoc, containers: containers, skus: skus });
      }
    }

    // --- Table 2 Parsing (Inbound metrics) ---
    if (colIdx.t2Date !== -1 && row[colIdx.t2Date]) {
      var d2 = row[colIdx.t2Date];
      if (d2 && String(d2).toLowerCase() !== 'date') {
        table2Inbound.push({
          date: formatDateISO(d2),
          container: row[colIdx.t2Container] ? String(row[colIdx.t2Container]).trim() : '',
          skus: parseNumber(row[colIdx.t2Skus])
        });
      }
    }

    // --- Table 3 Parsing (Outbound metrics) ---
    if (colIdx.t3Date !== -1 && row[colIdx.t3Date]) {
      var d3 = row[colIdx.t3Date];
      if (d3 && String(d3).toLowerCase() !== 'date') {
        table3Outbound.push({
          date: formatDateISO(d3),
          deliveries: parseNumber(row[colIdx.t3Deliveries])
        });
      }
    }

    // --- Table 4 Parsing (Request metrics) ---
    if (colIdx.t4Date !== -1 && row[colIdx.t4Date]) {
      var d4 = row[colIdx.t4Date];
      if (d4 && String(d4).toLowerCase() !== 'request date') {
        table4Request.push({
          date: formatDateISO(d4),
          containers: parseNumber(row[colIdx.t4Containers]),
          skus: parseNumber(row[colIdx.t4Skus])
        });
      }
    }
  }

  // 7. Fetch additional raw delivery details from the OUTBOUND worksheet
  var outboundRawList = getRawOutboundDetails(ss);

  // Convert the zoneMap object into an array of objects
  var zoneSummary = Object.keys(zoneMap).map(function(k) { 
    return zoneMap[k]; 
  });

  // 8. Return the complete dashboard state object
  return {
    appVersion: CONFIG.APP_VERSION,
    kpis: {
      totalInboundContainers: table2Inbound.length,
      totalSkusHandled: table1Location.reduce(function(sum, x) { return sum + x.skus; }, 0),
      totalOutboundDeliveries: outboundRawList.length,
      totalRequests: table4Request.reduce(function(sum, x) { return sum + x.containers; }, 0),
      activeLocationsCount: table1Location.length
    },
    table1Location: table1Location,
    zoneSummary: zoneSummary,
    table2Inbound: table2Inbound,
    table3Outbound: table3Outbound,
    table4Request: table4Request,
    outboundDetails: outboundRawList,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Helper function to locate the column index of duplicate header names.
 * Example: findHeaderOccurrence(headers, 'date', 2) returns the 2nd column named 'date'.
 */
function findHeaderOccurrence(headers, title, occurrence) {
  var count = 0;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === title) {
      count++;
      if (count === occurrence) return i; // Return column index when occurrence match is met
    }
  }
  return -1; // Header not found
}

/**
 * Helper function to categorize a location string into a broad zone group based on its prefix.
 */
function getZonePrefix(loc) {
  var upper = String(loc).toUpperCase().trim();
  if (upper.startsWith('A')) return 'Zone A';
  if (upper.startsWith('B')) return 'Zone B';
  if (upper.startsWith('C')) return 'Zone C';
  if (upper.startsWith('D')) return 'Zone D';
  if (upper.startsWith('E')) return 'Zone E';
  if (upper.startsWith('F')) return 'Zone F';
  if (upper.includes('STAGING')) return 'Staging';
  return 'Other';
}

/**
 * Reads and deduplicates outbound order entries from the OUTBOUND sheet.
 */
function getRawOutboundDetails(ss) {
  var outboundSheet = ss.getSheetByName(CONFIG.SHEETS.OUTBOUND);
  var outboundRawList = [];
  if (!outboundSheet) return outboundRawList;

  // Retrieve all populated data in the sheet
  var outValues = outboundSheet.getDataRange().getValues();
  if (outValues.length < 2) return outboundRawList;

  // Dictionary object to keep track of Delivery Orders we have already processed
  var seenDO = {};

  for (var j = 1; j < outValues.length; j++) {
    var r = outValues[j];
    
    // Column Index Mapping:
    // Index 1 (Col B) = Date | Index 4 (Col E) = Delivery Order | Index 5 (Col F) = Truck Number
    var rawDate = r[1];
    var doNum = r[4] ? String(r[4]).trim() : '';
    var truck = r[5] ? String(r[5]).trim() : '-';

    // Deduplication check: ignore empty DOs and DOs that have already been recorded
    if (doNum !== '' && !seenDO[doNum]) {
      seenDO[doNum] = true; // Mark DO as recorded
      outboundRawList.push({
        date: formatDateISO(rawDate),
        deliveryOrder: doNum,
        truckNumber: truck,
        status: 'Delivered'
      });
    }
  }

  return outboundRawList;
}

/**
 * Fallback function to return an empty structured payload when no data exists.
 */
function getEmptyPayload() {
  return {
    appVersion: CONFIG.APP_VERSION,
    kpis: { 
      totalInboundContainers: 0, 
      totalSkusHandled: 0, 
      totalOutboundDeliveries: 0, 
      totalRequests: 0, 
      activeLocationsCount: 0 
    },
    table1Location: [],
    zoneSummary: [],
    table2Inbound: [],
    table3Outbound: [],
    table4Request: [],
    outboundDetails: [],
    lastUpdated: new Date().toISOString()
  };
}
