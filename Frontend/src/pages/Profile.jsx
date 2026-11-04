import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Lock,
  User,
  FileText,
  Mail,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';
import ThemeToggle from '../components/common/ThemeToggle';
import api from '../services/api';
import { validatePassword, validateUsername } from '../utils/validators';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fileInputRef = useRef(null);

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be under 5MB');
        return;
      }
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      toast.error(usernameValidation.message);
      return;
    }

    try {
      setIsSavingProfile(true);

      let finalAvatarUrl = avatarPreview;

      // If user selected a new avatar file, upload it first
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        try {
          const uploadRes = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          finalAvatarUrl =
            uploadRes.data?.url ||
            uploadRes.data?.fileUrl ||
            uploadRes.data?.data?.url;
        } catch (uploadErr) {
          // If /upload doesn't work, try /messages/upload or keep data url
          try {
            const uploadRes2 = await api.post('/messages/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            finalAvatarUrl =
              uploadRes2.data?.url ||
              uploadRes2.data?.fileUrl ||
              uploadRes2.data?.data?.url;
          } catch {
            // Keep preview
          }
        }
      }

      const payload = {
        username: username.trim(),
        bio: bio.trim(),
        avatar: finalAvatarUrl || null,
      };

      let res;
      try {
        res = await api.put('/users/profile', payload);
      } catch {
        try {
          res = await api.put('/users/me', payload);
        } catch {
          res = await api.put('/auth/profile', payload);
        }
      }

      const updatedUser = res?.data?.user || res?.data?.data || payload;
      updateUser(updatedUser);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }

    const passwordVal = validatePassword(newPassword);
    if (!passwordVal.isValid) {
      toast.error(passwordVal.message);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setIsChangingPassword(true);
      const payload = {
        currentPassword,
        newPassword,
      };

      try {
        await api.put('/users/change-password', payload);
      } catch {
        await api.put('/auth/change-password', payload);
      }

      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-chat-bg dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Navbar */}
      <header className="h-16 px-4 sm:px-8 bg-white dark:bg-dark-header border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-input text-gray-600 dark:text-gray-300 transition-colors"
            title="Back to chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Profile & Settings</h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        {/* Profile Card */}
        <section className="bg-white dark:bg-dark-header rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-800">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <Avatar
                  src={avatarPreview}
                  name={username || user?.username}
                  size="2xl"
                  className="ring-4 ring-primary-500/30"
                />

                {/* Upload button overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Change photo"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">
                    Change
                  </span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="mt-3 inline-flex items-center text-xs text-red-500 hover:text-red-600 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove photo
                </button>
              )}
            </div>

            {/* Email (Readonly) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-dark-input/50 rounded-xl text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed border border-transparent"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Email cannot be changed directly.
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* Bio / About */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                About / Bio
              </label>
              <div className="relative">
                <FileText className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={150}
                  placeholder="Hey there! I am using ChatApp."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1 text-right">
                {bio.length}/150
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                isLoading={isSavingProfile}
              >
                Save Profile
              </Button>
            </div>
          </form>
        </section>

        {/* Password Card */}
        <section className="bg-white dark:bg-dark-header rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold mb-4 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-primary-500" />
            <span>Change Password</span>
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 chars, 1 uppercase, 1 number"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-dark-input rounded-xl text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="outline"
                isLoading={isChangingPassword}
              >
                Update Password
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Profile;
