import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';
import { isPlatformAdmin, isOrganizationAdmin } from '../utils/permissionHelpers';

const ORG_TYPES = [
  { value: 'club', label: 'Club' },
  { value: 'school', label: 'School' },
  { value: 'federation', label: 'Federation' },
  { value: 'company', label: 'Company' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS = {
  club: '#81b64c',
  school: '#5ba4cf',
  federation: '#e8a93e',
  company: '#9b59b6',
  community: '#e74c3c',
  other: '#9b9895',
};

const ROLE_STYLES = {
  platform_admin: 'bg-[#e8a93e]/20 text-[#e8a93e]',
  organization_admin: 'bg-[#81b64c]/20 text-[#81b64c]',
  member: 'bg-[#5ba4cf]/20 text-[#5ba4cf]',
};

const STATUS_STYLES = {
  pending: 'bg-[#e8a93e]/20 text-[#e8a93e]',
  accepted: 'bg-[#81b64c]/20 text-[#81b64c]',
  rejected: 'bg-red-900/20 text-red-400',
  cancelled: 'bg-[#464340] text-[#9b9895]',
  expired: 'bg-[#464340] text-[#9b9895]',
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const OrganizationDashboard = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [orgInvitations, setOrgInvitations] = useState([]);
  const [myInvitations, setMyInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    type: 'club',
    contact_email: '',
    website: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  const canCreate = isPlatformAdmin(user) || isOrganizationAdmin(user);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/organizations`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const orgs = json.data || json;
      setOrganizations(Array.isArray(orgs) ? orgs : []);

      if (user?.organization_id) {
        const userOrg = (Array.isArray(orgs) ? orgs : []).find(o => o.id === user.organization_id);
        if (userOrg) setSelectedOrg(userOrg);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id]);

  const fetchMyInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/organizations/my-invitations`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      setMyInvitations(json.invitations || []);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => { fetchOrganizations(); fetchMyInvitations(); }, [fetchOrganizations, fetchMyInvitations]);

  const fetchMembers = useCallback(async (orgId) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/organizations/${orgId}/members`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMembers(json.members?.data || json.members || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const fetchOrgInvitations = useCallback(async (orgId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/organizations/${orgId}/invitations`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      const inv = json.invitations?.data || json.invitations || [];
      setOrgInvitations(Array.isArray(inv) ? inv : []);
    } catch {
      setOrgInvitations([]);
    }
  }, []);

  useEffect(() => {
    if (selectedOrg?.id) {
      fetchMembers(selectedOrg.id);
      fetchOrgInvitations(selectedOrg.id);
    } else {
      setMembers([]);
      setOrgInvitations([]);
    }
  }, [selectedOrg?.id, fetchMembers, fetchOrgInvitations]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreateSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/organizations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!res.ok) {
        const msgs = json.messages
          ? Object.values(json.messages).flat().join(' ')
          : json.error || `HTTP ${res.status}`;
        throw new Error(msgs);
      }
      setCreateSuccess('Organization created successfully!');
      setCreateForm({ name: '', description: '', type: 'club', contact_email: '', website: '' });
      setShowCreateForm(false);
      await fetchOrganizations();
      if (json.organization) setSelectedOrg(json.organization);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRemoveMember = async (orgId, userId, userName) => {
    if (!window.confirm(`Remove ${userName} from this organization?`)) return;
    setRemovingMemberId(userId);
    try {
      const res = await fetch(`${BACKEND_URL}/organizations/${orgId}/members/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await fetchMembers(orgId);
      await fetchOrganizations();
    } catch (err) {
      alert(err.message);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setInviteSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/organizations/${selectedOrg.id}/invitations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: inviteEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      await fetchOrgInvitations(selectedOrg.id);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!window.confirm('Cancel this invitation?')) return;
    try {
      const res = await fetch(
        `${BACKEND_URL}/organizations/${selectedOrg.id}/invitations/${invitationId}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to cancel');
      }
      await fetchOrgInvitations(selectedOrg.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAcceptInvitation = async (invitationId) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/organizations/invitations/${invitationId}/accept`,
        { method: 'POST', headers: authHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to accept');
      await fetchMyInvitations();
      await fetchOrganizations();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectInvitation = async (invitationId) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/organizations/invitations/${invitationId}/reject`,
        { method: 'POST', headers: authHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reject');
      await fetchMyInvitations();
    } catch (err) {
      alert(err.message);
    }
  };

  const getRoleBadge = (member) => {
    const roles = member.roles?.map(r => r.name) || [];
    if (roles.includes('platform_admin')) return 'platform_admin';
    if (roles.includes('organization_admin')) return 'organization_admin';
    return 'member';
  };

  const isOrgAdmin = selectedOrg && (isPlatformAdmin(user) || selectedOrg.created_by === user?.id || isOrganizationAdmin(user));

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#262421] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262421] text-[#bababa] p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Organizations</h1>
          <p className="text-[#9b9895] text-sm mt-1">Manage your clubs, schools, and communities</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(null); setCreateSuccess(null); }}
            className="px-4 py-2 rounded bg-[#81b64c] text-white text-sm font-medium hover:bg-[#6da03d] transition shrink-0"
          >
            {showCreateForm ? 'Cancel' : '+ Create Organization'}
          </button>
        )}
      </div>

      {error && <p className="text-red-400 mb-4 text-sm">Error: {error}</p>}

      {createSuccess && (
        <div className="bg-[#81b64c]/20 border border-[#81b64c]/40 text-[#81b64c] rounded px-4 py-2 text-sm mb-4">
          {createSuccess}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-[#312e2b] rounded-lg p-4 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Create New Organization</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#9b9895] mb-1">Name *</label>
              <input
                type="text"
                required
                maxLength={255}
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Chess Club of Bangalore"
                className="w-full bg-[#262421] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9b9895] mb-1">Type *</label>
              <select
                value={createForm.type}
                onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-[#262421] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
              >
                {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9b9895] mb-1">Contact Email *</label>
            <input
              type="email"
              required
              value={createForm.contact_email}
              onChange={e => setCreateForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="admin@example.com"
              className="w-full bg-[#262421] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#9b9895] mb-1">Description</label>
            <textarea
              maxLength={1000}
              rows={3}
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              placeholder="A brief description of your organization..."
              className="w-full bg-[#262421] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#9b9895] mb-1">Website</label>
            <input
              type="url"
              value={createForm.website}
              onChange={e => setCreateForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://example.com"
              className="w-full bg-[#262421] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
            />
          </div>

          {createError && <p className="text-red-400 text-sm">{createError}</p>}

          <button
            type="submit"
            disabled={createSubmitting}
            className="w-full py-2.5 rounded bg-[#81b64c] text-white font-semibold text-sm hover:bg-[#6da03d] disabled:opacity-50 transition"
          >
            {createSubmitting ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      )}

      {/* My Pending Invitations (for invitees) */}
      {myInvitations.length > 0 && (
        <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            Pending Invitations ({myInvitations.length})
          </h2>
          <div className="space-y-3">
            {myInvitations.map(inv => (
              <div key={inv.id} className="bg-[#262421] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#81b64c]/20 flex items-center justify-center text-[#81b64c] text-lg">
                    &#9816;
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {inv.organization?.name || 'Organization'}
                    </p>
                    <p className="text-[#9b9895] text-xs">
                      Invited by {inv.inviter?.name || 'Unknown'} &middot;{' '}
                      {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                    {inv.organization?.type && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded inline-block mt-1"
                        style={{
                          background: `${TYPE_COLORS[inv.organization.type] || '#9b9895'}20`,
                          color: TYPE_COLORS[inv.organization.type] || '#9b9895',
                        }}
                      >
                        {inv.organization.type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAcceptInvitation(inv.id)}
                    className="px-4 py-1.5 rounded bg-[#81b64c] text-white text-sm font-medium hover:bg-[#6da03d] transition"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectInvitation(inv.id)}
                    className="px-4 py-1.5 rounded bg-[#464340] text-[#bababa] text-sm font-medium hover:bg-[#3d3a36] transition"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Org List */}
        <div className="lg:col-span-1">
          <div className="bg-[#312e2b] rounded-lg p-4">
            <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              Your Organizations ({organizations.length})
            </h2>

            {organizations.length === 0 ? (
              <p className="text-[#9b9895] text-sm py-4 text-center">
                No organizations yet.
                {canCreate && ' Create one to get started!'}
              </p>
            ) : (
              <div className="space-y-2">
                {organizations.map(org => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrg(org)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedOrg?.id === org.id
                        ? 'bg-[#81b64c]/15 ring-1 ring-[#81b64c]'
                        : 'bg-[#262421] hover:bg-[#3d3a36]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm truncate">
                        {org.name}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded shrink-0 ml-2"
                        style={{
                          background: `${TYPE_COLORS[org.type] || '#9b9895'}20`,
                          color: TYPE_COLORS[org.type] || '#9b9895',
                        }}
                      >
                        {org.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[#9b9895]">
                        {org.users_count ?? 0} member{(org.users_count ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-[#9b9895]">
                        {org.championships_count ?? 0} event{(org.championships_count ?? 0) !== 1 ? 's' : ''}
                      </span>
                      {!org.is_active && (
                        <span className="text-xs bg-red-900/20 text-red-400 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Org Detail + Members */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedOrg ? (
            <div className="bg-[#312e2b] rounded-lg p-8 text-center">
              <div className="text-4xl mb-3 opacity-30">&#9822;</div>
              <p className="text-[#9b9895]">Select an organization to view details</p>
            </div>
          ) : (
            <>
              {/* Org Detail Card */}
              <div className="bg-[#312e2b] rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedOrg.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: `${TYPE_COLORS[selectedOrg.type] || '#9b9895'}20`,
                          color: TYPE_COLORS[selectedOrg.type] || '#9b9895',
                        }}
                      >
                        {selectedOrg.type}
                      </span>
                      {selectedOrg.slug && (
                        <span className="text-xs text-[#9b9895] font-mono">@{selectedOrg.slug}</span>
                      )}
                    </div>
                  </div>
                  {selectedOrg.is_active ? (
                    <span className="text-xs bg-[#81b64c]/20 text-[#81b64c] px-2 py-0.5 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs bg-red-900/20 text-red-400 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                {selectedOrg.description && (
                  <p className="text-sm text-[#bababa] mb-3">{selectedOrg.description}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatChip label="Members" value={selectedOrg.users_count ?? members.length} />
                  <StatChip label="Events" value={selectedOrg.championships_count ?? 0} />
                  {selectedOrg.contact_email && (
                    <StatChip label="Email" value={selectedOrg.contact_email} small />
                  )}
                  {selectedOrg.website && (
                    <a
                      href={selectedOrg.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#5ba4cf] hover:underline truncate"
                    >
                      Visit Website
                    </a>
                  )}
                </div>
              </div>

              {/* Invite Form (org admins only) */}
              {isOrgAdmin && (
                <div className="bg-[#312e2b] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                    Invite Member
                  </h3>
                  <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={e => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null); }}
                      placeholder="Enter email address to invite"
                      className="flex-1 bg-[#262421] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                    />
                    <button
                      type="submit"
                      disabled={inviteSubmitting}
                      className="px-5 py-2 rounded bg-[#81b64c] text-white text-sm font-medium hover:bg-[#6da03d] disabled:opacity-50 transition shrink-0"
                    >
                      {inviteSubmitting ? 'Sending...' : 'Send Invite'}
                    </button>
                  </form>
                  {inviteError && <p className="text-red-400 text-sm mt-2">{inviteError}</p>}
                  {inviteSuccess && <p className="text-[#81b64c] text-sm mt-2">{inviteSuccess}</p>}
                </div>
              )}

              {/* Pending Invitations List (org admins only) */}
              {isOrgAdmin && orgInvitations.length > 0 && (
                <div className="bg-[#312e2b] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                    Pending Invitations ({orgInvitations.filter(i => i.status === 'pending').length})
                  </h3>
                  <div className="space-y-2">
                    {orgInvitations.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between bg-[#262421] rounded p-3">
                        <div>
                          <p className="text-white text-sm">{inv.email}</p>
                          <p className="text-[#9b9895] text-xs">
                            Invited by {inv.inviter?.name || 'Unknown'} &middot;{' '}
                            {new Date(inv.created_at).toLocaleDateString()}
                            {inv.status === 'pending' && new Date(inv.expires_at) < new Date() && ' (expired)'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[inv.status] || 'bg-[#464340] text-[#9b9895]'}`}>
                            {inv.status}
                          </span>
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => handleCancelInvitation(inv.id)}
                              className="text-xs text-red-400 hover:text-red-300 transition"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="bg-[#312e2b] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                  Members ({members.length})
                </h3>

                {membersLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#81b64c]" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-[#9b9895] text-sm py-4 text-center">No members found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Role</th>
                          <th className="py-2 pr-4 hidden sm:table-cell">Joined</th>
                          {isOrgAdmin && <th className="py-2 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(member => {
                          const role = getRoleBadge(member);
                          const isCreator = member.id === selectedOrg.created_by;
                          return (
                            <tr key={member.id} className="border-b border-[#3d3a36]">
                              <td className="py-2 pr-4">
                                <div className="flex items-center gap-2">
                                  {member.avatar_url ? (
                                    <img
                                      src={member.avatar_url}
                                      alt=""
                                      className="w-6 h-6 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-[#464340] flex items-center justify-center text-xs text-[#9b9895]">
                                      {(member.name || '?')[0].toUpperCase()}
                                    </div>
                                  )}
                                  <span className="text-white">{member.name}</span>
                                  {isCreator && (
                                    <span className="text-xs text-[#e8a93e]">Creator</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 pr-4">
                                <span className={`text-xs px-2 py-0.5 rounded ${ROLE_STYLES[role] || 'bg-[#464340] text-[#9b9895]'}`}>
                                  {role === 'organization_admin' ? 'Org Admin' : role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-[#9b9895] hidden sm:table-cell">
                                {new Date(member.created_at).toLocaleDateString()}
                              </td>
                              {isOrgAdmin && (
                                <td className="py-2 text-right">
                                  {!isCreator && member.id !== user?.id && (
                                    <button
                                      onClick={() => handleRemoveMember(selectedOrg.id, member.id, member.name)}
                                      disabled={removingMemberId === member.id}
                                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition"
                                    >
                                      {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatChip = ({ label, value, small }) => (
  <div className="bg-[#262421] rounded px-3 py-2">
    <p className="text-[#9b9895] text-xs">{label}</p>
    <p className={`text-white font-semibold ${small ? 'text-xs truncate' : 'text-lg'}`}>{value}</p>
  </div>
);

export default OrganizationDashboard;
