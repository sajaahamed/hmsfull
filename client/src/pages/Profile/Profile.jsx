import React, { useEffect, useState } from 'react';
import { MdOutlineEdit } from "react-icons/md";
import DefaultInput from '../../components/Form/DefaultInput';
import DefaultBtn from '../../components/Buttons/DefaultBtn';
import DashUser from '../../assets/DashUser.png'
;
import axios from 'axios';

const Profile = () => {
    const [btnClick, setBtnClick] = useState(false);
    const token = localStorage.getItem('login')

    const handleBtnClick = () => {
        setBtnClick(!btnClick);
    };

    const [mydata, setmydata] = useState([])

    useEffect(() => {
        axios.get(import.meta.env.VITE_APP_API + '/auth/get-currentuser-data', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        })
            .then(res => setmydata(res.data.Result))
            .catch(err => console.log(err))
    }, [])

    const [updatepass, setupdatepass] = useState({
        currentpass: '',
        newpass: '',
    })

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setupdatepass(prev => ({ ...prev, [name]: value }));
    };

    const healdeUpdatePass = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(import.meta.env.VITE_APP_API + '/auth/update-password-dashboard', updatepass, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })
            if(res.data.Status === "Success"){
                alert(res.data.Message)
                localStorage.clear()
                window.location.reload()
            }
            else{
                alert(res.data.Error)
            }
        }
        catch (err) {
            console.log(err)
        }
    }


    return (
        <div className="p-6 md:p-10 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-[#6b0f14] mb-8">My Profile</h1>

            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 md:p-10 transition hover:shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    {/* Left Section: Avatar + Info */}
                    <div className="flex items-start gap-6">
                        <img
                            src={DashUser}
                            alt="Profile"
                            className="h-36 w-36 rounded-full border-4 border-[#6b0f14] shadow-md object-cover"
                        />
                        <div className="space-y-2">
                            <h2 className="text-2xl font-extrabold text-[#6b0f14] uppercase">{mydata?.username}</h2>
                            <p className="text-gray-600 text-base">{mydata?.email}</p>
                            {mydata.roles?.length > 0 ? (
                                mydata.roles.map((role, index) => (
                                    <span
                                        key={index}
                                        className="bg-[#fdf6e3] text-[#6b0f14] text-xs font-semibold px-3 py-1 rounded-full"
                                    >
                                        {typeof role === 'string' ? role : role.name}
                                    </span>
                                ))
                            ) : (
                                <span className="text-gray-400 italic text-sm">No roles</span>
                            )}
                        </div>
                    </div>

                    {/* Right Section: Edit Button */}
                    <button
                        type="button"
                        onClick={handleBtnClick}
                        className="cursor-pointer flex items-center gap-2 text-sm text-[#6b0f14] hover:text-[#3a0709] bg-[#fdf6e3] hover:bg-[#f5e6c8] px-4 py-2 rounded-full shadow-sm transition"
                    >
                        <MdOutlineEdit className="text-lg" />
                        {btnClick ? 'Close' : 'Edit Profile'}
                    </button>
                </div>
            </div>

            {/* Toggle Section */}
            {btnClick && (
                <div className="max-w-4xl mx-auto mt-6 bg-white p-6 rounded-2xl shadow-md transition">
                    <form onSubmit={healdeUpdatePass} method="post">
                        <DefaultInput
                            label="Current Password"
                            type="password"
                            name="currentpass"
                            value={updatepass.currentpass}
                            onChange={handleInputChange}
                            placeholder="*********"
                            required
                        />
                        <DefaultInput
                            label="New Password"
                            type="password"
                            name="newpass"
                            value={updatepass.newpass}
                            onChange={handleInputChange}
                            placeholder="*********"
                            required
                        />

                        <div className="-mt-4">
                            <DefaultBtn
                                type='submit'
                                label='Update Password'
                            />
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Profile;
