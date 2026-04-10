import React, { useState, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';

const PAYMENT_METHODS = ['cash', 'card', 'store_credit', 'gift_card'];

export default function Register() {
  const { user } = useAuth();
  const { show, Toast } = useToast();
  const barcodeRef = useRef();

  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [payments, setPayments] = useState([{ method: 'cash', amount: '' }]);
  const [processing, setProcessing] = useState(false);
  const [note, setNote] = useState('');

  const total = cart.reduce((s, i) => s + parseFloat(i.price), 0);
  const paid  = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.max(0, total - paid).toFixed(2);

  // Scan or search barcode
  const handleBarcode = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    try {
      const res = await api.get(`/inventory/barcode/${barcode.trim()}`);
      const item = res.data;
      setCart(prev => [...prev, {
        inventory_id: item.id,
        title: item.title,
        condition: item.condition,
        price: item.price,
        consignor_id: item.consignor_id || null,
        item_type: item.consignor_id ? 'consignment' : 'retail',
      }]);
      setBarcode('');
      barcodeRef.current?.focus();
    } catch {
      show('Item not found or already sold.', 'error');
      setBarcode('');
    }
  };

  // Add manual item
  const addManual = () => {
    setCart(prev => [...prev, {
      inventory_id: null,
      title: 'Manual Item',
      price: 0,
      consignor_id: null,
      item_type: 'retail',
      manual: true,
    }]);
  };

  const removeItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));

  const updatePrice = (idx, val) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, price: val } : item));
  };

  const updateTitle = (idx, val) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, title: val } : item));
  };

  // Customer search
  const searchCustomers = async (q) => {
    setCustomerSearch(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    const res = await api.get(`/customers?search=${q}`);
    setCustomerResults(res.data.slice(0, 5));
  };

  const selectCustomer = (c) => {
    setCustomer(c);
    setCustomerSearch(c.name);
    setCustomerResults([]);
  };

  // Payment management
  const addPayment = () => setPayments(prev => [...prev, { method: 'cash', amount: '' }]);
  const removePayment = (idx) => setPayments(prev => prev.filter((_, i) => i !== idx));
  const updatePayment = (idx, field, val) => {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  // Charge remaining to a method quickly
  const chargeRemaining = (idx) => {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: remaining } : p));
  };

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) return show('Cart is empty.', 'error');
    if (parseFloat(paid.toFixed(2)) < parseFloat(total.toFixed(2))) {
      return show(`Still owed $${remaining}`, 'error');
    }
    setProcessing(true);
    try {
      const res = await api.post('/sales', {
        customer_id: customer?.id || null,
        items: cart.map(i => ({
          inventory_id: i.inventory_id,
          price_at_sale: parseFloat(i.price),
          consignor_id: i.consignor_id,
          item_type: i.item_type,
        })),
        payments: payments.map(p => ({ method: p.method, amount: parseFloat(p.amount) || 0 })),
      });
      show(`Sale complete — $${total.toFixed(2)}`, 'success');
      // Reset
      setCart([]);
      setCustomer(null);
      setCustomerSearch('');
      setPayments([{ method: 'cash', amount: '' }]);
      barcodeRef.current?.focus();
    } catch (err) {
      show(err.response?.data?.error || 'Sale failed.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
      {Toast}

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h2>Register</h2>
        <div className="flex gap-8 items-center">
          <span className="text-muted text-sm text-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="badge badge-active">{user?.name}</span>
        </div>
      </div>

      <div className="register-layout" style={{ flex: 1, overflow: 'hidden' }}>

        {/* Left — item entry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>

          {/* Barcode scan */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <form onSubmit={handleBarcode} className="flex gap-8">
              <input
                ref={barcodeRef}
                className="input"
                placeholder="Scan barcode or enter item ID..."
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary" type="submit">Add</button>
              <button className="btn btn-secondary" type="button" onClick={addManual}>Manual</button>
            </form>
          </div>

          {/* Customer */}
          <div className="card" style={{ padding: '14px 16px', position: 'relative' }}>
            <div className="flex items-center gap-8">
              <span className="text-muted text-sm text-mono" style={{ minWidth: 72 }}>Customer</span>
              <input
                className="input"
                placeholder="Search by name, email, or phone..."
                value={customerSearch}
                onChange={e => searchCustomers(e.target.value)}
              />
              {customer && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setCustomer(null); setCustomerSearch(''); }}>
                  ✕
                </button>
              )}
            </div>
            {customerResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', marginTop: '4px', overflow: 'hidden'
              }}>
                {customerResults.map(c => (
                  <div key={c.id}
                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onClick={() => selectCustomer(c)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div className="text-sm text-muted text-mono">
                      {c.email} · {c.loyalty_points} pts · ${parseFloat(c.store_credit_balance).toFixed(2)} credit
                    </div>
                  </div>
                ))}
              </div>
            )}
            {customer && (
              <div className="flex gap-16 mt-8" style={{ paddingLeft: '80px' }}>
                <span className="text-sm text-mono text-muted">
                  Points: <span className="text-accent">{customer.loyalty_points}</span>
                </span>
                <span className="text-sm text-mono text-muted">
                  Store Credit: <span className="text-accent">${parseFloat(customer.store_credit_balance).toFixed(2)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="register-items" style={{ flex: 1 }}>
            {cart.length === 0 && (
              <div className="empty-state">No items in cart — scan a barcode to begin</div>
            )}
            {cart.map((item, idx) => (
              <div key={idx} className="cart-item">
                <div className="cart-item-info">
                  {item.manual ? (
                    <input
                      className="input" style={{ marginBottom: '4px' }}
                      value={item.title}
                      onChange={e => updateTitle(idx, e.target.value)}
                    />
                  ) : (
                    <div className="cart-item-title">{item.title}</div>
                  )}
                  <div className="cart-item-sub">
                    {item.item_type === 'consignment' ? '◇ consigned' : '▦ retail'}
                    {item.condition ? ` · ${item.condition}` : ''}
                  </div>
                </div>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ width: '90px', textAlign: 'right', fontFamily: 'var(--mono)' }}
                  value={item.price}
                  onChange={e => updatePrice(idx, e.target.value)}
                />
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }}
                  onClick={() => removeItem(idx)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Right — cart totals and payment */}
        <div className="cart-panel">
          <div className="cart-header">
            <h3>Cart</h3>
            <span className="text-muted text-sm text-mono">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="cart-items" style={{ flex: 'none', maxHeight: '180px' }}>
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center" style={{ fontSize: '13px', padding: '4px 0' }}>
                <span className="text-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{item.title}</span>
                <span className="text-mono text-accent">${parseFloat(item.price || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="cart-footer">
            <div className="cart-total">
              <span className="cart-total-label">Total</span>
              <span className="cart-total-value">${total.toFixed(2)}</span>
            </div>

            {/* Payments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm text-mono">Payment</span>
                <button className="btn btn-sm btn-ghost" onClick={addPayment}>+ Split</button>
              </div>
              {payments.map((p, idx) => (
                <div key={idx} className="flex gap-8 items-center">
                  <select className="input" style={{ flex: 1 }}
                    value={p.method} onChange={e => updatePayment(idx, 'method', e.target.value)}>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <input className="input" type="number" step="0.01" min="0"
                    style={{ width: '90px', fontFamily: 'var(--mono)' }}
                    placeholder="0.00"
                    value={p.amount}
                    onChange={e => updatePayment(idx, 'amount', e.target.value)}
                    onClick={() => !p.amount && chargeRemaining(idx)}
                  />
                  {payments.length > 1 && (
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }}
                      onClick={() => removePayment(idx)}>✕</button>
                  )}
                </div>
              ))}
              {parseFloat(remaining) > 0 && paid > 0 && (
                <div className="flex justify-between text-sm text-mono">
                  <span className="text-muted">Remaining</span>
                  <span className="text-danger">${remaining}</span>
                </div>
              )}
              {paid > total && (
                <div className="flex justify-between text-sm text-mono">
                  <span className="text-muted">Change</span>
                  <span className="text-success">${(paid - total).toFixed(2)}</span>
                </div>
              )}
            </div>

            <button
              className="btn btn-primary btn-lg w-full"
              disabled={cart.length === 0 || processing}
              onClick={processSale}
              style={{ fontSize: '16px', letterSpacing: '0.04em' }}
            >
              {processing ? 'Processing...' : `Charge $${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
