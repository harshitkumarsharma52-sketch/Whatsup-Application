import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validators';
import Button from '../components/common/Button';
import ThemeToggle from '../components/common/ThemeToggle';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.message;
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      await login({
        email: formData.email.trim(),
        password: formData.password,
      });
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Invalid email or password';
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

//   return (
//     <div className="min-h-screen bg-chat-bg dark:bg-dark-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
//       <div className="absolute top-4 right-4">
//         <ThemeToggle />
//       </div>

//       <div className="sm:mx-auto sm:w-full sm:max-w-md">
//         <div className="flex justify-center">
//           <div className="w-14 h-14 rounded-2xl bg-primary-500 flex items-center justify-center text-white shadow-lg">
//             <MessageSquare className="w-8 h-8" />
//           </div>
//         </div>
//         <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
//           Sign in to ChatApp
//         </h2>
//         <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
//           Connect and chat with your friends in real-time
//         </p>
//       </div>

//       <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
//         <div className="bg-white dark:bg-dark-header py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-800">
//           {errors.form && (
//             <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-600 dark:text-red-400">
//               {errors.form}
//             </div>
//           )}

//           <form onSubmit={handleSubmit} className="space-y-5">
//             {/* Email input */}
//             <div>
//               <label
//                 htmlFor="email"
//                 className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1"
//               >
//                 Email Address
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
//                   <Mail className="w-5 h-5" />
//                 </div>
//                 <input
//                   id="email"
//                   name="email"
//                   type="email"
//                   autoComplete="email"
//                   value={formData.email}
//                   onChange={handleChange}
//                   placeholder="you@example.com"
//                   className={`w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl border text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all ${
//                     errors.email
//                       ? 'border-red-400 focus:ring-2 focus:ring-red-400'
//                       : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500'
//                   }`}
//                 />
//               </div>
//               {errors.email && (
//                 <p className="mt-1 text-xs text-red-500">{errors.email}</p>
//               )}
//             </div>

//             {/* Password input */}
//             <div>
//               <label
//                 htmlFor="password"
//                 className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1"
//               >
//                 Password
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
//                   <Lock className="w-5 h-5" />
//                 </div>
//                 <input
//                   id="password"
//                   name="password"
//                   type={showPassword ? 'text' : 'password'}
//                   autoComplete="current-password"
//                   value={formData.password}
//                   onChange={handleChange}
//                   placeholder="••••••••"
//                   className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl border text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all ${
//                     errors.password
//                       ? 'border-red-400 focus:ring-2 focus:ring-red-400'
//                       : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500'
//                   }`}
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword((prev) => !prev)}
//                   className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
//                 >
//                   {showPassword ? (
//                     <EyeOff className="w-4 h-4" />
//                   ) : (
//                     <Eye className="w-4 h-4" />
//                   )}
//                 </button>
//               </div>
//               {errors.password && (
//                 <p className="mt-1 text-xs text-red-500">{errors.password}</p>
//               )}
//             </div>

//             <Button
//               type="submit"
//               variant="primary"
//               size="lg"
//               isLoading={isLoading}
//               className="w-full mt-2"
//             >
//               Sign In
//             </Button>
//           </form>

//           <div className="mt-6 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
//             Don't have an account?{' '}
//             <Link
//               to="/register"
//               className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 underline"
//             >
//               Sign up
//             </Link>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

return (
    <div className="relative isolate overflow-hidden min-h-screen bg-chat-bg dark:bg-dark-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors before:absolute before:-top-32 before:-left-32 before:-z-10 before:h-96 before:w-96 before:rounded-full before:bg-emerald-400/30 before:blur-3xl before:animate-pulse before:[animation-duration:6s] after:absolute after:-bottom-32 after:-right-32 after:-z-10 after:h-96 after:w-96 after:rounded-full after:bg-teal-400/30 after:blur-3xl after:animate-bounce after:[animation-duration:12s] dark:before:bg-emerald-500/20 dark:after:bg-teal-500/20">
      <div className="absolute top-4 right-4 transition-transform duration-300 hover:scale-110 hover:rotate-12 active:scale-90">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="group relative isolate w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center text-white shadow-lg transition-all duration-500 hover:scale-110 hover:rotate-6 hover:shadow-2xl before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-primary-500 before:opacity-40 before:animate-ping before:[animation-duration:3s]">
            <MessageSquare className="w-8 h-8 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white transition-all duration-500 hover:tracking-wide">
          Sign in to ChatApp
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Connect and chat with your friends in real-time
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-dark-header py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-800 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:border-primary-500/40">
          {errors.form && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-600 dark:text-red-400 animate-pulse">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email input */}
            <div className="group">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1 transition-all duration-300 group-focus-within:text-primary-500 group-focus-within:tracking-widest"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 transition-all duration-300 group-focus-within:text-primary-500 group-focus-within:scale-125">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl border text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all duration-300 focus:-translate-y-0.5 focus:shadow-lg ${
                    errors.email
                      ? 'border-red-400 focus:ring-2 focus:ring-red-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 focus:ring-2 focus:ring-primary-500'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500 animate-pulse">{errors.email}</p>
              )}
            </div>

            {/* Password input */}
            <div className="group">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1 transition-all duration-300 group-focus-within:text-primary-500 group-focus-within:tracking-widest"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 transition-all duration-300 group-focus-within:text-primary-500 group-focus-within:scale-125">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl border text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all duration-300 focus:-translate-y-0.5 focus:shadow-lg ${
                    errors.password
                      ? 'border-red-400 focus:ring-2 focus:ring-red-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 focus:ring-2 focus:ring-primary-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all duration-200 hover:scale-125 hover:rotate-12 active:scale-75"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 animate-pulse">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="relative overflow-hidden w-full mt-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] before:absolute before:inset-y-0 before:-left-full before:w-1/2 before:-skew-x-12 before:bg-white/30 before:transition-[left] before:duration-700 hover:before:left-[150%]"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 underline underline-offset-4 decoration-transparent hover:decoration-current transition-all duration-300 hover:tracking-wide"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
