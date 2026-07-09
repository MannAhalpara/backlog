'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Link2,
  Search,
  History,
  Trash2,
  ExternalLink,
  X,
  Inbox,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock
} from 'lucide-react';
import { LinkedInIcon, InstagramIcon, YouTubeIcon } from '@/components/BrandIcons';

interface Category {
  id: string;
  name: string;
}

interface LinkItem {
  id: string;
  url: string;
  note: string;
  category_id: string | null;
  category_name: string | null;
  app_source: string;
  status: string;
  clicked_at: string | null;
  remind_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  totalSaved: number;
  pending: number;
  visitedNotClosed: number;
  doneThisWeek: number;
}

interface DashboardContainerProps {
  initialCategories: Category[];
}

export default function DashboardContainer({ initialCategories }: DashboardContainerProps) {
  // State
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [categories] = useState<Category[]>(initialCategories);
  const [stats, setStats] = useState<Stats>({
    totalSaved: 0,
    pending: 0,
    visitedNotClosed: 0,
    doneThisWeek: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [appFilter, setAppFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

  // Popup logic
  const [popupLinks, setPopupLinks] = useState<LinkItem[]>([]);
  const [activePopupIndex, setActivePopupIndex] = useState<number | null>(null);
  const [remindMode, setRemindMode] = useState(false);
  const [customRemindDate, setCustomRemindDate] = useState('');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch links & filters metadata
  const fetchLinks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        app: appFilter,
        category: categoryFilter,
        search: debouncedSearch,
        sort: sortOrder,
        view: viewMode,
      });

      const res = await fetch(`/api/links?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch links');
      const data = await res.json();
      setLinks(data.links || []);
      setSources(data.sources || []);
    } catch (err) {
      console.error('Error fetching links:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/links/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch Popups & Filter by LocalStorage dismissals
  const checkPopups = async () => {
    try {
      const res = await fetch('/api/links/pending-popup');
      if (!res.ok) throw new Error('Failed to fetch popups');
      const data = await res.json();
      const pendingPopups = data.links || [];

      // Load dismissed list from localStorage
      const dismissalsRaw = localStorage.getItem('dismissed_popups');
      const dismissals = dismissalsRaw ? JSON.parse(dismissalsRaw) : {};

      // Filter out links where clicked_at is older than or equal to dismissal time
      const activePopups = pendingPopups.filter((link: LinkItem) => {
        if (!link.clicked_at) return false;
        const clickedTime = new Date(link.clicked_at).getTime();
        const dismissalTime = dismissals[link.id];
        return !dismissalTime || clickedTime > dismissalTime;
      });

      setPopupLinks(activePopups);
      if (activePopups.length > 0) {
        setActivePopupIndex(0);
        setRemindMode(false);
        setCustomRemindDate('');
      } else {
        setActivePopupIndex(null);
      }
    } catch (err) {
      console.error('Error checking popups:', err);
    }
  };

  // Initial load and whenever filters change
  useEffect(() => {
    fetchLinks();
  }, [appFilter, categoryFilter, debouncedSearch, sortOrder, viewMode]);

  // Load stats and popups on page mount
  useEffect(() => {
    fetchStats();
    checkPopups();
  }, []);

  // Format age since saved
  const getDaysSince = (dateStr: string) => {
    const savedDate = new Date(dateStr);
    const diffTime = Math.abs(Date.now() - savedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  // Render correct app icon
  const renderAppIcon = (app: string) => {
    const size = 18;
    switch (app) {
      case 'linkedin':
        return <LinkedInIcon size={size} color="#0077b5" />;
      case 'instagram':
        return <InstagramIcon size={size} color="#e1306c" />;
      case 'youtube':
        return <YouTubeIcon size={size} color="#ff0000" />;
      case 'medium':
        return <FileText size={size} color="#12100e" />;
      default:
        return <Link2 size={size} color="#4b5563" />;
    }
  };

  // Status Badge configurations
  const getStatusBadgeConfig = (link: LinkItem) => {
    if (link.status === 'done') {
      return { label: 'Done', className: 'status-done' };
    }
    if (link.clicked_at) {
      return { label: 'Visited', className: 'status-visited' };
    }
    const savedDate = new Date(link.created_at);
    const diffTime = Date.now() - savedDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      return { label: 'Overdue', className: 'status-overdue' };
    }
    return { label: 'Pending', className: 'status-pending' };
  };

  // Popup Action Trigger
  const handlePopupAction = async (action: 'done' | 'remove' | 'remind' | 'dismiss', dateOffsetDays?: number) => {
    if (activePopupIndex === null) return;
    const currentLink = popupLinks[activePopupIndex];

    setActionLoading(true);
    try {
      let remindAtDate: string | null = null;
      if (action === 'remind') {
        if (dateOffsetDays !== undefined) {
          const date = new Date();
          date.setDate(date.getDate() + dateOffsetDays);
          remindAtDate = date.toISOString();
        } else if (customRemindDate) {
          remindAtDate = new Date(customRemindDate).toISOString();
        } else {
          alert('Please specify a reminder date.');
          setActionLoading(false);
          return;
        }
      }

      // 1. Submit response to API
      const res = await fetch(`/api/links/${currentLink.id}/popup-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remindAtDate }),
      });

      if (!res.ok) throw new Error('Failed to submit popup response');

      // 2. If action is dismiss, log to localStorage to suppress further prompts locally
      if (action === 'dismiss') {
        const dismissalsRaw = localStorage.getItem('dismissed_popups');
        const dismissals = dismissalsRaw ? JSON.parse(dismissalsRaw) : {};
        dismissals[currentLink.id] = Date.now();
        localStorage.setItem('dismissed_popups', JSON.stringify(dismissals));
      }

      // 3. Move to next popup or close
      if (activePopupIndex + 1 < popupLinks.length) {
        setActivePopupIndex(activePopupIndex + 1);
        setRemindMode(false);
        setCustomRemindDate('');
      } else {
        setActivePopupIndex(null);
      }

      // 4. Refresh page data (stats and links list)
      fetchLinks();
      fetchStats();
    } catch (err) {
      console.error('Error processing popup action:', err);
      alert('Error updating link.');
    } finally {
      setActionLoading(false);
    }
  };

  // Hard Delete Link (History View Only)
  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this link from the database?')) {
      return;
    }

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete link');

      // Refetch links & stats
      fetchLinks();
      fetchStats();
    } catch (err) {
      console.error('Error deleting link:', err);
      alert('Could not delete link.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 4 Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--muted-light)', padding: '10px', borderRadius: '8px', color: 'var(--muted)' }}><Inbox size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Total Saved</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.totalSaved}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '10px', borderRadius: '8px', color: 'var(--primary)' }}><Clock size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Pending Links</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.pending}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '8px', color: '#d97706' }}><AlertCircle size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Visited & Open</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.visitedNotClosed}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: '#ecfdf5', padding: '10px', borderRadius: '8px', color: '#059669' }}><CheckCircle2 size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Done This Week</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.doneThisWeek}</div>
          </div>
        </div>
      </div>

      {/* Main View Header (Title & History Toggle) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginTop: '8px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>
          {viewMode === 'pending' ? 'Pending Backlog' : 'Completed History'}
        </h2>
        
        <button
          type="button"
          className={`btn ${viewMode === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setViewMode(viewMode === 'pending' ? 'history' : 'pending')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '13px' }}
        >
          <History size={16} />
          {viewMode === 'pending' ? 'View History' : 'View Backlog'}
        </button>
      </div>

      {/* Filter Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search notes or URLs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ flex: '1 1 150px' }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* App Source Filter */}
        <div style={{ flex: '1 1 150px' }}>
          <select value={appFilter} onChange={(e) => setAppFilter(e.target.value)}>
            <option value="all">All Sources</option>
            {sources.map((src) => (
              <option key={src} value={src}>{src.charAt(0).toUpperCase() + src.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Sort Order Toggle */}
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            style={{ padding: '10px 14px', fontSize: '13px' }}
          >
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Links List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>
          Loading links...
        </div>
      ) : links.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          border: '1px dashed var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--card-bg)',
          color: 'var(--muted)'
        }}>
          <Inbox size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)' }}>No links found</h3>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>
            {viewMode === 'pending'
              ? "Your backlog is clear! Paste a new link to get started."
              : "No completed links in your history yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {links.map((link) => {
            const badge = getStatusBadgeConfig(link);
            return (
              <div
                key={link.id}
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  // Mobile stack styling triggers automatically
                  flexWrap: 'wrap'
                }}
              >
                {/* Left content group */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 300px' }}>
                  <div style={{
                    backgroundColor: 'var(--muted-light)',
                    padding: '8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px'
                  }}>
                    {renderAppIcon(link.app_source)}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--foreground)', wordBreak: 'break-word' }}>
                      {link.note || 'Untitled Link'}
                    </div>
                    
                    <a
                      href={`/api/links/${link.id}/open`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '13px',
                        color: 'var(--muted)',
                        wordBreak: 'break-all',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {link.url}
                      <ExternalLink size={12} style={{ flexShrink: 0 }} />
                    </a>

                    <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span>{getDaysSince(link.created_at)}</span>
                      {link.category_name && (
                        <>
                          <span>•</span>
                          <span style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                            {link.category_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right actions group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', flexWrap: 'nowrap' }}>
                  <span className={`badge ${badge.className}`}>
                    {badge.label}
                  </span>

                  {viewMode === 'pending' ? (
                    <a
                      href={`/api/links/${link.id}/open`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      Open
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleDeleteLink(link.id)}
                      style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Permanently Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Return-Visit Popup Overlay Modal */}
      {activePopupIndex !== null && popupLinks[activePopupIndex] && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => handlePopupAction('dismiss')}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--muted)'
              }}
              title="Dismiss Popup"
              disabled={actionLoading}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '8px', paddingRight: '24px' }}>
              Follow-up: Did you finish this?
            </h3>
            
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
              You opened this link recently. What would you like to do with it?
            </p>

            {/* Link details card */}
            <div style={{
              backgroundColor: 'var(--muted-light)',
              borderRadius: '6px',
              padding: '12px 16px',
              marginBottom: '20px',
              borderLeft: '4px solid var(--primary)'
            }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', wordBreak: 'break-word' }}>
                {popupLinks[activePopupIndex].note || 'Untitled Link'}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--muted)',
                wordBreak: 'break-all',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {popupLinks[activePopupIndex].url}
              </div>
            </div>

            {/* Action buttons */}
            {!remindMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handlePopupAction('done')}
                    disabled={actionLoading}
                  >
                    Mark Done
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handlePopupAction('remove')}
                    disabled={actionLoading}
                  >
                    Remove
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRemindMode(true)}
                  disabled={actionLoading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Calendar size={16} />
                  Remind Me Later
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handlePopupAction('dismiss')}
                  disabled={actionLoading}
                >
                  Dismiss for Now
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                  Set Reminder:
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '8px', fontSize: '12px' }}
                    onClick={() => handlePopupAction('remind', 1)}
                    disabled={actionLoading}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '8px', fontSize: '12px' }}
                    onClick={() => handlePopupAction('remind', 3)}
                    disabled={actionLoading}
                  >
                    3 Days
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '8px', fontSize: '12px' }}
                    onClick={() => handlePopupAction('remind', 7)}
                    disabled={actionLoading}
                  >
                    Next Week
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="custom-date" style={{ fontSize: '12px', fontWeight: '500', color: 'var(--muted)' }}>
                    Or select a custom date:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      id="custom-date"
                      type="date"
                      value={customRemindDate}
                      onChange={(e) => setCustomRemindDate(e.target.value)}
                      disabled={actionLoading}
                      min={new Date().toISOString().split('T')[0]}
                      style={{ padding: '6px 10px', fontSize: '13px', flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      onClick={() => handlePopupAction('remind')}
                      disabled={actionLoading || !customRemindDate}
                    >
                      Set
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRemindMode(false)}
                  disabled={actionLoading}
                  style={{ marginTop: '4px' }}
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
