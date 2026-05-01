import { useState, useEffect, useRef } from 'react';
import type { AssetClass, TransactionType, Transaction, Account } from '../types';
import { useTranslation } from '../i18n';
import { calculateFees } from '../utils/fees';

interface TransactionFormProps {
  accounts: Account[];
  initial?: Transaction;
  onSubmit: (tx: Omit<Transaction, 'id' | 'updatedAt' | 'createdAt'>) => void;
  onCancel?: () => void;
}

export default function TransactionForm({ accounts, initial, onSubmit, onCancel }: TransactionFormProps) {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState<string>(initial?.accountId ?? (accounts[0]?.id || ''));
  const [symbol, setSymbol] = useState(initial?.symbol ?? '');
  const [assetClass, setAssetClass] = useState<AssetClass>(initial?.assetClass ?? 'arg_stocks');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'buy');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(initial?.quantity.toString() ?? '');
  const [price, setPrice] = useState(initial?.price.toString() ?? '');
  const [fees, setFees] = useState(initial?.fees.toString() ?? '0');
  const feesManuallyEdited = useRef(false);

  useEffect(() => {
    setAccountId(initial?.accountId ?? (accounts[0]?.id || ''));
    setSymbol(initial?.symbol ?? '');
    setAssetClass(initial?.assetClass ?? 'arg_stocks');
    setType(initial?.type ?? 'buy');
    setDate(initial?.date ?? new Date().toISOString().split('T')[0]);
    setQuantity(initial?.quantity.toString() ?? '');
    setPrice(initial?.price.toString() ?? '');
    setFees(initial?.fees.toString() ?? '0');
    feesManuallyEdited.current = false;
  }, [initial, accounts]);

  const account = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    if (feesManuallyEdited.current) return;
    const qtyNum = Number(quantity);
    const priceNum = Number(price);
    if (!account || qtyNum <= 0 || priceNum <= 0) return;

    const autoFees = calculateFees(
      { assetClass, quantity: qtyNum, price: priceNum },
      account
    );
    setFees(autoFees.toFixed(2));
  }, [accountId, assetClass, type, quantity, price, account, date, symbol]);

  const handleFeesChange = (value: string) => {
    feesManuallyEdited.current = true;
    setFees(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      accountId,
      symbol: symbol.trim().toUpperCase(),
      assetClass,
      type,
      date,
      quantity: Number(quantity),
      price: Number(price),
      fees: Number(fees),
      currency: 'ARS',
    });
  };

  const assetClasses: { value: AssetClass; label: string }[] = [
    { value: 'arg_stocks', label: t('form.assetClass.arg_stocks') },
    { value: 'arg_cedears', label: t('form.assetClass.arg_cedears') },
    { value: 'arg_bonds', label: t('form.assetClass.arg_bonds') },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-slate-800 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.account')}</label>
          <select
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.assetClass')}</label>
          <select
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={assetClass}
            onChange={(e) => setAssetClass(e.target.value as AssetClass)}
          >
            {assetClasses.map((ac) => (
              <option key={ac.value} value={ac.value}>{ac.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.symbol')}</label>
          <input
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 uppercase"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={t('form.placeholder.symbol')}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.type')}</label>
          <select
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
          >
            <option value="buy">{t('form.buy')}</option>
            <option value="sell">{t('form.sell')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.date')}</label>
          <input
            type="date"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.quantity')}</label>
          <input
            type="number"
            min="0"
            step="any"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.price')}</label>
          <input
            type="number"
            min="0"
            step="any"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{t('form.fees')}</label>
          <input
            type="number"
            min="0"
            step="any"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
            value={fees}
            onChange={(e) => handleFeesChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          {initial ? t('form.update') : t('form.add')} {t('transactions.title')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            {t('form.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
