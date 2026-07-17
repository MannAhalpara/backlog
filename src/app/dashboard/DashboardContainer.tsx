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
  completedToday: number;
  completedThisWeek: number;
  markedForLater: number;
  weeklyProgress: {
    day: string;
    dayName: string;
    saved: number;
    completed: number;
  }[];
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
    completedToday: 0,
    completedThisWeek: 0,
    markedForLater: 0,
    weeklyProgress: [],
  });

  // Filter redesign state
  const [filterMode, setFilterMode] = useState<'category' | 'apps'>('category');
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

  // Edit & Move states
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [movingLink, setMovingLink] = useState<LinkItem | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [editUrlValue, setEditUrlValue] = useState('');
  const [moveCategoryIdValue, setMoveCategoryIdValue] = useState<string | null>(null);

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

  // Save Link Edit (Title & URL)
  const handleSaveLinkEdit = async () => {
    if (!editingLink) return;
    if (!editUrlValue || editUrlValue.trim() === '') {
      alert('URL cannot be empty.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/links/${editingLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: editNoteValue.trim(),
          url: editUrlValue.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update link');
      }

      setEditingLink(null);
      await fetchLinks();
      await fetchStats();
      await fetchCategories();
    } catch (err: any) {
      console.error('Error updating link:', err);
      alert(err.message || 'Could not update link.');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Link Move (Category)
  const handleSaveLinkMove = async () => {
    if (!movingLink) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/links/${movingLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: moveCategoryIdValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to move link');
      }

      setMovingLink(null);
      await fetchLinks();
      await fetchStats();
      await fetchCategories();
    } catch (err: any) {
      console.error('Error moving link:', err);
      alert(err.message || 'Could not move link.');
    } finally {
      setActionLoading(false);
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
      
      {/* 2 Combined Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>
        {/* Left Card: Black Card (Opposite Theme) */}
        <div style={{
          backgroundColor: '#111827',
          color: '#ffffff',
          borderRadius: '30px',
          padding: '24px',
          display: 'grid',
          gridTemplateRows: '1fr 1fr', // Split exactly half-half
          minHeight: '280px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Top Half (Total Saved | Remaining) */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
            paddingBottom: '18px' // Adjusted padding to balance space before divider
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Inbox size={24} color="#3b82f6" />
              </span>
              <div>
                <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Saved</div>
                <div style={{ fontSize: '25px', fontWeight: '800', color: '#ffffff', lineHeight: '1.1', marginTop: '2px' }}>{stats.totalSaved}</div>
              </div>
            </div>
            
            <div style={{ height: '42px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'right' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</div>
                <div style={{ fontSize: '25px', fontWeight: '800', color: '#ffffff', lineHeight: '1.1', marginTop: '2px' }}>{stats.pending}</div>
              </div>
              <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={24} color="#60a5fa" />
              </span>
            </div>
          </div>

          {/* Bottom Half (3 nested light cards) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            alignItems: 'stretch', // Stretches sub-cards to fill the bottom half height
            paddingTop: '18px', // Spacing after divider
            height: '100%'
          }}>
            {/* Sub Card 1: Completed Today */}
            <div style={{
              backgroundColor: '#ffffff',
              color: '#111827',
              borderRadius: '18px',
              padding: '14px 10px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.15)',
              height: '100%'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Today</div>
              <div style={{ fontSize: '25px', fontWeight: '800', color: '#111827', lineHeight: '1.1' }}>{stats.completedToday}</div>
            </div>

            {/* Sub Card 2: Completed This Week */}
            <div style={{
              backgroundColor: '#ffffff',
              color: '#111827',
              borderRadius: '18px',
              padding: '14px 10px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.15)',
              height: '100%'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>This Week</div>
              <div style={{ fontSize: '25px', fontWeight: '800', color: '#111827', lineHeight: '1.1' }}>{stats.completedThisWeek}</div>
            </div>

            {/* Sub Card 3: Mark for Later */}
            <div style={{
              backgroundColor: '#ffffff',
              color: '#111827',
              borderRadius: '18px',
              padding: '14px 10px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.15)',
              height: '100%'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Snoozed</div>
              <div style={{ fontSize: '25px', fontWeight: '800', color: '#111827', lineHeight: '1.1' }}>{stats.markedForLater}</div>
            </div>
          </div>
        </div>

        {/* Right Card: Weekly Progress (Light Card) */}
        <div className="glass-panel" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '280px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--foreground)' }}>Weekly Progress</span>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: '600' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--foreground)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#111827' }} />
                <span>Completed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--muted)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d1d5db' }} />
                <span>Saved</span>
              </div>
            </div>
          </div>

          {/* Graph Area */}
          <div style={{ flexGrow: 1, position: 'relative', minHeight: '130px', display: 'flex', alignItems: 'center', width: '100%', marginTop: '4px' }}>
            {stats.weeklyProgress && stats.weeklyProgress.length > 0 ? (
              (() => {
                const width = 350;
                const height = 120;
                const todayIndex = (new Date().getDay() + 6) % 7;
                const todayX = (todayIndex + 0.5) * (width / 7);
                
                // Calculate max value dynamically
                const maxVal = Math.max(
                  1,
                  ...stats.weeklyProgress.map((d) => d.saved),
                  ...stats.weeklyProgress.map((d) => d.completed)
                );

                // Generate points
                const savedPoints = stats.weeklyProgress.map((d, i) => {
                  const x = (i + 0.5) * (width / 7);
                  const y = height - 10 - (d.saved / maxVal) * (height - 20);
                  return { x, y };
                });

                const completedPoints = stats.weeklyProgress.map((d, i) => {
                  const x = (i + 0.5) * (width / 7);
                  const y = height - 10 - (d.completed / maxVal) * (height - 20);
                  return { x, y };
                });

                // Function to build curvy bezier spline path
                const getCurvyPath = (points: { x: number; y: number }[]) => {
                  if (points.length === 0) return '';
                  let path = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 0; i < points.length - 1; i++) {
                    const p0 = points[i];
                    const p1 = points[i + 1];
                    const cp1x = p0.x + (p1.x - p0.x) / 2;
                    const cp1y = p0.y;
                    const cp2x = p0.x + (p1.x - p0.x) / 2;
                    const cp2y = p1.y;
                    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
                  }
                  return path;
                };

                return (
                  <svg 
                    viewBox={`0 0 ${width} ${height}`} 
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    {/* Grid lines (horizontal helper lines) */}
                    <line x1="0" y1={height - 10} x2={width} y2={height - 10} stroke="rgba(0,0,0,0.03)" strokeWidth="1" />
                    <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(0,0,0,0.02)" strokeWidth="1" />
                    <line x1="0" y1="10" x2={width} y2="10" stroke="rgba(0,0,0,0.02)" strokeWidth="1" strokeDasharray="2 2" />

                    {/* Vertical guideline for today */}
                    <line 
                      x1={todayX} 
                      y1="0" 
                      x2={todayX} 
                      y2={height} 
                      stroke="rgba(17, 24, 39, 0.08)" 
                      strokeWidth="1.5" 
                      strokeDasharray="3 3" 
                    />

                    {/* Saved curve (light grey) */}
                    <path 
                      d={getCurvyPath(savedPoints)} 
                      fill="none" 
                      stroke="#d1d5db" 
                      strokeWidth="2.5" 
                      strokeLinecap="round"
                    />

                    {/* Completed curve (black) */}
                    <path 
                      d={getCurvyPath(completedPoints)} 
                      fill="none" 
                      stroke="#111827" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                    />

                    {/* Saved Points Dots */}
                    {savedPoints.map((p, idx) => {
                      const isToday = idx === todayIndex;
                      return (
                        <circle 
                          key={`s-${idx}`} 
                          cx={p.x} 
                          cy={p.y} 
                          r={isToday ? "5" : "3.5"} 
                          fill={isToday ? "#d1d5db" : "#ffffff"} 
                          stroke="#d1d5db" 
                          strokeWidth={isToday ? "3" : "2"} 
                        />
                      );
                    })}

                    {/* Completed Points Dots */}
                    {completedPoints.map((p, idx) => {
                      const isToday = idx === todayIndex;
                      return (
                        <circle 
                          key={`c-${idx}`} 
                          cx={p.x} 
                          cy={p.y} 
                          r={isToday ? "5" : "3.5"} 
                          fill={isToday ? "#111827" : "#ffffff"} 
                          stroke="#111827" 
                          strokeWidth={isToday ? "3" : "2"} 
                        />
                      );
                    })}
                  </svg>
                );
              })()
            ) : (
              <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No weekly data available
              </div>
            )}
          </div>

          {/* Weekdays Labels footer aligned exactly */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--muted)',
            marginTop: '8px',
            borderTop: '1px solid var(--border)',
            paddingTop: '8px'
          }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
              const isToday = idx === ((new Date().getDay() + 6) % 7);
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={isToday ? {
                    backgroundColor: '#111827',
                    color: '#ffffff',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '11px'
                  } : {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px'
                  }}>
                    {day}
                  </span>
                </div>
              );
            })}
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
        {(drilledCategory !== null || drilledApp !== null) && (
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
            <span>Filter by: {filterMode === 'category' ? 'Category' : 'Apps'}</span>
          </button>
          
          {filterDropdownOpen && (
            <div className="dropdown-menu">
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                          <a
                            href={`/api/links/${link.id}/open`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            Open
                          </a>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setMovingLink(link);
                                setMoveCategoryIdValue(link.category_id);
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Move Category"
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingLink(link);
                                setEditNoteValue(link.note || '');
                                setEditUrlValue(link.url);
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Edit Link"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDeleteLink(link.id)}
                            style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            title="Permanently Delete"
                          >
                            Delete
                          </button>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setMovingLink(link);
                                setMoveCategoryIdValue(link.category_id);
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Move Category"
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingLink(link);
                                setEditNoteValue(link.note || '');
                                setEditUrlValue(link.url);
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Edit Link"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
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

      {/* Edit Link Modal */}
      {editingLink && (
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
              onClick={() => setEditingLink(null)}
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
              disabled={actionLoading}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '16px' }}>
              Edit Link
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  Title / Short Note
                </label>
                <input
                  type="text"
                  value={editNoteValue}
                  onChange={(e) => setEditNoteValue(e.target.value)}
                  placeholder="Enter a short note..."
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  URL
                </label>
                <input
                  type="text"
                  value={editUrlValue}
                  onChange={(e) => setEditUrlValue(e.target.value)}
                  placeholder="Enter URL..."
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingLink(null)}
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveLinkEdit}
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Category Modal */}
      {movingLink && (
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
              onClick={() => setMovingLink(null)}
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
              disabled={actionLoading}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '8px' }}>
              Move to Category
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
              Select a new category for: <strong>{movingLink.note || 'Untitled Link'}</strong>
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={moveCategoryIdValue || ''}
                  onChange={(e) => setMoveCategoryIdValue(e.target.value || null)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  disabled={actionLoading}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMovingLink(null)}
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveLinkMove}
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Moving...' : 'Move Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
