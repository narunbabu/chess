import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * /join/:code — Stores referral code and redirects to registration.
 * Short URL for sharing: chess99.com/join/ABC12345
 */
const JoinRedirect = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      localStorage.setItem('chess99_referral_code', code);
    }
    navigate(`/login?ref=${code}`, { replace: true });
  }, [code, navigate]);

  return null;
};

export default JoinRedirect;
