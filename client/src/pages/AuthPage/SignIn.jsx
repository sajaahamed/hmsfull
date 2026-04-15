import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DefaultInput from '../../components/Form/DefaultInput';
import DefaultBtn from '../../components/Buttons/DefaultBtn';

import uopLogo from '../../assets/uoplogo.png';
import authBg from '../../assets/auth-bg.jpg';

const SignIn = () => {
    const [signInData, setSignInData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showStudentGuide, setShowStudentGuide] = useState(false);
    const [showWardenGuide, setShowWardenGuide] = useState(false);
    // separate dropdown state to avoid colliding with modal flags
    const [showStudentGuideDropdown, setShowStudentGuideDropdown] = useState(false);
    const [showWardenGuideDropdown, setShowWardenGuideDropdown] = useState(false);
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSignInData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axios.post(
                `${import.meta.env.VITE_APP_API}/auth/signin`,
                signInData
            );

            if (res.data.Status === 'Success') {
                alert(res.data.Message);
                localStorage.setItem('login', res.data.Token);
                localStorage.setItem('dashmenuID', 1);
                navigate('/Dashboard/Home');
                 window.location.reload();
            } else {
                setError(res.data.Error || 'Sign-in failed');
            }
        } catch (err) {
            console.error(err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const Modal = ({ title, content, onClose }) => (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">

            <div className="bg-white p-6 rounded-xl shadow-lg w-11/12 max-w-lg">
                <h2 className="text-xl font-semibold mb-4">{title}</h2>
                <div className="text-gray-700 mb-4">{content}</div>
                <div className="text-right">
                    <DefaultBtn type="button" label="Close" onClick={onClose} />
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="min-h-screen auth-bg px-4 py-10 flex flex-col relative overflow-hidden"
            style={{ '--auth-bg-url': `url(${authBg})` }}
        >
            <div className="bg-blob blob-1" />
            <div className="bg-blob blob-2" />
            <div className="flex flex-col md:flex-row md:items-center md:justify-center flex-grow max-w-6xl w-full mx-auto auth-content">
                <div className="flex flex-col items-center mb-8 md:mb-0 md:mr-10 text-center">
                    <div className="logo-badge mb-4 inline-block">
                        <img src={uopLogo} alt="University Logo" className="md:h-32 w-auto" />
                    </div>
                    <div className="welcome-panel">
                        <h1 className="welcome-title">
                            <span className="title-accent">Welcome to</span>
                            <span className="title-accent"> Hostel Management System</span>
                        </h1>
                        <div className="welcome-underline" />
                        <p className="welcome-subtitle">Read SignUp Guides</p>
                    </div>
                    <div
                        className="mt-2"
                        tabIndex={0}
                        onMouseEnter={() => {
                            setShowStudentGuideDropdown(true);
                            setShowWardenGuideDropdown(false);
                        }}
                        onMouseLeave={() => setShowStudentGuideDropdown(false)}
                        onFocus={() => {
                            setShowStudentGuideDropdown(true);
                            setShowWardenGuideDropdown(false);
                        }}
                        onBlur={() => setShowStudentGuideDropdown(false)}
                    >
                        <DefaultBtn
                            type="button"
                            label="Read Student Guide"
                            hasCaret={true}
                            onClick={() => {
                                setShowStudentGuideDropdown(s => !s);
                                setShowWardenGuideDropdown(false);
                            }}
                        />
                        {showStudentGuideDropdown && (
                            <div className="mt-3 p-4 bg-white rounded shadow-sm text-left text-gray-700 transition-all duration-150">
                                <h3 className="font-semibold mb-2">Student Sign-Up Guide</h3>
                                <ul className="list-disc ml-5 space-y-2 text-sm">
                                    <li>Wait for email to confirm that your account is created and active.</li>
                                    <li>If you receive the email, it contains credentials to log in to the system.</li>
                                    <li>Every student account default password is <strong>12345678</strong>.</li>
                                    <li><span className="uppercase font-semibold text-red-500">Important</span>: After login please update your password.</li>
                                </ul>
                            </div>
                        )}
                    </div>
                    <div
                        className="mt-2"
                        tabIndex={0}
                        onMouseEnter={() => {
                            setShowWardenGuideDropdown(true);
                            setShowStudentGuideDropdown(false);
                        }}
                        onMouseLeave={() => setShowWardenGuideDropdown(false)}
                        onFocus={() => {
                            setShowWardenGuideDropdown(true);
                            setShowStudentGuideDropdown(false);
                        }}
                        onBlur={() => setShowWardenGuideDropdown(false)}
                    >
                        <DefaultBtn
                            type="button"
                            label="Warden SignUp Guide"
                            hasCaret={true}
                            onClick={() => {
                                setShowWardenGuideDropdown(s => !s);
                                setShowStudentGuideDropdown(false);
                            }}
                        />
                        {showWardenGuideDropdown && (
                            <div className="mt-3 p-4 bg-white rounded shadow-sm text-left text-gray-700 transition-all duration-150">
                                <h3 className="font-semibold mb-2">Warden Sign-Up Guide</h3>
                                <ul className="list-disc ml-5 space-y-2 text-sm">
                                    <li>Sign up using official university credentials.</li>
                                    <li>Go to Email Verify page — you must verify your email there.</li>
                                    <li>Your account will be verified by the admin.</li>
                                    <li>Once approved, you can access the Dashboard.</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full max-w-md glass-card p-8 rounded-2xl shadow-md">
                    <div className="accent-line" />
                    <h2 className="text-2xl font-semibold auth-heading mb-6 text-center">Sign In</h2>
                    <form onSubmit={handleSubmit}>
                        <DefaultInput
                            label="Email"
                            type="email"
                            name="email"
                            value={signInData.email}
                            onChange={handleInputChange}
                            placeholder="you@example.com"
                            required
                        />
                        <DefaultInput
                            label="Password"
                            type="password"
                            name="password"
                            value={signInData.password}
                            onChange={handleInputChange}
                            placeholder="••••••••"
                            required
                        />
                        {error && (
                            <div className="mb-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}
                        <DefaultBtn type="submit" label={loading ? 'Signing In...' : 'Sign In'} disabled={loading} />
                    </form>

                    <div className="mt-4 space-y-1 text-sm text-center">
                        <p className="text-gray-800 hover:underline transition">
                            <a href="/Forgetpassword">Forgot password?</a>
                        </p>
                        <p className="text-gray-800 hover:underline transition">
                            <a href="/register">Create Account</a>
                        </p>
                    </div>
                </div>
            </div>

                        <div className="footer-wrap">
                            <footer className="text-center text-sm footer-muted">
                                &copy; {new Date().getFullYear()} University of Peradeniya | Hostel Management System
                            </footer>
                        </div>

            {/* Student Guide Modal */}
            {showStudentGuide && (
                <Modal
                    title="Student Sign-Up Guide"
                    content={
                        <ul className="list-disc ml-5 space-y-2">
                            <li>wait for email to confram that your account is Created and Active.</li>
                            <li>if you got the email there are credentials to log in to system</li>
                            <li>Eveny Student Account Defult Password is <strong>12345678</strong></li>
                            <li><span className='uppercase font-semibold text-red-500'>important</span>: After Login with credentials please update the Password.</li>
                        </ul>
                    }
                    onClose={() => setShowStudentGuide(false)}
                />
            )}

            {/* Warden Guide Modal */}
            {showWardenGuide && (
                <Modal
                    title="Warden Sign-Up Guide"
                    content={
                        <ul className="list-disc ml-5 space-y-2">
                            <li>Sign up using official university credentials.</li>
                            <li>Then you goto Email Verify page if you not verify email at that stage you cannot verify email after</li>
                            <li>Your account will be verified by the admin.</li>
                            <li>Once approved, you can go to Dashboard.</li>
                        </ul>
                    }
                    onClose={() => setShowWardenGuide(false)}
                />
            )}
        </div>
    );
};

export default SignIn;
