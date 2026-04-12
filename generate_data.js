const fs = require('fs');
const xlsx = require('xlsx');

const workbook = xlsx.readFile('/Users/fh/code/playground/cash_is_clear/Cash is Clear Maximizer ver EZ 224.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonRaw = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

const validData = [];
if (jsonRaw.length > 5) {
    const headers = jsonRaw[4].map(h => (h || '').toString().trim());
    for (let i = 5; i < jsonRaw.length; i++) {
        const row = jsonRaw[i];
        if (!row[0] && !row[1]) continue;

        let obj = {};
        let hasContent = false;
        for (let j = 0; j < headers.length; j++) {
            if (headers[j]) {
                obj[headers[j]] = row[j] !== undefined ? row[j] : '';
                if (row[j] !== '' && row[j] !== undefined) hasContent = true;
            }
        }
        if (hasContent) {
            validData.push(obj);
        }
    }
}
fs.writeFileSync('/Users/fh/code/playground/cash_is_clear/prototype/data.json', JSON.stringify(validData, null, 2));
console.log('Saved data.json with', validData.length, 'records');
