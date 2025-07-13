import React, { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { authFetch } from '../api/authFetch';
import './Admin.css';
import './Dashboard.css';

// --- ลงทะเบียน components ทั้งหมดของ Chart.js ---
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- Component สำหรับการ์ดสรุปผล ---
const StatCard = ({ title, value, icon }) => (
    <div className="stat-card">
        <div className="stat-icon">{icon}</div>
        <div className="stat-info">
            <p>{title}</p>
            <h3>{value}</h3>
        </div>
    </div>
);

function DashboardPage() {
    const [revenueData, setRevenueData] = useState(null);
    const [therapistData, setTherapistData] = useState(null);
    const [summaryStats, setSummaryStats] = useState({ totalRevenue: 0, totalBookings: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState('all');

    const availableYears = [2023, 2024, 2025, 2026];
    const months = [
        { value: 'all', label: 'All Months' }, { value: 1, label: 'January' },
        { value: 2, label: 'February' }, { value: 3, label: 'March' },
        { value: 4, label: 'April' }, { value: 5, label: 'May' },
        { value: 6, label: 'June' }, { value: 7, label: 'July' },
        { value: 8, label: 'August' }, { value: 9, label: 'September' },
        { value: 10, label: 'October' }, { value: 11, label: 'November' },
        { value: 12, label: 'December' },
    ];

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const revenueParams = new URLSearchParams({ year: selectedYear });
            const performanceParams = new URLSearchParams({ year: selectedYear });
            if (selectedMonth !== 'all') {
                performanceParams.append('month', selectedMonth);
            }

            const [revenueRes, therapistRes] = await Promise.all([
                authFetch(`/api/reports/revenue-summary?${revenueParams.toString()}`),
                authFetch(`/api/reports/therapist-performance?${performanceParams.toString()}`)
            ]);

            if (!revenueRes.ok || !therapistRes.ok) throw new Error('Failed to fetch dashboard data');

            const revenueJson = await revenueRes.json();
            const therapistJson = await therapistRes.json();

            // --- ประมวลผลข้อมูลสำหรับกราฟแท่ง (รายได้รายเดือน) ---
            const revenueLabels = revenueJson.map(item => `${item.year}-${String(item.month).padStart(2, '0')}`);
            const revenueValues = revenueJson.map(item => item.total_revenue);
            setRevenueData({
                labels: revenueLabels,
                datasets: [{
                    label: `Monthly Revenue (${selectedYear})`,
                    data: revenueValues,
                    backgroundColor: 'rgba(46, 204, 113, 0.6)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 1,
                }]
            });

            // --- ประมวลผลข้อมูลสำหรับกราฟแท่งแนวนอน (ผลงานพนักงาน) ---
            const therapistLabels = therapistJson.map(item => item.therapist_name);
            const therapistRevenueValues = therapistJson.map(item => item.total_revenue);
            setTherapistData({
                labels: therapistLabels,
                datasets: [{
                    label: 'Revenue by Therapist (€)',
                    data: therapistRevenueValues,
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1,
                }]
            });

            // --- คำนวณข้อมูลสรุปในการ์ด ---
            const totalRevenue = therapistJson.reduce((sum, current) => sum + parseFloat(current.total_revenue), 0);
            const totalBookings = therapistJson.reduce((sum, current) => sum + parseInt(current.booking_count, 10), 0);
            setSummaryStats({
                totalRevenue: totalRevenue.toFixed(2),
                totalBookings
            });

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Options สำหรับกราฟแท่งแนวนอน ---
    const horizontalBarOptions = {
        indexAxis: 'y', // ★ ทำให้แกนหลักเป็นแกน Y (แนวนอน)
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Revenue by Therapist',
            },
        },
    };

    if (isLoading) {
        return <div className="admin-card"><h2>Loading Dashboard...</h2></div>;
    }

    return (
        <div>
            <h1>Dashboard</h1>

            {/* Filter Controls */}
            <div className="admin-card dashboard-filters">
                <select className="admin-form-input" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <select className="admin-form-input" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                    {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="stats-container">
                <StatCard title="Total Revenue" value={`€ ${summaryStats.totalRevenue}`} icon="💰" />
                <StatCard title="Total Bookings" value={summaryStats.totalBookings} icon="📅" />
            </div>

            {/* Charts */}
            <div className="charts-container">
                <div className="admin-card chart-card">
                    <h3>Monthly Revenue</h3>
                    {revenueData && <Bar data={revenueData} />}
                </div>
                <div className="admin-card chart-card">
                    <h3>Therapist Performance</h3>
                    {/* ★ เปลี่ยนเป็น Bar และใช้ options ใหม่ */}
                    {therapistData && <Bar options={horizontalBarOptions} data={therapistData} />}
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;