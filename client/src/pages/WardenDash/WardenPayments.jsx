import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { getUserInfoFromToken } from '../../utils/auth';

const WardenPayments = () => {
    const [students, setStudents] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({ studentId: '', amount: '', type: 'hostel-fee', note: '', paidDate: new Date().toISOString().split('T')[0] });
    const [submitting, setSubmitting] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [, setSelectedStudentOption] = useState(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

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

    // Handle outside click to close dropdown
    useEffect(() => {
        if (!dropdownOpen) return;
        function handleClickOutside(e) {
            if (
                inputRef.current && !inputRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

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

            try {
                setLoading(true);
                setError(null);

                if (isWarden) {
                    // Fetch students allocated to this warden's hostel (wardenEmail optional)
                    const studentsUrl = currentUser?.email
                        ? `${apiBase}/hostel/warden-students?wardenEmail=${encodeURIComponent(currentUser.email)}`
                        : `${apiBase}/hostel/warden-students`;

                    const studsRes = await axios.get(studentsUrl, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setStudents(studsRes.data.Result || []);
                } else {
                    setStudents([]);
                }

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
                setHostels(res.data.Result || res.data.result || []);
            } catch (err) {
                console.error('fetch hostels error', err?.response?.data || err.message);
            }
        };

        fetchHostels();
    }, [isPrivilegedViewer, token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isWarden) {
            setError('Forbidden: only wardens can collect payments');
            return;
        }

        if (!form.studentId || !form.amount) return setError('Student and amount required');

        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                studentId: form.studentId,
                amount: form.amount,
                type: form.type,
                note: form.note,
                paidDate: form.paidDate
            };

            const res = await axios.post(`${import.meta.env.VITE_APP_API}/warden/collect-payment`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.Status === 'Success') {
                const payRes = await axios.get(`${import.meta.env.VITE_APP_API}/warden/payments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const paymentData = payRes.data.Result || payRes.data.result || [];
                setPayments(paymentData);
                setForm({ studentId: '', amount: '', type: 'hostel-fee', note: '', paidDate: new Date().toISOString().split('T')[0] });
                setStudentSearch('');
                setSelectedStudentOption(null);
            } else {
                setError(res.data.Error || res.data.message || 'Failed to collect payment');
            }
        } catch (err) {
            console.error('collect error', err?.response?.data || err.message);
            setError(err.response?.data?.Error || err.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

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

    const filteredStudents = useMemo(() => {
        if (!studentSearch) return students;
        return students.filter(({ student }) => {
            const search = studentSearch.toLowerCase();
            return (
                (student.enrolmentNo && student.enrolmentNo.toLowerCase().includes(search)) ||
                (student.fullName && student.fullName.toLowerCase().includes(search)) ||
                (student.nic && student.nic.toLowerCase().includes(search))
            );
        });
    }, [students, studentSearch]);

    const selectedStudent = useMemo(() => {
        if (!form.studentId) return null;
        return students.find(s => {
            if (!s.student || !s.student._id) return false;
            const sid = s.student._id.toString ? s.student._id.toString() : s.student._id;
            const fid = form.studentId.toString ? form.studentId.toString() : form.studentId;
            return sid === fid;
        }) || null;
    }, [students, form.studentId]);

    const formatDateOnly = (val) => {
        if (!val) return '-';
        const d = new Date(val);
        if (isNaN(d)) return '-';
        return d.toISOString().split('T')[0];
    };

    if (loading) return <div className="p-4 text-center">Loading...</div>;
    if (error) return <div className="p-4 text-center text-red-600">{error}</div>;

    return (
        <div className="mt-8">
            <div className="mb-4 font-semibold text-gray-700">Payments Management</div>

            {isWarden && (
                <div className="mb-6 p-4 bg-white rounded shadow">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div style={{ position: 'relative' }}>
                        <label className="block text-sm font-medium mb-1">Student</label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={studentSearch}
                            onChange={e => {
                                setStudentSearch(e.target.value);
                                setDropdownOpen(true);
                            }}
                            className="w-full px-3 py-2 border rounded mb-2"
                            placeholder="Search student by name, enrolment, or NIC"
                            autoComplete="off"
                            onFocus={e => {
                                e.target.select();
                                setDropdownOpen(true);
                            }}
                        />
                        {dropdownOpen && (
                            <div
                                ref={dropdownRef}
                                style={{
                                    position: 'absolute', zIndex: 10, background: 'white', width: '100%', border: '1px solid #ccc', maxHeight: 200, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    transition: 'opacity 0.3s cubic-bezier(.4,0,.2,1)',
                                    opacity: filteredStudents.length > 0 ? 1 : 0.7,
                                    pointerEvents: 'auto'
                                }}
                                className="dropdown-fade"
                            >
                                {filteredStudents.length === 0 && (
                                    <div className="px-3 py-2 text-gray-400">No students found</div>
                                )}
                                {filteredStudents.map(({ student }, idx) => (
                                    <div
                                        key={student._id}
                                        style={{
                                            animation: `fadeIn .2s ${idx * 0.03}s both`
                                        }}
                                        className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${form.studentId === student._id ? 'bg-gray-200 font-bold' : ''}`}
                                        onClick={() => {
                                            setForm({ ...form, studentId: student._id });
                                            setDropdownOpen(false);
                                            setStudentSearch(student.enrolmentNo || student.fullName || student.nic || "");
                                        }}
                                    >
                                        {(student.enrolmentNo || "") + " - " + (student.fullName || student.nic)}
                                    </div>
                                ))}
                            </div>
                        )}
                        {form.studentId && (
                            <div className="mt-1 text-sm text-green-700">Selected: {filteredStudents.find(({student}) => student._id === form.studentId)?.student?.fullName || form.studentId}</div>
                        )}
                    </div>

                    {/* Read-only Reg No and Room No */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Reg No</label>
                            <input type="text" value={selectedStudent?.student?.no || ''} readOnly className="w-full px-3 py-2 border rounded bg-gray-50" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Room No</label>
                            <input type="text" value={selectedStudent?.allocations?.[0]?.roomId?.roomID || ''} readOnly className="w-full px-3 py-2 border rounded bg-gray-50" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Hall Fee (Amount)</label>
                        <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border rounded" placeholder="Enter amount" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Date</label>
                        <input type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} className="w-full px-3 py-2 border rounded bg-gray-50" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Note (Optional)</label>
                        <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 border rounded" placeholder="Optional note" />
                    </div>

                    <div className="flex items-center gap-2">
                        <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#6b0f14] text-white rounded">{submitting ? 'Submitting...' : 'Collect Payment'}</button>
                        <button type="button" onClick={() => setForm({ studentId: '', amount: '', type: 'hostel-fee', note: '', paidDate: new Date().toISOString().split('T')[0] })} className="px-4 py-2 bg-gray-200 rounded">Reset</button>
                    </div>
                </form>
                </div>
            )}

            {isPrivilegedViewer && (
                <div className="mb-4 flex items-center gap-3">
                    <label className="block text-sm font-medium">Filter by Hostel</label>
                    <select value={selectedHostelId} onChange={e => setSelectedHostelId(e.target.value)} className="px-3 py-2 border rounded">
                        <option value="">All hostels</option>
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
                            <th className="px-6 py-3">Reg No</th>
                            <th className="px-6 py-3">Enrollment No</th>
                            <th className="px-6 py-3">Hostel</th>
                            <th className="px-6 py-3">Room No</th>
                            <th className="px-6 py-3">Hall Fee</th>
                            <th className="px-6 py-3">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {payments.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                                    No payment records found
                                </td>
                            </tr>
                        ) : (
                            payments.map((p, idx) => (
                                <tr key={p._id || idx} className="hover:bg-[#fefaf0]">
                                    <td className="px-6 py-3">{idx + 1}</td>
                                    <td className="px-6 py-3">{p.studentId?.no || '-'}</td>
                                    <td className="px-6 py-3">{p.studentId?.enrolmentNo || '-'}</td>
                                    <td className="px-6 py-3">{p.hostelName || '-'}</td>
                                    <td className="px-6 py-3">{p.roomNo || '-'}</td>
                                    <td className="px-6 py-3">{p.amount}</td>
                                    <td className="px-6 py-3">{formatDateOnly(p.paidDate)}</td>
                                </tr>
                            ))
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
