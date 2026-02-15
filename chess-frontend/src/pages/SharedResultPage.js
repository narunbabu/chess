import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const SharedResultPage = () => {
  const { uniqueId } = useParams();
  const navigate = useNavigate();
  const [sharedResult, setSharedResult] = useState(null);
  const [ogData, setOgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSharedResult = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch shared result data
        const resultResponse = await api.get(`/shared-results/${uniqueId}`);
        setSharedResult(resultResponse.data.data);

        // Fetch Open Graph data
        const ogResponse = await api.get(`/shared-results/${uniqueId}/og-data`);
        setOgData(ogResponse.data.og_data);

        // Set page title
        if (ogResponse.data.og_data) {
          document.title = ogResponse.data.og_data['og:title'];
        }

      } catch (err) {
        console.error('Failed to load shared result:', err);
        setError('Shared result not found or has expired');
      } finally {
        setLoading(false);
      }
    };

    if (uniqueId) {
      loadSharedResult();
    }
  }, [uniqueId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mb-4"></div>
          <p className="text-white text-lg">Loading shared result...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-white text-2xl font-bold mb-2">Result Not Found</h2>
          <p className="text-gray-300 mb-4">{error || 'This shared result may have been removed or the link is invalid.'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#81b64c] hover:bg-[#a3d160] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">
              🏆 Chess Game Result 🏆
            </h1>
            <p className="text-gray-300 text-lg">
              Check out this amazing chess game!
            </p>
            {sharedResult.view_count > 0 && (
              <p className="text-gray-400 text-sm mt-2">
                👁️ {sharedResult.view_count} {sharedResult.view_count === 1 ? 'view' : 'views'}
              </p>
            )}
          </div>

          {/* Shared Result Image */}
          <div className="bg-[#312e2b] rounded-2xl shadow-2xl p-4 mb-6 border-2 border-[#3d3a37]">
            <img
              src={sharedResult.image_url}
              alt="Chess game result"
              className="w-full h-auto rounded-xl"
              style={{ maxWidth: '100%', display: 'block' }}
            />
          </div>

          {/* Call to Action */}
          <div className="rounded-xl p-6 text-center text-white shadow-xl border-2 border-[#81b64c]" style={{ background: 'linear-gradient(135deg, #4e7837, #81b64c)' }}>
            <h2 className="text-2xl font-bold mb-3">
              ♟️ Want to Play Chess Too?
            </h2>
            <p className="text-lg mb-4">
              Join thousands of players and improve your chess skills!
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-white text-[#4e7837] px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Play Now at Chess99.com
            </button>
          </div>

          {/* Share Again */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm mb-3">
              Love this game? Share it with your friends!
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button
                onClick={() => {
                  const shareUrl = window.location.href;
                  const shareText = `Check out this amazing chess game! ${shareUrl}`;

                  if (navigator.share) {
                    navigator.share({
                      title: ogData?.['og:title'] || 'Chess Game Result',
                      text: shareText,
                      url: shareUrl
                    }).catch(err => console.log('Share cancelled'));
                  } else {
                    // Fallback: copy to clipboard
                    navigator.clipboard.writeText(shareUrl);
                    alert('Link copied to clipboard!');
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                📤 Share Link
              </button>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = sharedResult.image_url;
                  link.download = `chess-result-${uniqueId}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-[#81b64c] hover:bg-[#a3d160] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                💾 Download Image
              </button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center text-gray-500 text-xs">
            <p>Shared on {new Date(sharedResult.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
  );
};

export default SharedResultPage;
