import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchOverview, fetchComplaintAnalytics, fetchStaffPerformance,
    fetchWardenPerformance, fetchRoomAnalytics, fetchStudentAnalytics,
    fetchRepeatAnalysis, fetchKPIs, fetchPredictive, fetchMaintenance,
    fetchHeatmap, fetchStudentComplaintCorrelation, fetchMonthlyTrend,
    fetchSLABreaches, fetchComparison, fetchTopComplainers, fetchDrillDown,
    fetchKanban, fetchAnnouncements, postAnnouncement, deleteAnnouncementById
} from '../services/inchargeApi';

const STALE = 60_000;

// dr = dateRange { from, to } — used as part of query key so React Query re-fetches when range changes
export const useOverview                    = ()           => useQuery({ queryKey: ['inc-overview'],               queryFn: fetchOverview,                                 staleTime: STALE });
export const useComplaintAnalytics          = (days=30, dr={}) => useQuery({ queryKey: ['inc-analytics', days, dr.from, dr.to], queryFn: () => fetchComplaintAnalytics(days, dr), staleTime: STALE });
export const useStaffPerformance            = ()           => useQuery({ queryKey: ['inc-staff'],                  queryFn: fetchStaffPerformance,                         staleTime: STALE });
export const useWardenPerformance           = ()           => useQuery({ queryKey: ['inc-warden'],                 queryFn: fetchWardenPerformance,                        staleTime: STALE });
export const useRoomAnalytics               = ()           => useQuery({ queryKey: ['inc-rooms'],                  queryFn: fetchRoomAnalytics,                            staleTime: STALE });
export const useStudentAnalytics            = ()           => useQuery({ queryKey: ['inc-students'],               queryFn: fetchStudentAnalytics,                         staleTime: STALE });
export const useRepeatAnalysis              = ()           => useQuery({ queryKey: ['inc-repeat'],                 queryFn: fetchRepeatAnalysis,                           staleTime: STALE });
export const useKPIs                        = ()           => useQuery({ queryKey: ['inc-kpis'],                   queryFn: fetchKPIs,                                     staleTime: STALE });
export const usePredictive                  = ()           => useQuery({ queryKey: ['inc-predictive'],             queryFn: fetchPredictive,                               staleTime: STALE });
export const useMaintenance                 = ()           => useQuery({ queryKey: ['inc-maintenance'],            queryFn: fetchMaintenance,                              staleTime: STALE });
export const useHeatmap                     = (dr={})      => useQuery({ queryKey: ['inc-heatmap', dr.from, dr.to], queryFn: () => fetchHeatmap(dr),                      staleTime: STALE });
export const useStudentComplaintCorrelation = ()           => useQuery({ queryKey: ['inc-correlation'],            queryFn: fetchStudentComplaintCorrelation,              staleTime: STALE });
export const useMonthlyTrend                = ()           => useQuery({ queryKey: ['inc-monthly'],                queryFn: fetchMonthlyTrend,                             staleTime: STALE });
export const useSLABreaches                 = (h=48)       => useQuery({ queryKey: ['inc-sla', h],                 queryFn: () => fetchSLABreaches(h),                     staleTime: 30_000 });
export const useComparison                  = ()           => useQuery({ queryKey: ['inc-comparison'],             queryFn: fetchComparison,                               staleTime: STALE });
export const useTopComplainers              = ()           => useQuery({ queryKey: ['inc-top-complainers'],        queryFn: fetchTopComplainers,                           staleTime: STALE });
export const useDrillDown                   = (params)     => useQuery({ queryKey: ['inc-drill', params],          queryFn: () => fetchDrillDown(params),                  staleTime: 15_000, enabled: !!params && Object.keys(params).length > 0 });
export const useKanban                      = (dr={})      => useQuery({ queryKey: ['inc-kanban', dr.from, dr.to], queryFn: () => fetchKanban(dr),                         staleTime: 30_000 });
export const useAnnouncements               = ()           => useQuery({ queryKey: ['inc-announcements'],          queryFn: fetchAnnouncements,                            staleTime: 30_000 });

export const useCreateAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: postAnnouncement,
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['inc-announcements'] })
    });
};

export const useDeleteAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteAnnouncementById,
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['inc-announcements'] })
    });
};

// Refetch all inc-* queries
export const useRefreshAll = () => {
    const qc = useQueryClient();
    return () => {
        const keys = [
            'inc-overview','inc-analytics','inc-staff','inc-warden','inc-rooms',
            'inc-students','inc-repeat','inc-kpis','inc-predictive','inc-maintenance',
            'inc-heatmap','inc-correlation','inc-monthly','inc-sla','inc-comparison',
            'inc-top-complainers','inc-drill','inc-kanban','inc-announcements'
        ];
        keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    };
};
