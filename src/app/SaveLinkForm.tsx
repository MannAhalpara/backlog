'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
}

interface SaveLinkFormProps {
  initialCategories: Category[];
}

export default function SaveLinkForm({ initialCategories }: SaveLinkFormProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || url.trim() === '') {
      setError('URL is required.');
      return;
    }

    if (selectedCategory === 'new' && (!newCategoryName || newCategoryName.trim() === '')) {
      setError('Please specify a name for the new category.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const payload = {
        url: url.trim(),
        note: note.trim(),
        categoryId: selectedCategory === 'new' || selectedCategory === '' ? null : selectedCategory,
        newCategoryName: selectedCategory === 'new' ? newCategoryName.trim() : null,
      };

      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save link.');
      }

      setSuccess(true);
      
      // Update our local category list if a new one was created
      if (selectedCategory === 'new' && data.link && data.link.category_id) {
        const newlyCreatedCat: Category = {
          id: data.link.category_id,
          name: newCategoryName.trim(),
        };
        setCategories((prev) => {
          // Prevent duplicates in state
          if (prev.some((c) => c.id === newlyCreatedCat.id)) return prev;
          return [...prev, newlyCreatedCat].sort((a, b) => a.name.localeCompare(b.name));
        });
      }

      // Reset fields but keep categories state intact
      setUrl('');
      setNote('');
      setSelectedCategory('');
      setNewCategoryName('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the link.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '30px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '8px' }}>
          Link Saved Successfully!
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px' }}>
          It has been added as pending in your backlog.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setSuccess(false)}
          >
            Save Another Link
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '30px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '20px' }}>
        Add to Backlog
      </h1>

      {error && (
        <div style={{
          padding: '10px 12px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#991b1b',
          fontSize: '14px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label htmlFor="url" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', marginBottom: '6px' }}>
            Paste URL Link <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="url"
            type="text"
            required
            placeholder="https://example.com/post/123"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="note" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', marginBottom: '6px' }}>
            Short Note (Optional)
          </label>
          <textarea
            id="note"
            rows={3}
            placeholder="What is this link about?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div>
          <label htmlFor="category" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', marginBottom: '6px' }}>
            Category
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={loading}
            style={{ marginBottom: selectedCategory === 'new' ? '12px' : '0' }}
          >
            <option value="">No Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
            <option value="new">+ Create New Category</option>
          </select>

          {selectedCategory === 'new' && (
            <input
              type="text"
              placeholder="Enter new category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '4px' }}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Link'}
        </button>
      </form>
    </div>
  );
}
