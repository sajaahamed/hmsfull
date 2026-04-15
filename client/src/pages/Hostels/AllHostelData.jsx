import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { FaMale, FaFemale } from 'react-icons/fa';
import { Link } from 'react-router-dom';
;

const AllHostelData = () => {
    const [allhostels, setAllHostels] = useState([]);
    const token = localStorage.getItem('login');

    const maleHostelCount = allhostels.filter(h => h.gender === 'Male').length
    const femaleHostelCount = allhostels.filter(h => h.gender === 'Female').length

    useEffect(() => {
        axios.get(import.meta.env.VITE_APP_API + '/hostel/get-all-hostels', {
            headers: {
                Authorization: `Bearer ${token}`,
            }
        })
            .then(res => {
                setAllHostels(res.data.Result);
            })
            .catch(err => console.error("Failed to fetch hostels:", err));
    }, [token]);

    const hostelStats = [
        {
            id: 1,
            name: 'Male Hostels',
            icon: FaMale,
            value: maleHostelCount,
            bgColor: 'bg-[#6b0f14]',
        },
        {
            id: 2,
            name: 'Female Hostels',
            icon: FaFemale,
            value: femaleHostelCount,
            bgColor: 'bg-[#d4af37]',
        },
    ]

    return (
        <div>
            <h2 className="text-lg font-semibold text-[#6b0f14] mb-6">Hostels</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {hostelStats.map((stat) => (
                    <div key={stat.id} className={`relative ${stat.bgColor} text-white p-6 rounded-2xl shadow-lg overflow-hidden hover:scale-[1.02] transition-transform duration-300`}>
                        {/* Icon in background */}
                        {stat.icon && (
                            <div className="absolute right-4 top-4 opacity-20 text-white text-6xl">
                                <stat.icon />
                            </div>
                        )}

                        {/* Content */}
                        <div className="relative z-10">
                            <div className="text-sm font-medium uppercase tracking-wide text-[#fdf6e3]">
                                {stat.name}
                            </div>
                            <div className="mt-3 text-4xl font-bold">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="min-w-full text-sm text-left text-gray-600 bg-white">
                    <thead className="text-xs uppercase bg-[#fdf6e3] text-[#6b0f14]">
                        <tr>
                            <th className="px-6 py-4 font-semibold">#</th>
                            <th className="px-6 py-4 font-semibold">Hostel ID</th>
                            <th className="px-6 py-4 font-semibold">Name</th>
                            <th className="px-6 py-4 font-semibold">Location</th>
                            <th className="px-6 py-4 font-semibold">Warden</th>
                            <th className="px-6 py-4 font-semibold">Rooms</th>
                            <th className="px-6 py-4 font-semibold">Gender</th>
                            <th className="px-6 py-4 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {
                            allhostels.length > 0 ? (
                                allhostels.map((data, index) => (
                                    <tr key={index} className="hover:bg-[#fefaf0] transition-all duration-150">
                                        <td className="px-6 py-4 font-medium text-gray-800">{index + 1}</td>
                                        <td className="px-6 py-4">{data.hostelID}</td>
                                        <td className="px-6 py-4">{data.name}</td>
                                        <td className="px-6 py-4">
                                            <a href={`${data.location}`} target='_blank' className='text-[#6b0f14] font-medium hover:underline'>
                                                View
                                            </a>
                                        </td>
                                        <td className="px-6 py-4">
                                            {data.warden?.username || 'Not Assigned'}
                                        </td>
                                        <td className="px-6 py-4">{data.roomCount}</td>
                                        <td className="px-6 py-4">
                                            {data.gender === 'Male' ? (
                                                <span className="flex items-center gap-1 bg-[#fdf6e3] text-[#6b0f14] text-xs font-semibold px-3 py-1 rounded-full uppercase">
                                                    <FaMale /> Male
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full uppercase">
                                                    <FaFemale /> Female
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/Dashboard/View-Hostel/${data._id}`}
                                                className="text-[#6b0f14] font-medium hover:underline"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                                        No matching records found.
                                    </td>
                                </tr>
                            )
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AllHostelData;
