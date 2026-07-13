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
  Clock,
  Edit2
} from 'lucide-react';
import { LinkedInIcon, InstagramIcon, YouTubeIcon } from '@/components/BrandIcons';

interface Category {
  id: string;
  name: string;
  total_count?: number;
  pending_count?: number;
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
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [stats, setStats] = useState<Stats>({
    totalSaved: 0,
    pending: 0,
    visitedNotClosed: 0,
    doneThisWeek: 0,
  });

  // Filter redesign state
  const [filterMode, setFilterMode] = useState<'none' | 'category' | 'apps'>('none');
  const [drilledCategory, setDrilledCategory] = useState<Category | 'uncategorized' | null>(null);
  const [drilledApp, setDrilledApp] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // Category inline actions
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

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

  // Fetch Categories with counts
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
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

      popupLinksSet(activePopups);
    } catch (err) {
      console.error('Error checking popups:', err);
    }
  };

  const popupLinksSet = (activePopups: LinkItem[]) => {
    setPopupLinks(activePopups);
    if (activePopups.length > 0) {
      setActivePopupIndex(0);
      setRemindMode(false);
      setCustomRemindDate('');
    } else {
      setActivePopupIndex(null);
    }
  };

  // Initial load and whenever filters change
  useEffect(() => {
    fetchLinks();
  }, [appFilter, categoryFilter, debouncedSearch, sortOrder, viewMode]);

  // Load stats, categories and popups on page mount
  useEffect(() => {
    fetchStats();
    fetchCategories();
    checkPopups();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!filterDropdownOpen) return;
    const closeDropdown = () => setFilterDropdownOpen(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [filterDropdownOpen]);

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

      // 4. Refresh page data
      fetchLinks();
      fetchStats();
      fetchCategories();
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

      // Refetch stats, categories & links
      fetchLinks();
      fetchStats();
      fetchCategories();
    } catch (err) {
      console.error('Error deleting link:', err);
      alert('Could not delete link.');
    }
  };

  // Category Actions
  const handleSaveRename = async (id: string) => {
    if (!renameValue || renameValue.trim() === '') {
      alert('Category name cannot be empty.');
      return;
    }
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to rename category');
      }
      
      setEditingCategoryId(null);
      await fetchCategories();
      await fetchLinks();
    } catch (err: any) {
      console.error('Error renaming category:', err);
      alert(err.message || 'Could not rename category.');
    }
  };

  const handleDeleteCategoryClick = (cat: Category) => {
    setDeletingCategory(cat);
  };

  const handleDeleteCategory = async (id: string, mode: 'only' | 'all') => {
    try {
      const res = await fetch(`/api/categories/${id}?mode=${mode}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete category');
      
      setDeletingCategory(null);
      await fetchCategories();
      await fetchLinks();
      await fetchStats();
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Could not delete category.');
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
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--muted-light)', padding: '10px', borderRadius: '8px', color: 'var(--muted)' }}><Inbox size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Total Saved</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.totalSaved}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '10px', borderRadius: '8px', color: 'var(--primary)' }}><Clock size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Pending Links</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.pending}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '8px', color: '#d97706' }}><AlertCircle size={22} /></div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Visited & Open</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '2px' }}>{stats.visitedNotClosed}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
          onClick={() => {
            setViewMode(viewMode === 'pending' ? 'history' : 'pending');
            // Reset drilldowns when switching backlog/history
            setDrilledCategory(null);
            setDrilledApp(null);
            setCategoryFilter('all');
            setAppFilter('all');
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '13px' }}
        >
          <History size={16} />
          {viewMode === 'pending' ? 'View History' : 'View Backlog'}
        </button>
      </div>

      {/* Filter Row */}
      <div className="glass-panel" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
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

        {/* Sort Order Toggle */}
        {(filterMode === 'none' || drilledCategory !== null || drilledApp !== null) && (
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
        )}

        {/* Filter By Dropdown Button */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              setFilterDropdownOpen(!filterDropdownOpen);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', fontSize: '13px' }}
          >
            <span>Filter by: {filterMode === 'none' ? 'None' : filterMode === 'category' ? 'Category' : 'Apps'}</span>
          </button>
          
          {filterDropdownOpen && (
            <div className="dropdown-menu">
              <div 
                className={`dropdown-item ${filterMode === 'none' ? 'active' : ''}`}
                onClick={() => {
                  setFilterMode('none');
                  setCategoryFilter('all');
                  setAppFilter('all');
                  setDrilledCategory(null);
                  setDrilledApp(null);
                }}
              >
                None
              </div>
              <div 
                className={`dropdown-item ${filterMode === 'category' ? 'active' : ''}`}
                onClick={() => {
                  setFilterMode('category');
                  setCategoryFilter('all');
                  setAppFilter('all');
                  setDrilledCategory(null);
                  setDrilledApp(null);
                }}
              >
                Category
              </div>
              <div 
                className={`dropdown-item ${filterMode === 'apps' ? 'active' : ''}`}
                onClick={() => {
                  setFilterMode('apps');
                  setCategoryFilter('all');
                  setAppFilter('all');
                  setDrilledCategory(null);
                  setDrilledApp(null);
                }}
              >
                Apps
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px' }}>
          Loading links...
        </div>
      ) : filterMode === 'category' && !drilledCategory ? (
        /* Render Category Grid */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '6px 12px' }}
              onClick={() => {
                setFilterMode('none');
                setCategoryFilter('all');
                setDrilledCategory(null);
              }}
            >
              ← Back to All Links
            </button>
            <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '500' }}>
              Filter by Category
            </span>
          </div>

          <div className="card-grid">
            {categories.map((cat) => {
              const isEditing = editingCategoryId === cat.id;
              // If viewMode is history, count only completed links, else pending
              const count = viewMode === 'history' 
                ? (cat.total_count || 0) - (cat.pending_count || 0)
                : (cat.pending_count || 0);
              
              return (
                <div 
                  key={cat.id} 
                  className="glass-panel filter-card"
                  onClick={() => {
                    if (!isEditing) {
                      setCategoryFilter(cat.id);
                      setDrilledCategory(cat);
                    }
                  }}
                >
                  {isEditing ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(cat.id);
                          if (e.key === 'Escape') setEditingCategoryId(null);
                        }}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => setEditingCategoryId(null)}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleSaveRename(cat.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Card Actions (Rename, Delete) */}
                      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryId(cat.id);
                            setRenameValue(cat.name);
                          }}
                          title="Rename Category"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategoryClick(cat);
                          }}
                          title="Delete Category"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', marginRight: '50px', wordBreak: 'break-word' }}>
                          {cat.name}
                        </h3>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500', marginTop: '12px' }}>
                        {count} {count === 1 ? 'link' : 'links'}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Uncategorized Card */}
            {(() => {
              // Get uncategorized links count for the active viewMode
              const uncategorizedCount = links.filter(l => l.category_id === null).length;
              if (uncategorizedCount > 0) {
                return (
                  <div 
                    className="glass-panel filter-card"
                    onClick={() => {
                      setCategoryFilter('uncategorized');
                      setDrilledCategory('uncategorized');
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)' }}>
                        Uncategorized
                      </h3>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500', marginTop: '12px' }}>
                      {uncategorizedCount} {uncategorizedCount === 1 ? 'link' : 'links'}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      ) : filterMode === 'apps' && !drilledApp ? (
        /* Render Apps Grid */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '6px 12px' }}
              onClick={() => {
                setFilterMode('none');
                setAppFilter('all');
                setDrilledApp(null);
              }}
            >
              ← Back to All Links
            </button>
            <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '500' }}>
              Filter by Apps
            </span>
          </div>

          <div className="card-grid">
            {sources.map((src) => {
              const count = links.filter(l => l.app_source === src).length;
              
              return (
                <div 
                  key={src} 
                  className="glass-panel filter-card"
                  onClick={() => {
                    setAppFilter(src);
                    setDrilledApp(src);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {renderAppIcon(src)}
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)' }}>
                      {src.charAt(0).toUpperCase() + src.slice(1)}
                    </h3>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500', marginTop: '12px' }}>
                    {count} {count === 1 ? 'link' : 'links'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Render Links List */
        <div>
          {/* Drilled-down Header */}
          {drilledCategory && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '6px 12px' }}
                onClick={() => {
                  setCategoryFilter('all');
                  setDrilledCategory(null);
                }}
              >
                ← Back to Categories
              </button>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '6px 12px' }}
                onClick={() => {
                  setFilterMode('none');
                  setCategoryFilter('all');
                  setDrilledCategory(null);
                }}
              >
                ← Back to All Links
              </button>
              <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '600', marginLeft: 'auto' }}>
                Category: {drilledCategory === 'uncategorized' ? 'Uncategorized' : drilledCategory.name}
              </span>
            </div>
          )}

          {drilledApp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '6px 12px' }}
                onClick={() => {
                  setAppFilter('all');
                  setDrilledApp(null);
                }}
              >
                ← Back to Apps
              </button>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '6px 12px' }}
                onClick={() => {
                  setFilterMode('none');
                  setAppFilter('all');
                  setDrilledApp(null);
                }}
              >
                ← Back to All Links
              </button>
              <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '600', marginLeft: 'auto' }}>
                App Source: {drilledApp.charAt(0).toUpperCase() + drilledApp.slice(1)}
              </span>
            </div>
          )}

          {links.length === 0 ? (
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
                    className="glass-panel"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Left group */}
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
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            padding: '24px',
            maxWidth: '460px',
            width: '100%',
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.92)'
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

      {/* Category Deletion Choice Modal */}
      {deletingCategory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            padding: '28px',
            maxWidth: '480px',
            width: '100%',
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.92)'
          }}>
            <button
              type="button"
              onClick={() => setDeletingCategory(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--muted)'
              }}
              title="Close Modal"
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '8px', paddingRight: '24px' }}>
              Delete Category: {deletingCategory.name}
            </h3>
            
            {(deletingCategory.total_count || 0) > 0 ? (
              <>
                <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                  This category contains <strong>{deletingCategory.total_count}</strong> associated links. How would you like to proceed?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDeleteCategory(deletingCategory.id, 'only')}
                    style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px', padding: '12px' }}
                  >
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--foreground)' }}>Delete category only</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Links will be kept and marked as Uncategorized.</span>
                  </button>

                  <button
                    type="button"
                    className="btn style-danger"
                    onClick={() => handleDeleteCategory(deletingCategory.id, 'all')}
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      padding: '12px',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#991b1b' }}>Delete category and its links</span>
                    <span style={{ fontSize: '12px', color: '#b91c1c' }}>Permanently deletes this category and all of its associated links.</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                  Are you sure you want to delete this category? It contains no links.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleDeleteCategory(deletingCategory.id, 'only')}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    Delete Category
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletingCategory(null)}
              style={{ marginTop: '10px', width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
