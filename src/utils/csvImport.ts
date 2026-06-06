import type { AssetClass, TransactionType } from '../types';
import { addAccount, getAccounts, db } from '../db';
import { normalizeDate } from './date';
import { convertTransactionToArs } from './convertToArs';
import { ensureHistoricalExchangeRates } from '../api/exchangeRates';

interface CsvImportResult {
  transactions: Array<{
    date: string;
    accountId: string;
    symbol: string;
    assetClass: AssetClass;
    type: TransactionType;
    quantity: number;
    price: number;
    fees: number;
    currency: string;
  }>;
  errors: string[];
  count: number;
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z]/g, '');
}

const VALID_ASSET_CLASSES: AssetClass[] = ['arg_stocks', 'arg_cedears', 'arg_bonds'];
const VALID_TYPES: TransactionType[] = ['buy', 'sell'];

export async function importCsv(csvText: string): Promise<CsvImportResult> {
  const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { transactions: [], errors: ['CSV must have at least a header row and one data row'], count: 0 };
  }

  await ensureHistoricalExchangeRates('mep');
  await ensureHistoricalExchangeRates('ccl');

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const colIndex = new Map<string, number>();
  headers.forEach((h, i) => colIndex.set(h, i));

  const required = ['date', 'account', 'symbol', 'assetclass', 'type', 'quantity', 'price'];
  for (const req of required) {
    if (!colIndex.has(req)) {
      return { transactions: [], errors: [`Missing required column: ${req}`], count: 0 };
    }
  }

  const accounts = await getAccounts();
  const accountMap = new Map<string, string>(); // lowercased name -> id
  for (const a of accounts) {
    accountMap.set(a.name.toLowerCase(), a.id);
  }

  const transactions: CsvImportResult['transactions'] = [];
  const errors: string[] = [];

  // Load existing transactions for duplicate detection
  const existingTxs = await db.transactions.filter((tx) => tx.deletedAt === undefined).toArray();
  const existingKeySet = new Set(
    existingTxs.map((t) => `${t.date}|${t.accountId}|${t.symbol}|${t.type}|${t.quantity}|${t.price}`)
  );
  const csvKeySet = new Set<string>();

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = parseCsvLine(lines[rowIdx]);
    if (cols.length === 1 && cols[0] === '') continue; // skip empty lines

    const dateRaw = cols[colIndex.get('date')!]?.trim();
    const accountName = cols[colIndex.get('account')!]?.trim();
    const symbol = cols[colIndex.get('symbol')!]?.trim().toUpperCase();
    const assetClass = cols[colIndex.get('assetclass')!]?.trim() as AssetClass;
    const type = cols[colIndex.get('type')!]?.trim().toLowerCase() as TransactionType;
    const quantity = Number(cols[colIndex.get('quantity')!]?.trim());
    const price = Number(cols[colIndex.get('price')!]?.trim());
    const feesRaw = cols[colIndex.get('fees')!]?.trim();
    const fees = feesRaw ? Number(feesRaw) : 0;
    const currency = (cols[colIndex.get('currency')!]?.trim() || 'ARS').toUpperCase();

    const rowNum = rowIdx + 1;
    const rowErrors: string[] = [];

    const date = normalizeDate(dateRaw || '');
    if (!date) rowErrors.push(`invalid date format: ${dateRaw || 'missing'}`);
    if (!accountName) rowErrors.push('missing account');
    if (!symbol) rowErrors.push('missing symbol');
    if (!VALID_ASSET_CLASSES.includes(assetClass)) rowErrors.push(`invalid assetClass: ${assetClass}`);
    if (!VALID_TYPES.includes(type)) rowErrors.push(`invalid type: ${type}`);
    if (!Number.isFinite(quantity) || quantity <= 0) rowErrors.push(`invalid quantity: ${quantity}`);
    if (!Number.isFinite(price) || price <= 0) rowErrors.push(`invalid price: ${price}`);
    if (!Number.isFinite(fees) || fees < 0) rowErrors.push(`invalid fees: ${fees}`);

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
      continue;
    }

    // Resolve account
    let accountId = accountMap.get(accountName.toLowerCase());
    if (!accountId) {
      accountId = await addAccount({
        name: accountName,
        createdAt: date!,
        feeType: 'fixed',
        feeValue: 0,
      });
      accountMap.set(accountName.toLowerCase(), accountId);
    }

    // Duplicate detection
    const dupKey = `${date!}|${accountId}|${symbol}|${type}|${quantity}|${price}`;
    if (existingKeySet.has(dupKey)) {
      errors.push(`Row ${rowNum}: duplicate transaction (already exists in database)`);
      continue;
    }
    if (csvKeySet.has(dupKey)) {
      errors.push(`Row ${rowNum}: duplicate transaction (duplicate within CSV)`);
      continue;
    }
    csvKeySet.add(dupKey);
    existingKeySet.add(dupKey);

    const converted = await convertTransactionToArs(date!, price, fees, currency);

    transactions.push({
      date: date!,
      accountId,
      symbol,
      assetClass,
      type,
      quantity,
      price: converted.price,
      fees: converted.fees,
      currency: converted.currency,
    });
  }

  return { transactions, errors, count: transactions.length };
}
