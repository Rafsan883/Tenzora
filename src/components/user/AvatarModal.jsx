import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import AnikotoCatalog from './AnikotoCatalog';

const getImages = (folder, count) => Array.from({length: count}, (_, i) => `/avatars/${folder}/img_${i + 1}.jpg`);

const AVATAR_DATA = {
  "Bleach": getImages('bleach', 23),

  "Boruto": getImages('baruto', 17),
  "ChainsawMan": getImages('csm', 24),
  "DemonSlayer": getImages('demon_slayer', 27),
  "Eyes": getImages('eye', 15),
  "FairyTail": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Natsu",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucy",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Erza"
  ],
  "Inuyasha": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Inu1",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Kagome"
  ],
  "JujutsuKaisen": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Gojo",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Itadori",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Megumi"
  ],
  "Naruto": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Naruto1",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Sasuke",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Kakashi"
  ],
  "OnePiece": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Luffy",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoro",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Nami"
  ],
  "OnePunchMan": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Saitama",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Genos"
  ],
  "Pokemon": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Pika",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Ash"
  ],
  "SailorMoon": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Moon1",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Mars"
  ],
  "TokyoGhoul": [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Kaneki",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Touka"
  ]
};

export default function AvatarModal({ isOpen, onClose, onSave, currentAvatar = '', currentFrame = null, currentTitle = null, decorations = [], titles = [], isLoading = false, catalogError = null }) {
  const [activeTab, setActiveTab] = useState('avatars');
  const [activeCategory, setActiveCategory] = useState(Object.keys(AVATAR_DATA)[0]);
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [selectedDecoration, setSelectedDecoration] = useState(currentFrame);
  const [selectedTitle, setSelectedTitle] = useState(currentTitle);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = Object.keys(AVATAR_DATA);
  const filteredAvatars = AVATAR_DATA[activeCategory];

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-6">
      {/* Balanced Backdrop */}
      <div
        className="absolute inset-0 bg-black/1 backdrop-blur-sm transition-opacity duration-500 ease-out"
        onClick={onClose}
      />

      {/* Premium Modal Content */}
      <div role="dialog" aria-modal="true" aria-labelledby="avatar-customization-title" className="relative flex h-[80vh] max-h-[850px] w-[92%] max-w-[500px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#151517] shadow-[0_32px_64px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in duration-300 md:h-[90vh] md:w-full">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-8 py-7">
          <div>
            <h2 id="avatar-customization-title" className="text-xl font-extrabold tracking-tight text-white">
              Profile Customization
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close customization"
            onClick={onClose}
             className="rounded-full bg-white/[0.05] p-2.5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 border-b border-white/[0.08] px-8 py-3" aria-label="Customization collections">
          {[
            { id: 'avatars', label: 'Avatars' },
            { id: 'frames', label: `Frames${decorations.length ? ` (${decorations.length})` : ''}` },
            { id: 'titles', label: `Titles${titles.length ? ` (${titles.length})` : ''}` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-cyan-300/10 text-cyan-200' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body Container */}
        <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto px-8 py-6">

          {activeTab === 'avatars' ? <>

          {/* Categories Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[13px] font-medium transition-colors px-2 py-1 ${activeCategory === cat
                     ? 'text-cyan-300'
                    : 'text-white/50 hover:text-white'
                    }`}
                >
                  #{cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {filteredAvatars.map((url, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedAvatar(url)}
                  className="relative cursor-pointer group"
                >
                  <div className={`aspect-square rounded-full overflow-hidden border-2 transition-all duration-500 ${selectedAvatar === url
                     ? 'border-cyan-300 ring-4 ring-cyan-300/20 scale-105'
                    : 'border-white/15 group-hover:border-white/20 group-hover:scale-105'
                    }`}>
                    <img
                      src={url}
                      alt={`Avatar ${index}`}
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${activeCategory}&background=random`;
                      }}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {selectedAvatar === url && (
                      <div className="absolute inset-0 bg-discord-600/10 flex items-center justify-center animate-in fade-in duration-300">
                         <div className="rounded-full bg-cyan-400 p-0.5 shadow-lg">
                          <Check className="text-white" size={12} strokeWidth={5} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </> : (
            <AnikotoCatalog
              key={activeTab}
              items={activeTab === 'frames' ? decorations : titles}
              kind={activeTab}
              currentAvatar={selectedAvatar || currentAvatar}
              isLoading={isLoading}
              error={catalogError}
              selectedItemId={activeTab === 'frames' ? selectedDecoration?.id : selectedTitle?.id}
              onSelect={activeTab === 'frames' ? setSelectedDecoration : setSelectedTitle}
            />
          )}
        </div>

        {/* Action Footer */}
        <div className="border-t border-white/[0.08] bg-white/[0.01] px-8 py-7">
          {activeTab !== 'avatars' && <p className="mb-4 text-center text-xs text-white/60" role="status">
            {activeTab === 'frames'
              ? (selectedDecoration ? `Selected frame: ${selectedDecoration.item_name}` : 'Click a frame to select it.')
              : (selectedTitle ? `Selected title: ${selectedTitle.item_name}` : 'Click a title to select it.')}
          </p>}
          <button
            type="button"
            onClick={() => onSave({ avatar: selectedAvatar, frame: selectedDecoration, title: selectedTitle })}
            className="mx-auto block rounded-xl bg-white px-10 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#111] shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition-all hover:bg-white/90 active:scale-[0.98]"
          >
            Save Changes
          </button>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.4);
        }
      `}</style>
    </div>,
    document.body
  );
}
