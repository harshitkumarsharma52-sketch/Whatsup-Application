import React, { useRef, useState } from 'react';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Avatar from './Avatar';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const toSquareJpeg = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.getContext('2d').drawImage(image, sx, sy, side, side, 0, 0, 256, 256);
    URL.revokeObjectURL(image.src);
    resolve(canvas.toDataURL('image/jpeg', 0.78));
  };
  image.onerror = () => reject(new Error('Could not read that image'));
  image.src = URL.createObjectURL(file);
});

export default function ProfileModal({ open, onClose }) {
  const { user, updateUser, logout } = useAuth();
  const inputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const avatar = user?.avatar || user?.profilePicture?.url || '';

  const saveAvatar = async (nextAvatar) => {
    setSaving(true);
    try {
      const { data } = await api.put('/avatar', { avatar: nextAvatar });
      updateUser(data.user);
      toast.success(nextAvatar ? 'Profile photo updated' : 'Profile photo removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update photo');
    } finally { setSaving(false); }
  };

  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file');
    if (file.size > 10 * 1024 * 1024) return toast.error('Choose an image smaller than 10MB');
    try { await saveAvatar(await toSquareJpeg(file)); } catch (error) { toast.error(error.message); }
  };

  const signOut = async () => { await logout(); onClose(); };
  return (
    <Modal isOpen={open} onClose={onClose} title="Your profile">
      <div className="profile-modal">
        <Avatar src={avatar} name={user?.username || 'You'} size="2xl" className="profile-modal__avatar" />
        <h2>{user?.username}</h2>
        <p>{user?.email}</p>
        <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={choosePhoto} />
        <button type="button" className="profile-action profile-action--accent" onClick={() => inputRef.current?.click()} disabled={saving}>
          <Camera size={17} /> {avatar ? 'Change photo' : 'Add photo'}
        </button>
        {avatar && <button type="button" className="profile-action" onClick={() => saveAvatar('')} disabled={saving}><Trash2 size={17} /> Remove photo</button>}
        <button type="button" className="profile-action profile-action--danger" onClick={signOut}><LogOut size={17} /> Log out</button>
      </div>
    </Modal>
  );
}
