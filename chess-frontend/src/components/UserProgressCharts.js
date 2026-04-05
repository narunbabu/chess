import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { eachDayOfInterval, parseISO, format, subDays } from 'date-fns';
import { BACKEND_URL } from '../config';

const CHART_COLORS = {
  green: '#81b64c',
  amber: '#e8a93e',
  red: '#e74c3c',
  grid: '#464340',
  axis: '#9b9895',
  bg: '#312e2b',
  border: '#464340',
  text: '#bababa',
};

const tooltipStyle = {
  backgroundColor: CHART_COLORS.bg,
  border: `1px solid ${CHART_COLORS.border}`,
  color: CHART_COLORS.text,
  borderRadius: 6,
  fontSize: 12,
};

function formatXAxis(dateStr, period) {
  if (!dateStr) return '';
  const d = parseISO(dateStr);
  if (period === '7d' || period === 'today') return format(d, 'EEE');
  if (period === '30d') return format(d, 'MMM d');
  return format(d, "MMM ''yy");
}

function fillDateGaps(sparseData, period, defaults) {
  if (!sparseData || sparseData.length === 0) return [];
  const today = new Date();
  const start =
    period === 'today' ? today
    : period === '7d' ? subDays(today, 7)
    : period === '30d' ? subDays(today, 30)
    : parseISO(sparseData[0].date);

  const days = eachDayOfInterval({ start, end: today });
  const dataMap = new Map(sparseData.map(d => [d.date, d]));

  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return dataMap.get(dateStr) || { date: dateStr, ...defaults };
  });
}

function fillRatingGaps(sparseData, period) {
  const filled = fillDateGaps(sparseData, period, { rating: null, change: 0, games: 0 });
  let lastRating = null;
  return filled.map(d => {
    if (d.rating !== null) { lastRating = d.rating; return d; }
    return { ...d, rating: lastRating };
  }).filter(d => d.rating !== null);
}

const UserProgressCharts = ({ userId, period }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${BACKEND_URL}/admin/dashboard/user/${userId}/progress?period=${period}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        Accept: 'application/json',
      },
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load progress data');
        return r.json();
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, period]);

  const ratingData = useMemo(
    () => data ? fillRatingGaps(data.rating_progression, period) : [],
    [data, period]
  );
  const pointsData = useMemo(
    () => data ? fillDateGaps(data.points_per_day, period, { points: 0, lost: 0, games: 0 }) : [],
    [data, period]
  );
  const gamesData = useMemo(
    () => data ? fillDateGaps(data.games_per_day, period, { total: 0, wins: 0, draws: 0, losses: 0 }) : [],
    [data, period]
  );

  if (loading) return (
    <div className="text-center py-6">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#81b64c] mx-auto" />
    </div>
  );
  if (error) return (
    <div className="text-[#e74c3c] text-xs text-center py-4">{error}</div>
  );
  if (!data) return null;

  const noData = ratingData.length === 0 && pointsData.length === 0 && gamesData.length === 0;
  if (noData) return (
    <div className="text-[#9b9895] text-xs text-center py-4">No game data for this period.</div>
  );

  const tickFormatter = (dateStr) => formatXAxis(dateStr, period);
  const xAxisProps = {
    dataKey: 'date',
    stroke: CHART_COLORS.axis,
    tick: { fontSize: 10 },
    tickFormatter,
    tickLine: false,
  };
  const yAxisProps = {
    stroke: CHART_COLORS.axis,
    tick: { fontSize: 10 },
    tickLine: false,
    axisLine: false,
  };
  const gridProps = { strokeDasharray: '3 3', stroke: CHART_COLORS.grid };

  return (
    <div className="space-y-4 mt-3">
      {/* Rating Progression */}
      {ratingData.length > 0 && (
        <div className="bg-[#262421] rounded p-3">
          <h4 className="text-xs font-semibold text-white mb-2">Rating Progression</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ratingData}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={tickFormatter} />
              <Line
                type="monotone"
                dataKey="rating"
                stroke={CHART_COLORS.green}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.green, r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rating Points Per Day */}
      {pointsData.length > 0 && (
        <div className="bg-[#262421] rounded p-3">
          <h4 className="text-xs font-semibold text-white mb-2">Rating Points Per Day</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pointsData}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={tickFormatter} />
              <Legend wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis }} />
              <Bar dataKey="points" stackId="a" fill={CHART_COLORS.green} name="Gained" />
              <Bar dataKey="lost" stackId="a" fill={CHART_COLORS.red} name="Lost" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Games Played Per Day */}
      {gamesData.length > 0 && (
        <div className="bg-[#262421] rounded p-3">
          <h4 className="text-xs font-semibold text-white mb-2">Games Played Per Day</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gamesData}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={tickFormatter} />
              <Legend wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis }} />
              <Bar dataKey="wins" stackId="a" fill={CHART_COLORS.green} name="Wins" />
              <Bar dataKey="draws" stackId="a" fill={CHART_COLORS.amber} name="Draws" />
              <Bar dataKey="losses" stackId="a" fill={CHART_COLORS.red} name="Losses" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default UserProgressCharts;
