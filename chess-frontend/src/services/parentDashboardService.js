// src/services/parentDashboardService.js
//
// Client for the parent dashboard / "My Kids" report-card endpoints.
// Backend routes live under /api/parent/* (see routes/api.php + api_v1.php).
// The shared `api` instance already prefixes the base URL with /api and
// attaches the bearer token.

import api from "./api";

const parentDashboardService = {
  /**
   * Full dashboard payload for the signed-in guardian:
   * { children: [...report cards], pending_children: [...], pending_guardian_requests: [...] }
   */
  async getDashboard() {
    const res = await api.get("/parent/children");
    return res.data?.data ?? res.data;
  },

  /**
   * Invite/link a child account by email. Returns the relationship payload.
   */
  async requestLink({ childEmail, relationshipLabel } = {}) {
    const res = await api.post("/parent/children/invitations", {
      child_email: childEmail,
      relationship_label: relationshipLabel || null,
    });
    return res.data?.data ?? res.data;
  },

  /**
   * Accept a pending guardian link (called by the child account).
   */
  async acceptLink(relationshipId) {
    const res = await api.post(`/parent/children/${relationshipId}/accept`);
    return res.data?.data ?? res.data;
  },

  /**
   * Revoke/cancel a link (guardian or child may call).
   */
  async revokeLink(relationshipId) {
    const res = await api.delete(`/parent/children/${relationshipId}`);
    return res.data?.data ?? res.data;
  },

  /**
   * Detailed weekly report card for a single linked child.
   */
  async getChildReport(relationshipId) {
    const res = await api.get(`/parent/children/${relationshipId}`);
    return res.data?.data ?? res.data;
  },

  /**
   * Queue an on-demand weekly report email for a linked child.
   */
  async sendWeeklyReport(relationshipId) {
    const res = await api.post(`/parent/children/${relationshipId}/weekly-report`);
    return res.data;
  },

  /**
   * Update a linked child's display name and/or password (guardian control).
   */
  async updateChildProfile(relationshipId, { name, password, passwordConfirmation } = {}) {
    const payload = {};
    if (typeof name === "string") payload.name = name;
    if (password) {
      payload.password = password;
      payload.password_confirmation = passwordConfirmation ?? password;
    }
    const res = await api.patch(`/parent/children/${relationshipId}/profile`, payload);
    return res.data?.data ?? res.data;
  },
};

export default parentDashboardService;
