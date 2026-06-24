import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { getUserInfoFromToken } from '../../utils/auth';

const WardenPayments = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [customFees, setCustomFees] = useState({});

    const token = localStorage.getItem('login');
    const currentUser = useMemo(() => getUserInfoFromToken(), []);
    const roles = currentUser?.roles;

    const roleNames = useMemo(() => {
        const raw = Array.isArray(roles)
            ? roles.map(r => (typeof r === 'string' ? r : r?.name))
            : [typeof roles === 'string' ? roles : roles?.name];

        return raw.filter(Boolean).map(r => String(r).toLowerCase());
    }, [roles]);

    const isWarden = roleNames.includes('warden');
    const isPrivilegedViewer = roleNames.includes('admin') || roleNames.includes('director');
    const [hostels, setHostels] = useState([]);
    const [selectedHostelId, setSelectedHostelId] = useState('');
    const apiBase = import.meta.env.VITE_APP_API;



    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                setError('Unauthorized: missing token');
                setLoading(false);
                return;
            }


            const apiBase = import.meta.env.VITE_APP_API;
            const paymentsUrl = isWarden
                ? `${apiBase}/warden/payments`
                : isPrivilegedViewer
                    ? `${apiBase}/admin/payments${selectedHostelId ? `?hostelId=${selectedHostelId}` : ''}`
                    : null;

            if (!paymentsUrl) {
                setError('Forbidden: you do not have access to payments');
                setLoading(false);
                return;
            }

            if (isPrivilegedViewer && !isWarden && !selectedHostelId) {
                setPayments([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);



                const payRes = await axios.get(paymentsUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const paymentData = payRes.data.Result || payRes.data.result || [];
                setPayments(paymentData);
            } catch (err) {
                // Provide detailed error information to the UI for troubleshooting
                const serverMsg = err?.response?.data?.Error || err?.response?.data?.message || JSON.stringify(err?.response?.data) || err.message;
                console.error('WardenPayments fetch error', err?.response?.data || err.message);
                setError(`Failed to load payments or students: ${serverMsg}`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, currentUser, isWarden, isPrivilegedViewer, selectedHostelId]);

    // Fetch hostels list for privileged viewers (admin/director) so they can filter payments by hostel
    useEffect(() => {
        if (!isPrivilegedViewer) return;
        const apiBase = import.meta.env.VITE_APP_API;
        const fetchHostels = async () => {
            try {
                const res = await axios.get(`${apiBase}/hostel/get-all-hostels`, { headers: { Authorization: `Bearer ${token}` } });
                const fetchedHostels = res.data.Result || res.data.result || [];
                setHostels(fetchedHostels);
                if (fetchedHostels.length > 0) {
                    setSelectedHostelId(fetchedHostels[0]._id);
                }
            } catch (err) {
                console.error('fetch hostels error', err?.response?.data || err.message);
            }
        };

        fetchHostels();
    }, [isPrivilegedViewer, token]);



    const handleExport = async () => {
        try {
            setLoading(true);
            setError(null);

            const url = isWarden
                ? `${apiBase}/warden/payments/export`
                : `${apiBase}/admin/payments/export${selectedHostelId ? `?hostelId=${selectedHostelId}` : ''}`;

            const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });

            const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
            let filename = 'payments.xlsx';
            const disposition = resp.headers['content-disposition'] || resp.headers['Content-Disposition'] || '';
            const m = disposition.match(/filename\*?=([^;]+)/);
            if (m && m[1]) {
                filename = m[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();
            }

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error('export error', err);
            // If server returned a blob (HTML or error body), try to read it as text for a helpful message
            try {
                const respData = err?.response?.data;
                if (respData && typeof respData.text === 'function') {
                    const txt = await respData.text();
                    setError(txt || err.message || 'Export failed');
                } else {
                    setError(err?.response?.data?.Error || err?.message || 'Export failed');
                }
            } catch (readErr) {
                console.error('error reading export error blob', readErr);
                setError(err?.message || 'Export failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (studentId) => {
        const studentRow = payments.find(p => p.studentId?._id === studentId);
        let fee = customFees[studentId];
        if (fee === undefined) {
            fee = studentRow?.amount || 0;
        }

        if (!fee || String(fee).trim() === '' || Number(fee) <= 0) {
            setError('Please enter a valid Hall Fee amount greater than 0 before marking as paid.');
            return;
        }

        if (!window.confirm("Are you sure you want to mark this hall fee payment as paid?")) return;

        setProcessingId(studentId);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await axios.put(`${import.meta.env.VITE_APP_API}/warden/payments/${studentId}/mark-paid`, { amount: fee }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.Status === 'Success') {
                setSuccessMsg("Payment marked as paid successfully.");
                // Update local state without refetching to be fast
                setPayments(prev => prev.map(p => {
                    if (p.studentId?._id === studentId) {
                        return { ...p, paymentStatus: 'Paid', paidDate: new Date().toISOString(), amount: fee };
                    }
                    return p;
                }));
                
                // Clear success message after 3 seconds
                setTimeout(() => setSuccessMsg(null), 3000);
            } else {
                setError(res.data.Error || 'Failed to mark as paid');
            }
        } catch (err) {
            console.error('mark paid error', err);
            setError(err.response?.data?.Error || 'Failed to mark as paid');
        } finally {
            setProcessingId(null);
        }
    };



    const formatDateOnly = (val) => {
        if (!val) return '-';
        const d = new Date(val);
        if (isNaN(d)) return '-';
        return d.toISOString().split('T')[0];
    };

    if (loading) return <div className="p-4 text-center">Loading...</div>;

    return (
        <div className="mt-8 relative">
            <div className="mb-4 font-semibold text-gray-700 text-2xl">Manage Payments</div>
            {error && <div className="mb-4 p-4 text-red-600 bg-red-50 rounded-lg border border-red-100">{error}</div>}
            {successMsg && <div className="mb-4 p-4 text-green-600 bg-green-50 rounded-lg border border-green-100">{successMsg}</div>}



            {isPrivilegedViewer && (
                <div className="mb-4 flex items-center gap-3">
                    <label className="block text-sm font-medium">Filter by Hostel</label>
                    <select value={selectedHostelId} onChange={e => setSelectedHostelId(e.target.value)} className="px-3 py-2 border rounded">
                        <option value="" disabled>Select a hostel...</option>
                        {hostels.map(h => (
                            <option key={h._id} value={h._id}>{h.name || h.hostelID || h._id}</option>
                        ))}
                    </select>
                </div>
            )}

            {(isWarden || isPrivilegedViewer) && (
                <div className="mb-3 flex justify-end">
                    <button onClick={handleExport} className="px-4 py-2 bg-[#6b0f14] text-white rounded">Export Excel</button>
                </div>
            )}

            <div className="overflow-x-auto rounded-2xl shadow-lg bg-white">
                <table className="min-w-full text-sm text-left text-gray-600">
                    <thead className="text-xs uppercase bg-[#fdf6e3] text-[#6b0f14]">
                        <tr>
                            <th className="px-6 py-3">No</th>
                            <th className="px-6 py-3">Enrollment No</th>
                            <th className="px-6 py-3">Hostel</th>
                            <th className="px-6 py-3">Room No</th>
                            <th className="px-6 py-3">Hall Fee</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Date</th>
                            {isWarden && <th className="px-6 py-3">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {payments.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                                    No payment records found
                                </td>
                            </tr>
                        ) : (
                            payments.map((p, idx) => {
                                const isPaid = p.paymentStatus === 'Paid';
                                const sId = p.studentId?._id;

                                return (
                                <tr key={p._id || idx} className="hover:bg-[#fefaf0]">
                                    <td className="px-6 py-4">{idx + 1}</td>
                                    <td className="px-6 py-4 font-medium">{p.studentId?.enrolmentNo || '-'}</td>
                                    <td className="px-6 py-4">{p.hostelName || '-'}</td>
                                    <td className="px-6 py-4">{p.roomNo || '-'}</td>
                                    <td className="px-6 py-4">
                                        {!isPaid && isWarden ? (
                                            <input 
                                                type="number"
                                                className="w-24 px-2 py-1 border rounded"
                                                placeholder="Amount"
                                                value={customFees[sId] !== undefined ? customFees[sId] : (isPaid ? p.amount : 0)}
                                                onChange={(e) => setCustomFees(prev => ({ ...prev, [sId]: e.target.value }))}
                                            />
                                        ) : (
                                            `LKR ${p.amount}`
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isPaid ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                            {isPaid ? 'Paid' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{formatDateOnly(p.paidDate)}</td>
                                    {isWarden && (
                                        <td className="px-6 py-4">
                                            {!isPaid ? (
                                                <button 
                                                    onClick={() => handleMarkAsPaid(sId)}
                                                    disabled={processingId === sId}
                                                    className={`px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors shadow-sm
                                                        ${processingId === sId ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#6b0f14] hover:bg-[#4f0a0f]'}`}
                                                >
                                                    {processingId === sId ? 'Processing...' : 'Mark as Paid'}
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 text-sm italic">Paid</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Add fadeIn keyframes for dropdown animation
const style = document.createElement('style');
style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px);} to { opacity: 1; transform: translateY(0);} }`;
document.head.appendChild(style);

export default WardenPayments;
