import React from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f43f5e','#a78bfa','#fb923c','#34d399'];

/* ── Daily Trend ── */
export const TrendChart = ({ data = [], title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10"/>
                <XAxis dataKey="date" tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false}
                    tickFormatter={v => v?.slice(5)} interval="preserveStartEnd"/>
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}/>
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#cGrad)" strokeWidth={2}/>
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

/* ── Category Bar Chart ── */
export const CategoryBar = ({ data = [], title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false}/>
                <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false} axisLine={false}/>
                <YAxis dataKey="name" type="category" tick={{ fill:'#94a3b8', fontSize:11 }} width={90} tickLine={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}/>
                <Bar dataKey="count" radius={[0,6,6,0]}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    </div>
);

/* ── Status Donut ── */
export const StatusDonut = ({ data = [], title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie data={data} dataKey="count" nameKey="_id" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}/>
                <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:12 }}>{v}</span>}/>
            </PieChart>
        </ResponsiveContainer>
    </div>
);

/* ── Student Distribution Pie ── */
export const DistributionPie = ({ data = [], dataKey = 'count', nameKey = '_id', title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%"
                    outerRadius={85} paddingAngle={2}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}/>
                <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:12 }}>{v || 'Unknown'}</span>}/>
            </PieChart>
        </ResponsiveContainer>
    </div>
);

/* ── Staff Performance Bar ── */
export const StaffBar = ({ data = [], title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 42)}>
            <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false}/>
                <XAxis type="number" domain={[0,100]} tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v}%`}/>
                <YAxis dataKey="name" type="category" tick={{ fill:'#94a3b8', fontSize:11 }} width={110} tickLine={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}
                    formatter={(v,n) => [`${v}%`, n]}/>
                <Bar dataKey="resolutionRate" name="Resolution Rate" fill="#10b981" radius={[0,6,6,0]}/>
            </BarChart>
        </ResponsiveContainer>
    </div>
);

/* ── Weekly Bar ── */
export const WeeklyBar = ({ data = [], title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10"/>
                <XAxis dataKey="week" tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false}
                    tickFormatter={v => v?.slice(5)}/>
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}/>
                <Bar dataKey="count" fill="#22d3ee" radius={[6,6,0,0]}/>
            </BarChart>
        </ResponsiveContainer>
    </div>
);

/* ── Monthly Created vs Resolved ── */
export const MonthlyChart = ({ data = [], title }) => (
    <div className="inc-chart-box">
        <h3 className="inc-chart-title">{title}</h3>
        <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10"/>
                <XAxis dataKey="label" tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false}/>
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }}/>
                <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:12 }}>{v}</span>}/>
                <Line type="monotone" dataKey="created"  name="Created"  stroke="#f43f5e" strokeWidth={2} dot={{ fill:'#f43f5e', r:3 }}/>
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} dot={{ fill:'#10b981', r:3 }}/>
            </LineChart>
        </ResponsiveContainer>
    </div>
);
