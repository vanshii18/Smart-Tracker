import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const STATUS_OPTIONS = ['Applied', 'Interview', 'Rejected', 'Offer'];

/** True if followUpDate (YYYY-MM-DD) is strictly before today's local calendar date */
function isFollowUpPastToday(followUpDate) {
  const raw = followUpDate && String(followUpDate).trim();
  if (!raw) return false;
  const ymd = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return ymd < today;
}

/** Normalize API date strings to YYYY-MM-DD for <input type="date" /> */
function normalizeDateForInput(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function formatLoadError(err) {
  const status = err.response?.status;
  const apiHint =
    err.code === 'ERR_NETWORK' ||
    err.message === 'Network Error' ||
    !err.response
      ? ' Is the API running? Open a second terminal in the project root and run: npm.cmd start (wait for "Listening on…").'
      : '';

  return (
    err.response?.data?.error ||
    (status === 404
      ? `Not found (${status}). Check that the server has route GET /api/applications.`
      : null) ||
    (status ? `Request failed (${status}).${apiHint}` : null) ||
    `${err.message || 'Could not load applications.'}${apiHint}`
  );
}

export default function App() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('Applied');
  const [dateApplied, setDateApplied] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [activeNav, setActiveNav] = useState('applications');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  const loadApplications = useCallback(async ({ showSpinner } = { showSpinner: true }) => {
    try {
      if (showSpinner) {
        setLoading(true);
        setError(null);
      }
      const { data } = await api.get('/api/applications');
      setApplications(Array.isArray(data) ? data : []);
      if (!showSpinner) {
        setError(null);
      }
    } catch (err) {
      if (showSpinner) {
        setError(formatLoadError(err));
        setApplications([]);
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadApplications({ showSpinner: true });
  }, [loadApplications]);

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    setSubmitError(null);
    setEditingId(null);
    setCompany('');
    setRole('');
    setStatus('Applied');
    setDateApplied('');
    setFollowUpDate('');
  }, []);

  const closePreviewModal = useCallback(() => {
    setPreviewItem(null);
  }, []);

  function openPreviewModal(item) {
    setOpenMenuId(null);
    setPreviewItem(item);
  }

  function openNewApplicationModal() {
    setOpenMenuId(null);
    setPreviewItem(null);
    setEditingId(null);
    setSubmitError(null);
    setCompany('');
    setRole('');
    setStatus('Applied');
    setDateApplied('');
    setFollowUpDate('');
    setCreateModalOpen(true);
  }

  function openEditModal(item) {
    setOpenMenuId(null);
    setPreviewItem(null);
    setSubmitError(null);
    setCompany(item.company || '');
    setRole(item.role || '');
    setStatus(
      STATUS_OPTIONS.includes(item.status) ? item.status : 'Applied'
    );
    setDateApplied(normalizeDateForInput(item.dateApplied));
    setFollowUpDate(normalizeDateForInput(item.followUpDate));
    setEditingId(String(item._id));
    setCreateModalOpen(true);
  }

  useEffect(() => {
    if (openMenuId === null) return undefined;
    function onPointerDown(e) {
      if (e.target.closest('[data-app-row-menu]')) return;
      setOpenMenuId(null);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openMenuId]);

  useEffect(() => {
    if (activeNav !== 'applications') {
      closeCreateModal();
      closePreviewModal();
      setOpenMenuId(null);
    }
  }, [activeNav, closeCreateModal, closePreviewModal]);

  useEffect(() => {
    const overlayOpen = createModalOpen || previewItem;
    if (!overlayOpen) return undefined;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (createModalOpen) closeCreateModal();
      else closePreviewModal();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [
    createModalOpen,
    previewItem,
    closeCreateModal,
    closePreviewModal,
  ]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    const da = dateApplied.trim();
    const fu = followUpDate.trim();
    if (da && fu && fu <= da) {
      setSubmitError('Follow-up date must be after the date applied.');
      return;
    }

    setSubmitting(true);

    const payload = {
      company: company.trim(),
      role: role.trim(),
      status: status.trim() || 'Applied',
      dateApplied: dateApplied.trim(),
      followUpDate: followUpDate.trim(),
    };

    try {
      if (editingId) {
        await api.put(`/api/applications/${editingId}`, payload);
      } else {
        await api.post('/api/applications', payload);
      }

      await loadApplications({ showSpinner: false });
      closeCreateModal();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.details ||
        err.message ||
        'Could not save application.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    const idStr = String(id);
    const confirmed = window.confirm(
      'Are you sure you want to delete this application?'
    );
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingId(idStr);
    try {
      await api.delete(`/api/applications/${idStr}`);
      setApplications((prev) => prev.filter((a) => String(a._id) !== idStr));
    } catch (err) {
      setDeleteError(
        err.response?.data?.error ||
          err.message ||
          'Could not delete application.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  const { total, byStatus, otherCount } = useMemo(() => {
    const byStatus = Object.fromEntries(
      STATUS_OPTIONS.map((s) => [s, 0])
    );
    let otherCount = 0;
    for (const a of applications) {
      if (STATUS_OPTIONS.includes(a.status)) {
        byStatus[a.status] += 1;
      } else {
        otherCount += 1;
      }
    }
    return { total: applications.length, byStatus, otherCount };
  }, [applications]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Job Tracker</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <button
            type="button"
            className={
              activeNav === 'dashboard'
                ? 'nav-item nav-item--active'
                : 'nav-item'
            }
            onClick={() => setActiveNav('dashboard')}
          >
            Dashboard
          </button>

          <button
            type="button"
            className={
              activeNav === 'applications'
                ? 'nav-item nav-item--active'
                : 'nav-item'
            }
            onClick={() => setActiveNav('applications')}
          >
            Applications
          </button>
        </nav>
      </aside>

      <main className="main">
        <div
          className={
            activeNav === 'dashboard' ? 'main-inner' : 'main-inner main-inner--wide'
          }
        >
          {activeNav === 'dashboard' && (
            <>
              <h1 className="title">Dashboard</h1>
              {loading && <p className="muted">Loading…</p>}
              {error && <p className="error">{error}</p>}
              {!loading && !error && (
                <section className="dashboard" aria-labelledby="dashboard-heading">
                  <h2 id="dashboard-heading" className="dashboard-title">
                    Overview
                  </h2>
                  <p className="dashboard-total">
                    <span className="dashboard-total-number">{total}</span>
                    <span className="dashboard-total-label">
                      {' '}
                      total application{total !== 1 ? 's' : ''}
                    </span>
                  </p>
                  <div className="dashboard-grid">
                    {STATUS_OPTIONS.map((s) => (
                      <div key={s} className="dashboard-stat">
                        <span className="dashboard-stat-value">{byStatus[s]}</span>
                        <span className="dashboard-stat-label">{s}</span>
                      </div>
                    ))}
                    {otherCount > 0 && (
                      <div className="dashboard-stat dashboard-stat-other">
                        <span className="dashboard-stat-value">{otherCount}</span>
                        <span className="dashboard-stat-label">Other</span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {activeNav === 'applications' && (
            <>
              <header className="page-header">
                <h1 className="title">Applications</h1>
                <button
                  type="button"
                  className="button"
                  onClick={openNewApplicationModal}
                >
                  New application
                </button>
              </header>

              {loading && <p className="muted">Loading…</p>}
              {error && <p className="error">{error}</p>}

              {deleteError && <p className="error">{deleteError}</p>}

              {!loading && !error && applications.length === 0 && (
                <p className="muted">No applications yet.</p>
              )}

              {!loading && !error && applications.length > 0 && (
                <ul className="list">
                  {applications.map((item) => {
                    const idStr = String(item._id);
                    const busyDelete = deletingId === idStr;
                    const menuOpen = openMenuId === idStr;
                    const followUpNeeded = isFollowUpPastToday(
                      item.followUpDate
                    );

                    return (
                      <li
                        key={idStr}
                        className={
                          followUpNeeded
                            ? 'list-item list-item--followup-needed'
                            : 'list-item'
                        }
                      >
                        <div className="list-item-body">
                          <span className="company">{item.company}</span>
                          <span className="role">{item.role}</span>
                          {followUpNeeded && (
                            <span className="followup-badge">
                              Follow up needed
                            </span>
                          )}
                        </div>
                        <div
                          className="row-menu"
                          data-app-row-menu
                        >
                          <button
                            type="button"
                            className="menu-trigger"
                            aria-label={`Actions for ${item.company}`}
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            disabled={busyDelete}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((prev) =>
                                prev === idStr ? null : idStr
                              );
                            }}
                          >
                            <span className="menu-trigger-dots" aria-hidden>
                              ⋮
                            </span>
                          </button>
                          {menuOpen && (
                            <ul
                              className="menu-dropdown"
                              role="menu"
                            >
                              <li role="none">
                                <button
                                  type="button"
                                  className="menu-item"
                                  role="menuitem"
                                  onClick={() => openPreviewModal(item)}
                                >
                                  Preview
                                </button>
                              </li>
                              <li role="none">
                                <button
                                  type="button"
                                  className="menu-item"
                                  role="menuitem"
                                  onClick={() => openEditModal(item)}
                                >
                                  Update
                                </button>
                              </li>
                              <li role="none">
                                <button
                                  type="button"
                                  className="menu-item menu-item--danger"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleDelete(item._id);
                                  }}
                                >
                                  Delete
                                </button>
                              </li>
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </main>

      {activeNav === 'applications' && createModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeCreateModal}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <button
                type="button"
                className="modal-back"
                onClick={closeCreateModal}
                aria-label="Go back"
              >
                <svg
                  className="modal-back-icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="modal-title" className="modal-title">
                {editingId ? 'Update' : 'New application'}
              </h2>
              <span className="modal-header-spacer" aria-hidden />
            </header>

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-body">
                <label className="field">
                  <span className="label">Company</span>
                  <input
                    className="input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    autoComplete="organization"
                  />
                </label>

                <label className="field">
                  <span className="label">Role</span>
                  <input
                    className="input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>

                <label className="field">
                  <span className="label">Status</span>
                  <select
                    className="select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">Date applied</span>
                  <input
                    className="input"
                    type="date"
                    value={dateApplied}
                    onChange={(e) => setDateApplied(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="label">Follow-up date</span>
                  <input
                    className="input"
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </label>

                {submitError && <p className="error">{submitError}</p>}
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={closeCreateModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button className="button" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {activeNav === 'applications' && previewItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closePreviewModal}
        >
          <div
            className="modal modal--preview"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <button
                type="button"
                className="modal-back"
                onClick={closePreviewModal}
                aria-label="Close"
              >
                <svg
                  className="modal-back-icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="preview-title" className="modal-title">
                Preview
              </h2>
              <span className="modal-header-spacer" aria-hidden />
            </header>

            <div className="modal-body preview-body">
              <dl className="preview-dl">
                <dt>Company</dt>
                <dd>{previewItem.company?.trim() || '—'}</dd>
                <dt>Role</dt>
                <dd>{previewItem.role?.trim() || '—'}</dd>
                <dt>Status</dt>
                <dd>{previewItem.status?.trim() || '—'}</dd>
                <dt>Date applied</dt>
                <dd>
                  {normalizeDateForInput(previewItem.dateApplied) || '—'}
                </dd>
                <dt>Follow-up date</dt>
                <dd>
                  {normalizeDateForInput(previewItem.followUpDate) || '—'}
                </dd>
              </dl>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="button"
                onClick={closePreviewModal}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
