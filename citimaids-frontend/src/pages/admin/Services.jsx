import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/axios';
import { brand, fonts, pageTitle, pageSubtitle, card, solidBtn as solidBtnToken, outlineBtn as outlineBtnToken, inputStyle as inputStyleToken, selectStyle as selectStyleToken } from './adminStyles';

/* Minimal, understated category configuration (clean neutral pill with subtle colored accent dot) */
const CATEGORY_CONFIG = {
    residential: { label: 'Residential', dot: '#059669' },
    commercial:  { label: 'Commercial', dot: '#2563eb' },
    specialized: { label: 'Specialized', dot: '#7c3aed' },
    maintenance: { label: 'Maintenance', dot: '#d97706' },
};

/* Minimal, clean service letter avatar */
function ServiceLetterAvatar({ name, status = 'active', size = 38 }) {
    const letter = (name || 'S').trim().charAt(0).toUpperCase();
    const isActive = status === 'active';
    return (
        <div style={{
            width: size, height: size, borderRadius: 10,
            background: isActive ? '#f1f5f9' : '#f8fafc',
            color: isActive ? '#0A2342' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: Math.round(size * 0.44),
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            border: `1.5px solid ${isActive ? '#e2e8f0' : '#e2e8f0'}`,
            flexShrink: 0,
        }}>
            {letter}
        </div>
    );
}

/* Minimal Category Pill with small accent dot */
function CategoryPill({ category }) {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.residential;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
            background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0',
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: config.dot }} />
            {config.label}
        </span>
    );
}

