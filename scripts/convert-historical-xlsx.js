const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = 'attached_assets/Community_Trade_Value_Data_1770301028138.xlsx';
const OUTPUT_DIR = 'data/historical-values';

function excelDateToISO(serial) {
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

function convertSheet(workbook, sheetName, outputName) {
  console.log(`Processing ${sheetName}...`);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`  Sheet "${sheetName}" not found, skipping.`);
    return null;
  }
  
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (data.length < 2) {
    console.log(`  Sheet "${sheetName}" is empty, skipping.`);
    return null;
  }
  
  const headers = data[0];
  const dateIdx = 0;
  
  const pickColumns = [];
  const playerColumns = [];
  
  for (let i = 1; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    
    if (/^\d{4}\s+(Early|Mid|Late)\s+\d+(st|nd|rd|th)$/i.test(header)) {
      pickColumns.push({ index: i, name: header });
    } else {
      playerColumns.push({ index: i, name: header });
    }
  }
  
  console.log(`  Found ${pickColumns.length} pick columns, ${playerColumns.length} player columns`);
  
  const result = {
    meta: {
      sheetName,
      generatedAt: new Date().toISOString(),
      dateRange: { start: null, end: null },
      totalDates: 0,
      pickColumns: pickColumns.map(p => p.name),
      playerCount: playerColumns.length
    },
    pickValuesByDate: {},
    playerValuesByDate: {}
  };
  
  let validRows = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row[dateIdx] === undefined) continue;
    
    const dateSerial = row[dateIdx];
    if (typeof dateSerial !== 'number') continue;
    
    const dateStr = excelDateToISO(dateSerial);
    if (!result.meta.dateRange.start || dateStr > result.meta.dateRange.start) {
      result.meta.dateRange.start = dateStr;
    }
    if (!result.meta.dateRange.end || dateStr < result.meta.dateRange.end) {
      result.meta.dateRange.end = dateStr;
    }
    
    const pickValues = {};
    for (const col of pickColumns) {
      const val = row[col.index];
      if (val !== undefined && val !== '' && typeof val === 'number') {
        pickValues[col.name] = val;
      }
    }
    if (Object.keys(pickValues).length > 0) {
      result.pickValuesByDate[dateStr] = pickValues;
    }
    
    const playerValues = {};
    for (const col of playerColumns) {
      const val = row[col.index];
      if (val !== undefined && val !== '' && typeof val === 'number') {
        playerValues[col.name] = val;
      }
    }
    if (Object.keys(playerValues).length > 0) {
      result.playerValuesByDate[dateStr] = playerValues;
    }
    
    validRows++;
  }
  
  result.meta.totalDates = validRows;
  console.log(`  Processed ${validRows} dates`);
  
  return result;
}

async function main() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(INPUT_FILE);
  console.log('Sheets found:', workbook.SheetNames.join(', '));
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const oneQbHist = convertSheet(workbook, '1QB Historical Data', '1qb-historical');
  if (oneQbHist) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '1qb-historical.json'),
      JSON.stringify(oneQbHist, null, 2)
    );
    console.log('  Saved 1qb-historical.json');
  }
  
  const sfHist = convertSheet(workbook, 'SF Historical Data', 'sf-historical');
  if (sfHist) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'sf-historical.json'),
      JSON.stringify(sfHist, null, 2)
    );
    console.log('  Saved sf-historical.json');
  }
  
  const oneQbSheet = workbook.Sheets['1QB'];
  if (oneQbSheet) {
    console.log('Processing current 1QB values...');
    const data = XLSX.utils.sheet_to_json(oneQbSheet, { header: 1 });
    const currentValues = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      
      currentValues.push({
        name: row[0],
        posRank: row[1],
        position: row[2],
        team: row[3],
        value: row[4],
        age: row[5],
        isRookie: row[6] === 'Yes',
        sfPosRank: row[7],
        sfValue: row[8]
      });
    }
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '1qb-current.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), players: currentValues }, null, 2)
    );
    console.log(`  Saved 1qb-current.json with ${currentValues.length} players`);
  }
  
  const sfSheet = workbook.Sheets['SF'];
  if (sfSheet) {
    console.log('Processing current SF values...');
    const data = XLSX.utils.sheet_to_json(sfSheet, { header: 1 });
    const currentValues = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      
      currentValues.push({
        name: row[0],
        posRank: row[1],
        position: row[2],
        team: row[3],
        value: row[4],
        age: row[5],
        isRookie: row[6] === 'Yes'
      });
    }
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'sf-current.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), players: currentValues }, null, 2)
    );
    console.log(`  Saved sf-current.json with ${currentValues.length} players`);
  }
  
  console.log('\nConversion complete!');
}

main().catch(console.error);
