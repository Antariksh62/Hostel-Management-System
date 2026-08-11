import React, { useState } from 'react';
import { X } from 'lucide-react';

const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
};

const MediaGallery = ({ media, image }) => {
    const [activeMedia, setActiveMedia] = useState(null);

    const items = media?.length > 0 ? media : (image ? [{ url: image, type: 'image' }] : []);
    if (!items.length) return null;

    const openLightbox = (m) => {
        // Prevent default video controls from interfering if it's a video thumbnail click
        setActiveMedia(m);
    };

    const closeLightbox = () => {
        setActiveMedia(null);
    };

    return (
        <>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {items.map((m, i) =>
                    m.type === 'video' ? (
                        <div key={i} style={{ position: 'relative', width: 160, height: 100, cursor: 'pointer' }} onClick={() => openLightbox(m)}>
                            <video src={getMediaUrl(m.url)} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                ▶
                            </div>
                        </div>
                    ) : (
                        <img key={i} src={getMediaUrl(m.url)} alt={`attachment-${i}`}
                            onClick={() => openLightbox(m)}
                            style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', transition: 'transform 0.2s ease' }} 
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                        />
                    )
                )}
            </div>

            {/* Lightbox Overlay */}
            {activeMedia && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, width: '100vw', height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={closeLightbox}
                >
                    <button 
                        onClick={closeLightbox}
                        style={{
                            position: 'absolute', top: 20, right: 20,
                            background: 'rgba(255,255,255,0.2)', border: 'none',
                            color: 'white', borderRadius: '50%', width: 40, height: 40,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', zIndex: 10000
                        }}
                    >
                        <X size={24} />
                    </button>

                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', position: 'relative' }}>
                        {activeMedia.type === 'video' ? (
                            <video 
                                src={getMediaUrl(activeMedia.url)} 
                                controls autoPlay 
                                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} 
                            />
                        ) : (
                            <img 
                                src={getMediaUrl(activeMedia.url)} 
                                alt="Enlarged view" 
                                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', objectFit: 'contain' }} 
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default MediaGallery;
