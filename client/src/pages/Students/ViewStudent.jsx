import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import DefaultBtn from '../../components/Buttons/DefaultBtn';
import DefaultInput from '../../components/Form/DefaultInput';
import Dropdown from '../../components/Form/Dropdown';
import { getUserInfoFromToken } from '../../utils/auth';

const ViewStudent = () => {
    const { id } = useParams();
    const [stdData, setStdData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const token = localStorage.getItem('login');

    const userInfo = getUserInfoFromToken();
    const userRoles = (userInfo?.roles || [])
        .map(r => (typeof r === 'string' ? r.toLowerCase() : r.name?.toLowerCase?.()))
        .filter(Boolean);


    // ✅ Role-based access control (lowercase match)
    const allowedRoles = ['warden', 'admin', 'director'];
    const isAuthorized = userRoles.some(role => allowedRoles.includes(role));

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_APP_API}/student/get-student-byID/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                setStdData(res.data.Result);
                setFormData(res.data.Result);
            })
            .catch(err => console.log(err));
    }, [id, token]);

    if (!isAuthorized) {
        return <Navigate to="/" replace />;
    }

    const handleEditToggle = () => setIsEditing(!isEditing);

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();

        try {
            const res = await axios.post(`${import.meta.env.VITE_APP_API}/student/update-Student/${id}`, formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.Status === "Success") {
                alert(res.data.Message);
                window.location.reload();
            } else {
                alert(res.data.Error);
            }
        } catch (err) {
            console.log(err);
        }
    };

    if (!stdData) return <div className="text-gray-500">Loading student data...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto bg-white shadow-md rounded-lg mt-5">
            <div className="flex justify-between items-center -mt-4 mb-2">
                <Link to={
                    userRoles.includes('warden')
                        ? '/Dashboard/WardenStudents'
                        : '/Dashboard/Students'
                }>
                    <DefaultBtn type="button" label="Back" />
                </Link>
                <DefaultBtn type="button" label={isEditing ? 'Cancel' : 'Edit'} onClick={handleEditToggle} />
            </div>

            <h1 className="text-2xl font-bold text-[#6b0f14] mb-4">Student Information</h1>

            {!isEditing ? (
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <Detail label="Enrolment No" value={stdData.enrolmentNo} />
                    <Detail label="NIC" value={stdData.nic} />
                    <Detail label="Name" value={stdData.name} />
                    <Detail label="AL District" value={stdData.alDistrict} />
                    <Detail label="Gender" value={stdData.sex} />
                    <Detail label="Address 1" value={stdData.address1} />
                    <Detail label="Address 2" value={stdData.address2} />
                    <Detail label="Address 3" value={stdData.address3} />
                    <Detail label="Full Address" value={stdData.fullAddress} />
                    <Detail label="Intake" value={stdData.intake} />
                    <Detail label="Date of Enrolment" value={new Date(stdData.dateOfEnrolment).toLocaleDateString()} />
                    <Detail label="Study Year" value={stdData.dateOfEnrolment ? `Year ${(new Date().getFullYear() - new Date(stdData.dateOfEnrolment).getFullYear()) + 1}` : ''} />
                    <Detail label="Distance" value={stdData.distance + ' km'} />
                    <Detail label="Assigned" value={stdData.isAssign ? 'Yes' : 'No'} />
                    {stdData.hostelAssignedDate && <Detail label="Assigned Date" value={new Date(stdData.hostelAssignedDate).toLocaleDateString()} />}
                    
                    {stdData.lastEditedBy && (
                        <div className="col-span-full mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Record Edited By Admin
                            </p>
                            <div className="mt-1 grid grid-cols-2 gap-4">
                                <Detail label="Admin Name / Email" value={stdData.lastEditedBy} />
                                <Detail label="Last Edited Date" value={new Date(stdData.lastEditedAt).toLocaleString()} />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <form onSubmit={handleUpdate} className="grid md:grid-cols-2 gap-4 text-sm">
                    {[ // Editable fields
                        { name: 'name', label: 'Name' },
                        { name: 'alDistrict', label: 'AL District' },
                        { name: 'address1', label: 'Address 1' },
                        { name: 'address2', label: 'Address 2' },
                        { name: 'address3', label: 'Address 3' },
                        { name: 'fullAddress', label: 'Full Address' },
                        { name: 'intake', label: 'Intake' },
                        { name: 'dateOfEnrolment', label: 'Date of Enrolment', type: 'date' },
                        { name: 'distance', label: 'Distance (km)', type: 'number' }
                    ].map(field => (
                        <DefaultInput
                            key={field.name}
                            label={field.label}
                            name={field.name}
                            type={field.type || 'text'}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                        />
                    ))}
                    <Dropdown
                        label="Gender"
                        name="sex"
                        value={formData.sex || ''}
                        onChange={handleChange}
                        options={[
                            { label: 'Male', value: 'Male' },
                            { label: 'Female', value: 'Female' },
                            { label: 'REV', value: 'REV' }
                        ]}
                    />
                    <div className="col-span-2 -mt-4">
                        <DefaultBtn type="submit" label="Update Student" />
                    </div>
                </form>
            )}
        </div>
    );
};

const Detail = ({ label, value }) => (
    <div>
        <p className="text-[#6b0f14] font-semibold">{label}</p>
        <p className="text-gray-800">{value || '-'}</p>
    </div>
);

export default ViewStudent;
