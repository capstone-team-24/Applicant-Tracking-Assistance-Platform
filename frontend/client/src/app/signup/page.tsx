"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { storeAuthData } from "@/lib/auth";
import toast from "react-hot-toast";

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignupPage() {
  const router = useRouter();
  // At the top of your component, add:
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    // Password Confirmation Logic
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Logic Update: role is always sent as "CANDIDATE"
      await authApi.signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: "CANDIDATE",
      });

      const loginResponse = await authApi.login(formData.email, formData.password);
      const user = {
        id: loginResponse.userId,
        email: loginResponse.email,
        firstName: loginResponse.firstName,
        lastName: loginResponse.lastName,
        role: loginResponse.role,
      };
      storeAuthData(loginResponse.accessToken, loginResponse.refreshToken, user);

      toast.success("Account created successfully!");
      router.push("/account/setup");
      router.refresh();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const message = err.response?.data?.message || "Failed to create account.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(/bk.jpg)` }}
    >
      <div className="w-full max-w-lg">
        {/* Glass Card Container */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Create Account</h1>
            <p className="mt-2 text-sm text-white/70">
              Join the ATS platform as a Candidate
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5 ml-1">First Name</label>
                <input
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/30 transition-all focus:outline-none focus:ring-2 ${errors.firstName ? "border-red-400 focus:ring-red-400" : "border-white/20 focus:ring-white/40"
                    }`}
                  placeholder="John"
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-300 ml-1">{errors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5 ml-1">Last Name</label>
                <input
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/30 transition-all focus:outline-none focus:ring-2 ${errors.lastName ? "border-red-400 focus:ring-red-400" : "border-white/20 focus:ring-white/40"
                    }`}
                  placeholder="Doe"
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-300 ml-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 ml-1">Email Address</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/30 transition-all focus:outline-none focus:ring-2 ${errors.email ? "border-red-400 focus:ring-red-400" : "border-white/20 focus:ring-white/40"
                  }`}
                placeholder="you@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-300 ml-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/30 transition-all focus:outline-none focus:ring-2 ${errors.password ? "border-red-400 focus:ring-red-400" : "border-white/20 focus:ring-white/40"
                      }`}
                    placeholder="8+ characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      // Eye-off icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 
               0-1.086.174-2.13.5-3.1m3.1 3.1a7.978 7.978 0 00-.5 3c0 
               4.418 3.582 8 8 8 1.086 0 2.13-.174 3.1-.5m3.1-3.1a7.978 
               7.978 0 00.5-3c0-4.418-3.582-8-8-8-1.086 0-2.13.174-3.1.5m3.1 
               3.1L3 3m0 0l18 18" />
                      </svg>
                    ) : (
                      // Eye icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 
               8.268 2.943 9.542 7-1.274 4.057-5.065 
               7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-300 ml-1">{errors.password}</p>}
              </div>


              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5 ml-1">Confirm Password</label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/30 transition-all focus:outline-none focus:ring-2 ${errors.confirmPassword ? "border-red-400 focus:ring-red-400" : "border-white/20 focus:ring-white/40"
                      }`}
                    placeholder="Repeat password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? (
                      // Eye-off icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 
               0-1.086.174-2.13.5-3.1m3.1 3.1a7.978 7.978 0 00-.5 3c0 
               4.418 3.582 8 8 8 1.086 0 2.13-.174 3.1-.5m3.1-3.1a7.978 
               7.978 0 00.5-3c0-4.418-3.582-8-8-8-1.086 0-2.13.174-3.1.5m3.1 
               3.1L3 3m0 0l18 18" />
                      </svg>
                    ) : (
                      // Eye icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 
               8.268 2.943 9.542 7-1.274 4.057-5.065 
               7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-300 ml-1">{errors.confirmPassword}</p>}
              </div>

            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white/90 text-slate-900 font-bold rounded-xl hover:bg-white transition-all shadow-lg disabled:opacity-50 mt-4"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/10 pt-6">
            <p className="text-sm text-white/60">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-white hover:underline underline-offset-4">
                Sign in here
              </Link>
            </p>
            <p className="mt-4 text-xs text-white/40">
              Are you an organization?{" "}
              <a href="/org/login" className="hover:text-white transition-colors">Portal Access</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