export default function Services() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [viewModal, setViewModal] = useState(null);
    const [formModal, setFormModal] = useState(null);
    const [form, setForm] = useState({ name: '', category: 'residential', description: '', base_price: '', status: 'active' });
    const [formLoading, setFormLoading] = useState(false);
    const [reorderMode, setReorderMode] = useState(false);
    const [reordering, setReordering] = useState(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    useEffect(() => { fetchServices(); }, []);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/services');
            setServices(res.data.data || res.data || []);
        } catch (err) {
            console.error('Services fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Sort: active on top (by display_order), inactive at the bottom
    const sortedServices = useMemo(() => {
        return [...services].sort((a, b) => {
            const aActive = a.status === 'active' ? 0 : 1;
            const bActive = b.status === 'active' ? 0 : 1;
            if (aActive !== bActive) return aActive - bActive;
            return (a.display_order || 0) - (b.display_order || 0);
        });
    }, [services]);

    // Filter by search and category
    const filteredServices = useMemo(() => {
        return sortedServices.filter((s) => {
            const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description && s.description.toLowerCase().includes(search.toLowerCase()));
            const matchCat = categoryFilter === 'all' || (s.category || 'residential').toLowerCase() === categoryFilter;
            return matchSearch && matchCat;
        });
    }, [sortedServices, search, categoryFilter]);

    // Active vs Inactive partitioning for clean visual grouping
    const activeServices = useMemo(() => filteredServices.filter(s => s.status === 'active'), [filteredServices]);
    const inactiveServices = useMemo(() => filteredServices.filter(s => s.status !== 'active'), [filteredServices]);

    const openAdd = () => {
        setForm({ name: '', category: 'residential', description: '', base_price: '', status: 'active' });
        setFormModal('add');
    };

    const openEdit = (svc) => {
        setForm({
            name: svc.name,
            category: svc.category || 'residential',
            description: svc.description || '',
            base_price: svc.base_price || '',
            status: svc.status || 'active'
        });
        setFormModal(svc);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (formModal === 'add') {
                await api.post('/services', form);
                showToast('Service created successfully.', 'success');
            } else {
                await api.put(`/services/${formModal.id}`, form);
                showToast('Service updated successfully.', 'success');
            }
            setFormModal(null);
            fetchServices();
        } catch {
            showToast('Failed to save service.', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggle = async (svc) => {
        const newStatus = svc.status === 'active' ? 'inactive' : 'active';
        try {
            await api.put(`/services/${svc.id}`, { ...svc, status: newStatus });
            showToast(`Service marked as ${newStatus}.`, 'success');
            fetchServices();
        } catch {
            showToast('Failed to toggle status.', 'error');
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/services/${deleteModal.id}`);
            setDeleteModal(null);
            showToast('Service deleted.', 'success');
            fetchServices();
        } catch {
            showToast('Failed to delete service.', 'error');
        }
    };

    // ── Drag & Drop / Step Reordering ─────────────────────────────────
    const handleDragStart = (index) => { dragItem.current = index; };
    const handleDragEnter = (index) => { dragOverItem.current = index; };

    const handleDragEnd = async () => {
        const from = dragItem.current;
        const to   = dragOverItem.current;
        if (from === null || to === null || from === to) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }
        const reordered = [...sortedServices];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        setServices(reordered);
        dragItem.current = null;
        dragOverItem.current = null;
        await persistReorder(reordered);
    };

    const moveService = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= sortedServices.length) return;
        const reordered = [...sortedServices];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(targetIndex, 0, moved);
        setServices(reordered);
        await persistReorder(reordered);
    };

    const persistReorder = async (reordered) => {
        setReordering(true);
        try {
            await api.post('/services/reorder', {
                order: reordered.map((s) => ({ id: s.id })),
            });
            showToast('Order saved — synced with customer booking.', 'success');
        } catch {
            showToast('Failed to save order — please refresh.', 'error');
            fetchServices();
        } finally {
            setReordering(false);
        }
    };

    const showToast = (msg, type) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const totalSvcs = services.length;
    const activeCount = services.filter(s => s.status === 'active').length;
    const inactiveCount = totalSvcs - activeCount;
    const totalBookings = services.reduce((acc, s) => acc + (s.bookings_count || 0), 0);

    return (
        <div style={{ fontFamily: fonts.body }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 24, right: 24, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                    background: toast.type === 'success' ? '#0A2342' : '#dc2626', color: '#fff',
                    boxShadow: '0 8px 24px rgba(10,35,66,0.18)',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        {toast.type === 'success'
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        }
                    </svg>
                    {toast.msg}
                </div>
            )}

            {/* View Modal — Rich Details & Customer Preview Drawer */}
            {viewModal && (
                <Overlay onClose={() => setViewModal(null)} title="Service Details">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Service Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <ServiceLetterAvatar name={viewModal.name} status={viewModal.status} size={48} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: brand.navy }}>{viewModal.name}</div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                                    <CategoryPill category={viewModal.category} />
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                        background: viewModal.status === 'active' ? '#f0fdf4' : '#f8fafc',
                                        color: viewModal.status === 'active' ? '#166534' : '#64748b',
                                        border: `1px solid ${viewModal.status === 'active' ? '#dcfce7' : '#e2e8f0'}`,
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                    }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: viewModal.status === 'active' ? '#16a34a' : '#94a3b8' }} />
                                        {viewModal.status === 'active' ? 'Active on Booking' : 'Inactive (Hidden)'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Customer Live Preview Box */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                </svg>
                                <span>Customer Booking View Preview</span>
                            </div>
                            <div style={{
                                padding: '14px 16px', borderRadius: 14,
                                border: '1.5px solid #e2e8f0', background: '#fff',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <CategoryPill category={viewModal.category} />
                                    <div style={{
                                        width: 18, height: 18, borderRadius: '50%',
                                        border: '5px solid #0A2342', background: '#fff',
                                        boxSizing: 'border-box',
                                    }} />
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: brand.navy, marginBottom: 4 }}>
                                    {viewModal.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 10 }}>
                                    {viewModal.description || 'Complete professional residential cleaning tailored to your residence.'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Starting Rate</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: brand.navy }}>AED {Number(viewModal.base_price || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Specs & Operational Numbers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${brand.border}` }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Starting Rate</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: brand.navy, marginTop: 2 }}>AED {Number(viewModal.base_price || 0).toFixed(2)}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${brand.border}` }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Booking Slot</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: brand.navy, marginTop: 2 }}>#{viewModal.display_order || '—'}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${brand.border}` }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bookings Count</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: brand.navy, marginTop: 2 }}>{viewModal.bookings_count || 0}</div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                            <HoverBtn
                                onClick={() => {
                                    const target = viewModal;
                                    setViewModal(null);
                                    openEdit(target);
                                }}
                                base={{ ...outlineBtnToken, flex: 1, justifyContent: 'center' }}
                                hoverStyle={{ background: '#f1f5f9', borderColor: '#cbd5e1', color: brand.navy, transform: 'translateY(-1px)' }}
                            >
                                Edit Service
                            </HoverBtn>
                            <HoverBtn
                                onClick={() => {
                                    handleToggle(viewModal);
                                    setViewModal(null);
                                }}
                                base={{
                                    ...outlineBtnToken,
                                    flex: 1,
                                    justifyContent: 'center',
                                    borderColor: viewModal.status === 'active' ? '#fca5a5' : '#cbd5e1',
                                    color: viewModal.status === 'active' ? '#dc2626' : brand.navy,
                                }}
                                hoverStyle={{
                                    background: viewModal.status === 'active' ? '#fef2f2' : '#f8fafc',
                                    transform: 'translateY(-1px)'
                                }}
                            >
                                {viewModal.status === 'active' ? 'Deactivate' : 'Activate'}
                            </HoverBtn>
                            <HoverBtn
                                onClick={() => setViewModal(null)}
                                base={{ ...solidBtnToken, flex: 1, justifyContent: 'center' }}
                                hoverStyle={{ opacity: 0.88, transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(10,35,66,0.3)' }}
                            >
                                Close
                            </HoverBtn>
                        </div>
                    </div>
                </Overlay>
            )}

            {/* Delete Modal */}
            {deleteModal && (
                <Overlay onClose={() => setDeleteModal(null)}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 50, height: 50, borderRadius: 14, background: '#fee2e2',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 14px', color: '#dc2626',
                        }}>
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
                            </svg>
                        </div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: brand.navy, margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Delete Service?</h3>
                        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
                            Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <HoverBtn onClick={() => setDeleteModal(null)} base={outlineBtnToken} hoverStyle={{ background: '#f1f5f9', borderColor: '#cbd5e1', color: brand.navy }}>Cancel</HoverBtn>
                            <HoverBtn onClick={handleDelete} base={{ ...solidBtnToken, background: '#dc2626' }} hoverStyle={{ opacity: 0.9, transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>Delete</HoverBtn>
                        </div>
                    </div>
                </Overlay>
            )}

            {/* Add / Edit Modal */}
            {formModal !== null && (
                <Overlay onClose={() => setFormModal(null)} title={formModal === 'add' ? 'Add New Service' : 'Edit Service'}>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <FieldGroup label="Service Name" required>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Villa Deep Cleaning" style={inputStyleToken} />
                        </FieldGroup>
                        <FieldGroup label="Category" required>
                            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyleToken}>
                                <option value="residential">Residential</option>
                                <option value="commercial">Commercial</option>
                                <option value="specialized">Specialized & Deep Care</option>
                                <option value="maintenance">Outdoor & Maintenance</option>
                            </select>
                        </FieldGroup>
                        <FieldGroup label="Description">
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder="Brief description of this cleaning service..." rows={3}
                                style={{ ...inputStyleToken, resize: 'vertical', fontFamily: 'inherit' }} />
                        </FieldGroup>
                        <FieldGroup label="Base Price (AED)">
                            <input type="number" step="0.5" value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })}
                                placeholder="0.00" style={inputStyleToken} />
                        </FieldGroup>
                        <FieldGroup label="Status">
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={selectStyleToken}>
                                <option value="active">Active (Visible on Customer Booking)</option>
                                <option value="inactive">Inactive (Hidden from Customers)</option>
                            </select>
                        </FieldGroup>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                            <HoverBtn type="button" onClick={() => setFormModal(null)} base={{ ...outlineBtnToken, flex: 1, justifyContent: 'center' }} hoverStyle={{ background: '#f1f5f9', borderColor: '#cbd5e1', color: brand.navy }}>Cancel</HoverBtn>
                            <HoverBtn type="submit" disabled={formLoading} base={{ ...solidBtnToken, flex: 1, justifyContent: 'center', opacity: formLoading ? 0.6 : 1 }} hoverStyle={{ opacity: 0.88, transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(10,35,66,0.3)' }}>
                                {formLoading ? 'Saving...' : 'Save Service'}
                            </HoverBtn>
                        </div>
                    </form>
                </Overlay>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={pageTitle}>Services</h1>
                    <p style={pageSubtitle}>Manage services, categories, and customer booking display order</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <HoverBtn
                        onClick={() => setReorderMode((v) => !v)}
                        base={{
                            ...outlineBtnToken,
                            background: reorderMode ? '#f1f5f9' : '#fff',
                            borderColor: reorderMode ? brand.navy : brand.border,
                            color: brand.navy,
                        }}
                        hoverStyle={{
                            background: '#f8fafc',
                            borderColor: '#cbd5e1',
                            transform: 'translateY(-1px)',
                        }}
                        title="Reorder how services appear on customer booking page"
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        {reorderMode ? 'Done Reordering' : 'Reorder Services'}
                        {reordering && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>Saving...</span>}
                    </HoverBtn>
                    <HoverBtn
                        onClick={openAdd}
                        base={solidBtnToken}
                        hoverStyle={{ opacity: 0.88, transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(10,35,66,0.30)' }}
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Service
                    </HoverBtn>
                </div>
            </div>

            {/* Minimal Stat Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
                <MinimalStatCard label="Total Services" value={totalSvcs} />
                <MinimalStatCard label="Active on Booking" value={activeCount} />
                <MinimalStatCard label="Inactive (Hidden)" value={inactiveCount} />
                <MinimalStatCard label="Total Bookings" value={totalBookings} />
            </div>

            {/* Search & Category Tabs */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#fff', border: `1.5px solid ${brand.border}`,
                    borderRadius: 12, padding: '0 12px', flex: 1, minWidth: 240, maxWidth: 360,
                }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search services..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ border: 'none', outline: 'none', padding: '9px 0', fontSize: 13, width: '100%', background: 'transparent', color: brand.navy }}
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'residential', label: 'Residential' },
                        { key: 'commercial', label: 'Commercial' },
                        { key: 'specialized', label: 'Specialized' },
                        { key: 'maintenance', label: 'Maintenance' },
                    ].map((tab) => {
                        const isSelected = categoryFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setCategoryFilter(tab.key)}
                                style={{
                                    padding: '6px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
                                    border: isSelected ? 'none' : `1.5px solid ${brand.border}`,
                                    background: isSelected ? '#0A2342' : '#fff',
                                    color: isSelected ? '#fff' : '#64748b',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table Container */}
            <div style={{ ...card, overflow: 'hidden' }}>
                {/* Reorder Hint */}
                {reorderMode && (
                    <div style={{
                        padding: '10px 18px', background: '#f8fafc',
                        borderBottom: `1px solid ${brand.border}`,
                        fontSize: 12, color: brand.navy, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Reorder mode: drag rows or use ▲ ▼ arrows. Synced directly with customer booking page.</span>
                        </div>
                        {reordering && <span style={{ color: '#64748b', fontSize: 11 }}>Saving order...</span>}
                    </div>
                )}

                {/* Table Header */}
                <div style={{
                    ...thRow,
                    gridTemplateColumns: reorderMode
                        ? '30px 2.6fr 150px 130px 120px 96px'
                        : '2.6fr 150px 130px 120px 96px',
                }}>
                    {reorderMode && <span />}
                    <Th>SERVICE</Th>
                    <Th>CATEGORY</Th>
                    <Th>STARTING RATE</Th>
                    <Th>STATUS</Th>
                    <Th style={{ textAlign: 'right' }}>ACTIONS</Th>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', fontSize: 13 }}>Loading services...</div>
                ) : filteredServices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48 }}>
                        <div style={{ fontWeight: 700, color: brand.navy, fontSize: 14, marginBottom: 4 }}>No services found</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>Try adjusting your search or category filter.</div>
                    </div>
                ) : (
                    <div>
                        {/* 1. Active Services Group */}
                        {activeServices.map((svc, index) => {
                            return (
                                <ServiceRow
                                    key={svc.id}
                                    svc={svc}
                                    index={index}
                                    reorderMode={reorderMode}
                                    onDragStart={handleDragStart}
                                    onDragEnter={handleDragEnter}
                                    onDragEnd={handleDragEnd}
                                    onView={() => setViewModal(svc)}
                                    onEdit={() => openEdit(svc)}
                                    onDelete={() => setDeleteModal(svc)}
                                    onToggle={() => handleToggle(svc)}
                                    onMoveUp={() => moveService(index, -1)}
                                    onMoveDown={() => moveService(index, 1)}
                                    canMoveUp={index > 0}
                                    canMoveDown={index < sortedServices.length - 1}
                                />
                            );
                        })}

                        {/* 2. Inactive Services Group (Cleanly sits at the bottom) */}
                        {inactiveServices.length > 0 && (
                            <div>
                                <div style={{
                                    padding: '8px 18px', background: '#f8fafc',
                                    borderTop: `1px solid ${brand.border}`, borderBottom: `1px solid ${brand.border}`,
                                    fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} />
                                    <span>Inactive Services ({inactiveServices.length}) — Hidden from customer booking</span>
                                </div>
                                {inactiveServices.map((svc, index) => {
                                    const actualIndex = activeServices.length + index;
                                    return (
                                        <ServiceRow
                                            key={svc.id}
                                            svc={svc}
                                            index={actualIndex}
                                            reorderMode={reorderMode}
                                            onDragStart={handleDragStart}
                                            onDragEnter={handleDragEnter}
                                            onDragEnd={handleDragEnd}
                                            onView={() => setViewModal(svc)}
                                            onEdit={() => openEdit(svc)}
                                            onDelete={() => setDeleteModal(svc)}
                                            onToggle={() => handleToggle(svc)}
                                            onMoveUp={() => moveService(actualIndex, -1)}
                                            onMoveDown={() => moveService(actualIndex, 1)}
                                            canMoveUp={actualIndex > 0}
                                            canMoveDown={actualIndex < sortedServices.length - 1}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Info */}
                <div style={{
                    padding: '12px 18px', borderTop: `1px solid ${brand.border}`,
                    fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span>{filteredServices.length} of {services.length} services ({activeCount} active, {inactiveCount} inactive)</span>
                    <span style={{ color: '#94a3b8' }}>Click any row to view full details & customer preview</span>
                </div>
            </div>
        </div>
    );
}

/* ── Minimal Table Row ─────────────────────────────────────────── */
function ServiceRow({
    svc, index, reorderMode,
    onDragStart, onDragEnter, onDragEnd,
    onView, onEdit, onDelete, onToggle,
    onMoveUp, onMoveDown, canMoveUp, canMoveDown
}) {
    const isActive = svc.status === 'active';

    return (
        <div
            draggable={reorderMode}
            onDragStart={() => onDragStart(index)}
            onDragEnter={() => onDragEnter(index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !reorderMode && onView()}
            style={{
                ...tdRow,
                gridTemplateColumns: reorderMode
                    ? '30px 2.6fr 150px 130px 120px 96px'
                    : '2.6fr 150px 130px 120px 96px',
                cursor: reorderMode ? 'grab' : 'pointer',
                userSelect: reorderMode ? 'none' : 'auto',
                background: !isActive ? '#fafbfc' : '#fff',
                opacity: !isActive ? 0.78 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = !isActive ? '#f1f5f9' : '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = !isActive ? '#fafbfc' : '#fff'}
        >
            {/* Reorder drag handle */}
            {reorderMode && (
                <div style={{ color: '#94a3b8', fontSize: 15, cursor: 'grab', userSelect: 'none' }} title="Drag to reorder">
                    ⠿
                </div>
            )}

            {/* Service Avatar + Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ServiceLetterAvatar name={svc.name} status={svc.status} size={36} />
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: brand.navy }}>{svc.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        Order #{svc.display_order || index + 1}
                    </div>
                </div>
            </div>

            {/* Category */}
            <div>
                <CategoryPill category={svc.category} />
            </div>

            {/* Starting Rate */}
            <div style={{ fontSize: 13, fontWeight: 700, color: brand.navy }}>
                AED {Number(svc.base_price || 0).toFixed(2)}
            </div>

            {/* Status (Clickable Toggle) */}
            <div onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onToggle}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                        border: `1px solid ${isActive ? '#dcfce7' : '#e2e8f0'}`,
                        background: isActive ? '#f0fdf4' : '#f8fafc',
                        color: isActive ? '#166534' : '#64748b',
                        cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    title="Click to toggle active/inactive status"
                >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#16a34a' : '#94a3b8' }} />
                    {isActive ? 'Active' : 'Inactive'}
                </button>
            </div>

            {/* Actions */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}
            >
                {reorderMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 2 }}>
                        <button
                            type="button"
                            onClick={onMoveUp}
                            disabled={!canMoveUp}
                            style={{
                                width: 20, height: 15, borderRadius: 3, border: `1px solid ${brand.border}`,
                                background: !canMoveUp ? '#f8fafc' : '#fff', color: !canMoveUp ? '#cbd5e1' : brand.navy,
                                cursor: !canMoveUp ? 'default' : 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="Move up"
                        >▲</button>
                        <button
                            type="button"
                            onClick={onMoveDown}
                            disabled={!canMoveDown}
                            style={{
                                width: 20, height: 15, borderRadius: 3, border: `1px solid ${brand.border}`,
                                background: !canMoveDown ? '#f8fafc' : '#fff', color: !canMoveDown ? '#cbd5e1' : brand.navy,
                                cursor: !canMoveDown ? 'default' : 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="Move down"
                        >▼</button>
                    </div>
                )}
                <ActionBtn title="View" onClick={onView} icon={eyeIcon} />
                <ActionBtn title="Edit" onClick={onEdit} icon={editIcon} />
                <ActionBtn title="Delete" danger onClick={onDelete} icon={trashIcon} />
            </div>
        </div>
    );
}

/* ── Minimal Sub-components ─────────────────────────── */

function MinimalStatCard({ label, value }) {
    return (
        <div style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: brand.navy, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</span>
        </div>
    );
}

function Overlay({ children, onClose, title }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,20,41,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 26, width: 460, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(10,35,66,0.18)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: title ? 16 : 0 }}>
                    {title && <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: brand.navy, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>}
                    <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 4, lineHeight: 1 }}>✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function FieldGroup({ label, required, children }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
                {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
            </label>
            {children}
        </div>
    );
}

function Th({ children, style }) {
    return <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, ...style }}>{children}</span>;
}

function HoverBtn({ children, onClick, base, hoverStyle, type = 'button', disabled = false, title }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            type={type}
            title={title}
            disabled={disabled}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ ...base, ...(hovered && !disabled ? hoverStyle : {}), transition: 'all 0.15s' }}
        >
            {children}
        </button>
    );
}

function ActionBtn({ title, onClick, icon, danger }) {
    const [hovered, setHovered] = useState(false);
    const isView = title === 'View';
    const bgHover = danger ? '#fef2f2' : isView ? '#f1f5f9' : '#f1f5f9';
    const borderHover = danger ? '#fecaca' : '#cbd5e1';
    const textHover = danger ? '#dc2626' : brand.navy;
    return (
        <button
            title={title}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: 28, height: 28, borderRadius: 8,
                border: `1.5px solid ${hovered ? borderHover : brand.border}`,
                background: hovered ? bgHover : '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hovered ? textHover : '#64748b',
                transition: 'all 0.15s',
                transform: hovered ? 'translateY(-1px)' : 'none',
                boxShadow: hovered ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
            }}
        >{icon}</button>
    );
}

const thRow = {
    display: 'grid',
    padding: '11px 18px', borderBottom: `1px solid ${brand.border}`, background: brand.softBg,
    alignItems: 'center', gap: 12,
};
const tdRow = {
    display: 'grid',
    padding: '12px 18px', borderBottom: '1px solid #f1f5f9',
    alignItems: 'center', gap: 12, transition: 'background 0.15s',
};

const eyeIcon = <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const editIcon = <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const trashIcon = <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>;
