import api from './api';

const BASE = '/incharge';

// Helper: build ?from=&to= query string from dateRange
const drParams = (dr = {}) => {
    const p = new URLSearchParams();
    if (dr.from) p.append('from', dr.from);
    if (dr.to)   p.append('to',   dr.to);
    return p.toString() ? `?${p.toString()}` : '';
};

export const fetchOverview                    = ()             => api.get(`${BASE}/overview`).then(r => r.data);
export const fetchComplaintAnalytics          = (days=30, dr={}) => {
    const p = new URLSearchParams({ days });
    if (dr.from) p.append('from', dr.from);
    if (dr.to)   p.append('to',   dr.to);
    return api.get(`${BASE}/complaint-analytics?${p.toString()}`).then(r => r.data);
};
export const fetchStaffPerformance            = ()             => api.get(`${BASE}/staff-performance`).then(r => r.data);
export const fetchWardenPerformance           = ()             => api.get(`${BASE}/warden-performance`).then(r => r.data);
export const fetchRoomAnalytics               = ()             => api.get(`${BASE}/room-analytics`).then(r => r.data);
export const fetchStudentAnalytics            = ()             => api.get(`${BASE}/student-analytics`).then(r => r.data);
export const fetchRepeatAnalysis              = ()             => api.get(`${BASE}/repeat-analysis`).then(r => r.data);
export const fetchKPIs                        = ()             => api.get(`${BASE}/kpis`).then(r => r.data);
export const fetchPredictive                  = ()             => api.get(`${BASE}/predictive`).then(r => r.data);
export const fetchMaintenance                 = ()             => api.get(`${BASE}/maintenance`).then(r => r.data);
export const fetchHeatmap                     = (dr={})        => api.get(`${BASE}/heatmap${drParams(dr)}`).then(r => r.data);
export const fetchStudentComplaintCorrelation = ()             => api.get(`${BASE}/student-complaint-correlation`).then(r => r.data);
export const fetchMonthlyTrend                = ()             => api.get(`${BASE}/monthly-trend`).then(r => r.data);
export const fetchSLABreaches                 = (h=48)         => api.get(`${BASE}/sla-breaches?hours=${h}`).then(r => r.data);
export const fetchComparison                  = ()             => api.get(`${BASE}/comparison`).then(r => r.data);
export const fetchTopComplainers              = ()             => api.get(`${BASE}/top-complainers`).then(r => r.data);
export const fetchDrillDown                   = (params)       => api.get(`${BASE}/drill-down`, { params }).then(r => r.data);
export const fetchKanban                      = (dr={})        => api.get(`${BASE}/kanban${drParams(dr)}`).then(r => r.data);
export const fetchAnnouncements               = ()             => api.get(`${BASE}/announcements`).then(r => r.data);
export const postAnnouncement                 = (data)         => api.post(`${BASE}/announcements`, data).then(r => r.data);
export const deleteAnnouncementById           = (id)           => api.delete(`${BASE}/announcements/${id}`).then(r => r.data);
